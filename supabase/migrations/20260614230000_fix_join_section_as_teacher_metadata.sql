-- Migration: Fix join_section_as_teacher null name constraint and add auth checks
-- Date: 2026-06-14

DROP FUNCTION IF EXISTS public.join_section_as_teacher(text);
DROP FUNCTION IF EXISTS public.join_section_as_teacher(text, uuid);

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
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  INTO current_email, current_name
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
  INSERT INTO public.users (id, name, email, section_id, role)
  VALUES (auth.uid(), current_name, current_email, target_section, 'teacher'::public.user_role)
  ON CONFLICT (id) DO UPDATE
    SET section_id = excluded.section_id,
        role = 'teacher'::public.user_role;

  -- 4. Link in public.section_teachers (if not already linked for this subject/section)
  INSERT INTO public.section_teachers (section_id, teacher_id, subject_id)
  VALUES (target_section, auth.uid(), p_subject_id)
  ON CONFLICT (section_id, teacher_id, subject_id) DO NOTHING;

  -- 5. Return updated user row
  SELECT * INTO updated_user FROM public.users WHERE id = auth.uid();
  RETURN updated_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_section_as_teacher(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_section_as_teacher(text, uuid) FROM anon;
