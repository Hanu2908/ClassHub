-- Migration: Profile Onboarding & Section Branch Fields
-- Date: 2026-06-19

-- 1. Alter public.sections to add branch column
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS branch TEXT;

-- 2. Alter public.users to add branch and phone columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Add CHECK constraints to sections and users
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS check_section_branch;
ALTER TABLE public.sections
ADD CONSTRAINT check_section_branch CHECK (
  branch IS NULL OR branch IN (
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'CSE (Artificial Intelligence)',
    'CSE (Data Science)',
    'CSE (IoT)'
  )
);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_branch;
ALTER TABLE public.users
ADD CONSTRAINT check_user_branch CHECK (
  branch IS NULL OR branch IN (
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'CSE (Artificial Intelligence)',
    'CSE (Data Science)',
    'CSE (IoT)'
  )
);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_phone;
ALTER TABLE public.users
ADD CONSTRAINT check_user_phone CHECK (
  phone IS NULL OR phone ~ '^[6-9][0-9]{9}$'
);

-- 4. Drop and Redefine create_section_hub function
DROP FUNCTION IF EXISTS public.create_section_hub(text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_section_hub(
  section_name text,
  invite text,
  class_roll text,
  uni_roll text,
  p_branch text,
  p_phone text
)
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
  INSERT INTO public.sections (name, invite_code, branch)
  VALUES (UPPER(section_name), UPPER(invite), p_branch)
  RETURNING * INTO created_section;

  -- 2. Create user row (or update if exists) with CR role, branch and phone
  INSERT INTO public.users (id, name, email, role, section_id, section_roll, university_roll, avatar_url, branch, phone)
  VALUES (auth.uid(), current_name, current_email, 'cr', created_section.id, class_roll, UPPER(uni_roll), current_avatar, p_branch, p_phone)
  ON CONFLICT (id) DO UPDATE
    SET role = 'cr',
        section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        branch = excluded.branch,
        phone = excluded.phone,
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

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_section_hub(text, text, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_section_hub(text, text, text, text, text, text) FROM anon;
