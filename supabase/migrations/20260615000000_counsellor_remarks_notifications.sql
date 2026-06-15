-- Migration: Counsellor Remarks & Notifications Overhaul
-- Date: 2026-06-15

-- 1. Alter public.users onboarding logic to store Google OAuth profile pictures in avatar_url
CREATE OR REPLACE FUNCTION public.join_section(invite text, class_roll text, uni_roll text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_section uuid;
  current_email text;
  current_name text;
  current_avatar text;
  updated_user public.users;
BEGIN
  SELECT id INTO target_section
  FROM public.sections
  WHERE invite_code = UPPER(invite);

  IF target_section IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT email, 
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
         COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
  INTO current_email, current_name, current_avatar
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT public.is_skit_email(current_email) THEN
    RAISE EXCEPTION 'Only @skit.ac.in accounts can join ClassHub';
  END IF;

  INSERT INTO public.users (id, name, email, section_id, section_roll, university_roll, avatar_url)
  VALUES (auth.uid(), current_name, current_email, target_section, class_roll, UPPER(uni_roll), current_avatar)
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        updated_at = NOW()
  RETURNING * INTO updated_user;

  RETURN updated_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_section_hub(section_name text, invite text, class_roll text, uni_roll text)
RETURNS public.sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
  current_name text;
  current_avatar text;
  created_section public.sections;
BEGIN
  SELECT email, 
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
         COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
  INTO current_email, current_name, current_avatar
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT public.is_skit_email(current_email) THEN
    RAISE EXCEPTION 'Only @skit.ac.in accounts can create a ClassHub section';
  END IF;

  -- 1. Create section WITHOUT created_by (avoids FK violation since user row doesn't exist yet)
  INSERT INTO public.sections (name, invite_code)
  VALUES (UPPER(section_name), UPPER(invite))
  RETURNING * INTO created_section;

  -- 2. Create user row (or update if exists) with CR role
  INSERT INTO public.users (id, name, email, role, section_id, section_roll, university_roll, avatar_url)
  VALUES (auth.uid(), current_name, current_email, 'cr', created_section.id, class_roll, UPPER(uni_roll), current_avatar)
  ON CONFLICT (id) DO UPDATE
    SET role = 'cr',
        section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        updated_at = NOW();

  -- 3. NOW set created_by (user row exists, FK is satisfied)
  UPDATE public.sections
  SET created_by = auth.uid()
  WHERE id = created_section.id;

  -- Re-fetch to return the updated row with created_by set
  SELECT * INTO created_section FROM public.sections WHERE id = created_section.id;

  RETURN created_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_section_as_teacher(invite text, p_subject_id uuid DEFAULT NULL)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_section uuid;
  current_email text;
  current_name text;
  current_avatar text;
  updated_user public.users;
BEGIN
  -- 1. Find section by teacher_invite_code
  SELECT id INTO target_section
  FROM public.sections
  WHERE teacher_invite_code = invite;

  IF target_section IS NULL THEN
    RAISE EXCEPTION 'Invalid teacher invite code';
  END IF;

  -- 2. Fetch active auth user details
  SELECT email, 
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
         COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
  INTO current_email, current_name, current_avatar
  FROM auth.users
  WHERE id = auth.uid();

  -- Check if auth user is found in auth.users table
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user session not found in auth.users database';
  END IF;

  IF NOT public.is_skit_email(current_email) THEN
    RAISE EXCEPTION 'Only @skit.ac.in accounts can join ClassHub';
  END IF;

  -- Ensure current_name is not null to satisfy database not-null constraint
  current_name := COALESCE(current_name, split_part(current_email, '@', 1), 'Teacher');

  -- 3. Upsert into public.users with role = 'teacher'
  INSERT INTO public.users (id, name, email, section_id, role, avatar_url)
  VALUES (auth.uid(), current_name, current_email, target_section, 'teacher'::public.user_role, current_avatar)
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        role = 'teacher'::public.user_role,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url);

  -- 4. Link in public.section_teachers (if not already linked for this subject/section)
  INSERT INTO public.section_teachers (section_id, teacher_id, subject_id)
  VALUES (target_section, auth.uid(), p_subject_id)
  ON CONFLICT (section_id, teacher_id, subject_id) DO NOTHING;

  -- 5. Return updated user row
  SELECT * INTO updated_user FROM public.users WHERE id = auth.uid();
  RETURN updated_user;
END;
$$;

-- 2. One-time script to sync existing authenticated users' profile pictures
UPDATE public.users u
SET avatar_url = COALESCE(a.raw_user_meta_data->>'avatar_url', a.raw_user_meta_data->>'picture')
FROM auth.users a
WHERE u.id = a.id AND u.avatar_url IS NULL;

-- 3. Add columns to public.counsellor_notes
ALTER TABLE public.counsellor_notes 
  ADD COLUMN IF NOT EXISTS student_response text,
  ADD COLUMN IF NOT EXISTS student_response_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS counsellor_remark_updated_at timestamptz;

-- 4. Add values 'counsellor_remark' and 'counsellor_remark_reply' to public.notification_kind enum
-- Check if the values exist first to make migration idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_kind' AND e.enumlabel = 'counsellor_remark') THEN
    ALTER TYPE public.notification_kind ADD VALUE 'counsellor_remark';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_kind' AND e.enumlabel = 'counsellor_remark_reply') THEN
    ALTER TYPE public.notification_kind ADD VALUE 'counsellor_remark_reply';
  END IF;
END $$;

-- 5. Alter RLS policies on public.counsellor_notes
DROP POLICY IF EXISTS "Counsellors manage own remarks" ON public.counsellor_notes;
CREATE POLICY "Counsellors manage own remarks" ON public.counsellor_notes
  FOR ALL TO authenticated
  USING (counsellor_id = (SELECT auth.uid()))
  WITH CHECK (counsellor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students read own counsellor notes" ON public.counsellor_notes;
CREATE POLICY "Students read own counsellor notes" ON public.counsellor_notes
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students update own counsellor note response" ON public.counsellor_notes;
CREATE POLICY "Students update own counsellor note response" ON public.counsellor_notes
  FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()))
  WITH CHECK (student_id = (SELECT auth.uid()));

-- 6. Add trigger to enforce student update permissions (column locks)
CREATE OR REPLACE FUNCTION public.check_student_counsellor_notes_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if current user role is student
  IF (SELECT public.current_user_role()) = 'student'::public.user_role THEN
    -- Ensure student is only updating student_response and student_response_updated_at
    IF NEW.counsellor_id IS DISTINCT FROM OLD.counsellor_id OR
       NEW.student_id IS DISTINCT FROM OLD.student_id OR
       NEW.note_text IS DISTINCT FROM OLD.note_text OR
       NEW.counsellor_remark_updated_at IS DISTINCT FROM OLD.counsellor_remark_updated_at THEN
      RAISE EXCEPTION 'Students are only permitted to update their response text.';
    END IF;
    -- Automatically set timestamp
    NEW.student_response_updated_at := NOW();
  ELSE
    -- If counsellor updates it, set counsellor timestamp
    IF NEW.note_text IS DISTINCT FROM OLD.note_text THEN
      NEW.counsellor_remark_updated_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_student_counsellor_notes_update ON public.counsellor_notes;
CREATE TRIGGER trg_check_student_counsellor_notes_update
  BEFORE UPDATE ON public.counsellor_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_student_counsellor_notes_update();

-- 7. Add trigger to automatically log events in public.notification_events when remarks or responses are written
CREATE OR REPLACE FUNCTION public.on_counsellor_notes_change()
RETURNS TRIGGER AS $$
DECLARE
  student_sec uuid;
BEGIN
  SELECT section_id INTO student_sec FROM public.users WHERE id = NEW.student_id;

  -- A. Remark added or updated by counsellor
  IF (TG_OP = 'INSERT') OR (OLD.note_text IS DISTINCT FROM NEW.note_text) THEN
    INSERT INTO public.notification_events (section_id, recipient_id, actor_id, kind, target_table, target_id)
    VALUES (
      student_sec,
      NEW.student_id,
      NEW.counsellor_id,
      'counsellor_remark'::public.notification_kind,
      'counsellor_notes',
      NEW.id
    );
  END IF;

  -- B. Student response updated
  IF (TG_OP = 'UPDATE') AND (OLD.student_response IS DISTINCT FROM NEW.student_response) AND (NEW.student_response IS NOT NULL) THEN
    INSERT INTO public.notification_events (section_id, recipient_id, actor_id, kind, target_table, target_id)
    VALUES (
      student_sec,
      NEW.counsellor_id,
      NEW.student_id,
      'counsellor_remark_reply'::public.notification_kind,
      'counsellor_notes',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_counsellor_notes_change ON public.counsellor_notes;
CREATE TRIGGER trg_on_counsellor_notes_change
  AFTER INSERT OR UPDATE ON public.counsellor_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_counsellor_notes_change();
