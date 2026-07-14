-- Migration: Fix create_section_hub Teacher Invite Code Generation
-- Date: 2026-07-14

-- 1. Backfill teacher_invite_code for any existing sections that are null
DO $$
DECLARE
  r RECORD;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM public.sections WHERE teacher_invite_code IS NULL LOOP
    LOOP
      new_code := 'T-' || array_to_string(array(select substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (random()*(26-1)+1)::integer, 1) from generate_series(1,6)), '');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sections WHERE teacher_invite_code = new_code);
    END LOOP;
    
    UPDATE public.sections 
    SET teacher_invite_code = new_code 
    WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Update create_section_hub to generate teacher_invite_code automatically
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
  gen_teacher_code text;
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

  -- Generate a random unique teacher invite code
  LOOP
    gen_teacher_code := 'T-' || array_to_string(array(select substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (random()*(26-1)+1)::integer, 1) from generate_series(1,6)), '');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sections WHERE teacher_invite_code = gen_teacher_code);
  END LOOP;

  -- 1. Create section WITHOUT created_by (avoids FK violation since user row doesn't exist yet)
  INSERT INTO public.sections (name, invite_code, teacher_invite_code, branch)
  VALUES (UPPER(section_name), UPPER(invite), gen_teacher_code, p_branch)
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

  -- 4. Grant execute permissions explicitly (just in case)
  GRANT EXECUTE ON FUNCTION public.create_section_hub(text, text, text, text, text, text) TO authenticated;
  REVOKE EXECUTE ON FUNCTION public.create_section_hub(text, text, text, text, text, text) FROM anon;

  RETURN created_section;
END;
$$;
