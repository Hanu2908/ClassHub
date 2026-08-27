-- Migration: 20260827190000_cr_hub_admin_capabilities.sql
-- Description: Grant Class Representatives administrative control over member management,
-- enrollment access control, batch division configuration, and content pinning/archiving.

-- ============================================================================
-- 1. Schema Extensions
-- ============================================================================

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS is_enrollment_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch1_end_roll INTEGER DEFAULT 30;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_announcements_pinned_section
  ON public.announcements(section_id, is_pinned, created_at DESC);

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_assignments_section_archived
  ON public.assignments(section_id, is_archived, due_date DESC);

-- ============================================================================
-- 2. Member Management RPCs
-- ============================================================================

-- Remove / Detach a student from the section hub
CREATE OR REPLACE FUNCTION public.remove_section_member(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_target_section_id uuid;
  v_target_role text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only an active Class Representative can remove members from this section';
  END IF;

  SELECT section_id, role INTO v_target_section_id, v_target_role
  FROM public.users
  WHERE id = p_target_user_id;

  IF v_target_section_id IS NULL OR v_target_section_id != v_caller_section_id THEN
    RAISE EXCEPTION 'Target user is not a member of your section';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'You cannot remove yourself using member removal. Use resign or transfer CR role instead';
  END IF;

  IF v_target_role = 'cr' THEN
    RAISE EXCEPTION 'Cannot remove a fellow Class Representative directly. Demote or transfer their CR role first';
  END IF;

  -- Detach target user from section and reset settings
  UPDATE public.users
  SET
    section_id = NULL,
    section_roll = NULL,
    sub_batch = NULL,
    notifications_enabled = false,
    updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Purge section-scoped profile tags for the removed user
  DELETE FROM public.user_tags
  WHERE user_id = p_target_user_id AND section_id = v_caller_section_id;
END;
$$;

-- Update member roll number and sub-batch (correct onboarding typos)
CREATE OR REPLACE FUNCTION public.update_section_member(
  p_target_user_id uuid,
  p_section_roll text,
  p_sub_batch text
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_target_section_id uuid;
  v_updated_user public.users;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only an active Class Representative can update member details';
  END IF;

  SELECT section_id INTO v_target_section_id
  FROM public.users
  WHERE id = p_target_user_id;

  IF v_target_section_id IS NULL OR v_target_section_id != v_caller_section_id THEN
    RAISE EXCEPTION 'Target user is not a member of your section';
  END IF;

  IF p_sub_batch IS NOT NULL AND p_sub_batch NOT IN ('1', '2') THEN
    RAISE EXCEPTION 'Sub-batch must be either 1 or 2';
  END IF;

  UPDATE public.users
  SET
    section_roll = COALESCE(TRIM(p_section_roll), section_roll),
    sub_batch = p_sub_batch,
    updated_at = NOW()
  WHERE id = p_target_user_id
  RETURNING * INTO v_updated_user;

  RETURN v_updated_user;
END;
$$;

-- ============================================================================
-- 3. Hub Access Control RPCs
-- ============================================================================

-- Toggle enrollment lock (open vs closed for new student signups)
CREATE OR REPLACE FUNCTION public.toggle_section_enrollment(p_is_locked boolean)
RETURNS public.sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_updated_section public.sections;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only a Class Representative can toggle section enrollment';
  END IF;

  UPDATE public.sections
  SET is_enrollment_locked = p_is_locked
  WHERE id = v_caller_section_id
  RETURNING * INTO v_updated_section;

  RETURN v_updated_section;
END;
$$;

-- Regenerate student or teacher invite code
CREATE OR REPLACE FUNCTION public.regenerate_section_invite_code(p_code_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_section public.sections%ROWTYPE;
  v_prefix text;
  v_new_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_code_type NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Invalid code type. Must be student or teacher';
  END IF;

  SELECT s.* INTO v_section
  FROM public.sections s
  JOIN public.users u ON u.section_id = s.id
  WHERE u.id = v_caller_id AND u.role = 'cr';

  IF v_section.id IS NULL THEN
    RAISE EXCEPTION 'Only a Class Representative can regenerate invite codes';
  END IF;

  -- Extract 2-char section prefix
  v_prefix := UPPER(REGEXP_REPLACE(v_section.name, '[^A-Z0-9]', '', 'g'));
  IF LENGTH(v_prefix) < 2 THEN
    v_prefix := RPAD(v_prefix, 2, 'X');
  ELSE
    v_prefix := SUBSTRING(v_prefix FROM 1 FOR 2);
  END IF;

  -- Generate 4 random characters from unambiguous alphabet
  v_new_code := '';
  FOR v_i IN 1..4 LOOP
    v_new_code := v_new_code || SUBSTR(v_alphabet, FLOOR(RANDOM() * LENGTH(v_alphabet) + 1)::INT, 1);
  END LOOP;

  IF p_code_type = 'student' THEN
    v_new_code := v_prefix || v_new_code;
    UPDATE public.sections
    SET invite_code = v_new_code
    WHERE id = v_section.id;
  ELSE
    v_new_code := 'T-' || v_prefix || v_new_code;
    UPDATE public.sections
    SET teacher_invite_code = v_new_code
    WHERE id = v_section.id;
  END IF;

  RETURN v_new_code;
END;
$$;

-- ============================================================================
-- 4. Batch Range Configuration RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_section_batch_config(
  p_batch1_end_roll integer,
  p_apply_to_existing boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_affected_count integer := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only a Class Representative can configure batch division';
  END IF;

  IF p_batch1_end_roll IS NULL OR p_batch1_end_roll < 1 THEN
    RAISE EXCEPTION 'Batch 1 End Roll must be a positive number';
  END IF;

  UPDATE public.sections
  SET batch1_end_roll = p_batch1_end_roll
  WHERE id = v_caller_section_id;

  IF p_apply_to_existing THEN
    -- Update all students in section according to parsed numeric roll
    WITH updated AS (
      UPDATE public.users
      SET sub_batch = CASE
        WHEN NULLIF(REGEXP_REPLACE(section_roll, '[^0-9]', '', 'g'), '')::INTEGER <= p_batch1_end_roll THEN '1'
        ELSE '2'
      END,
      updated_at = NOW()
      WHERE section_id = v_caller_section_id
        AND role != 'teacher'
        AND section_roll IS NOT NULL
        AND NULLIF(REGEXP_REPLACE(section_roll, '[^0-9]', '', 'g'), '') IS NOT NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_affected_count FROM updated;
  END IF;

  RETURN v_affected_count;
END;
$$;

-- ============================================================================
-- 5. Content Management RPCs
-- ============================================================================

-- Pin / Unpin announcement
CREATE OR REPLACE FUNCTION public.toggle_pin_announcement(
  p_announcement_id uuid,
  p_is_pinned boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_ann_section_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only a Class Representative can pin announcements';
  END IF;

  SELECT section_id INTO v_ann_section_id
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF v_ann_section_id IS NULL OR v_ann_section_id != v_caller_section_id THEN
    RAISE EXCEPTION 'Announcement does not belong to your section';
  END IF;

  UPDATE public.announcements
  SET is_pinned = p_is_pinned
  WHERE id = p_announcement_id;
END;
$$;

-- Archive / Unarchive assignment
CREATE OR REPLACE FUNCTION public.toggle_archive_assignment(
  p_assignment_id uuid,
  p_is_archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_section_id uuid;
  v_asg_section_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT section_id INTO v_caller_section_id
  FROM public.users
  WHERE id = v_caller_id AND role = 'cr';

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Only a Class Representative can archive assignments';
  END IF;

  SELECT section_id INTO v_asg_section_id
  FROM public.assignments
  WHERE id = p_assignment_id;

  IF v_asg_section_id IS NULL OR v_asg_section_id != v_caller_section_id THEN
    RAISE EXCEPTION 'Assignment does not belong to your section';
  END IF;

  UPDATE public.assignments
  SET is_archived = p_is_archived
  WHERE id = p_assignment_id;
END;
$$;

-- ============================================================================
-- 6. Update join_section to enforce enrollment lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_section(invite text, class_roll text, uni_roll text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_section uuid;
  is_locked boolean;
  b1_end int;
  auto_batch text := '1';
  current_email text;
  current_name text;
  current_avatar text;
  numeric_roll int;
  updated_user public.users;
BEGIN
  SELECT id, is_enrollment_locked, COALESCE(batch1_end_roll, 30)
  INTO target_section, is_locked, b1_end
  FROM public.sections
  WHERE invite_code = UPPER(invite);

  IF target_section IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF is_locked = true THEN
    RAISE EXCEPTION 'Enrollment for this section is currently closed by the Class Representative';
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

  -- Determine initial sub-batch automatically from roll number if possible
  BEGIN
    numeric_roll := NULLIF(REGEXP_REPLACE(class_roll, '[^0-9]', '', 'g'), '')::INTEGER;
    IF numeric_roll IS NOT NULL AND numeric_roll > b1_end THEN
      auto_batch := '2';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    auto_batch := '1';
  END;

  INSERT INTO public.users (id, name, email, section_id, section_roll, university_roll, avatar_url, sub_batch)
  VALUES (auth.uid(), current_name, current_email, target_section, class_roll, UPPER(uni_roll), current_avatar, auto_batch)
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        sub_batch = COALESCE(users.sub_batch, excluded.sub_batch),
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        updated_at = NOW()
  RETURNING * INTO updated_user;

  RETURN updated_user;
END;
$$;
