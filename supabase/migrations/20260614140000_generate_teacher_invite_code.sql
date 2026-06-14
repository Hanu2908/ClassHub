-- Migration: Generate Teacher Invite Code
-- Date: 2026-06-14

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
CREATE OR REPLACE FUNCTION public.create_section_hub(section_name text, invite text, class_roll text, uni_roll text)
RETURNS public.sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
  current_name text;
  created_section public.sections;
  gen_teacher_code text;
BEGIN
  SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  INTO current_email, current_name
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
  INSERT INTO public.sections (name, invite_code, teacher_invite_code)
  VALUES (upper(section_name), upper(invite), gen_teacher_code)
  RETURNING * INTO created_section;

  -- 2. Create user row (or update if exists) with CR role + primary rank
  INSERT INTO public.users (id, name, email, role, cr_rank, section_id, section_roll, university_roll)
  VALUES (auth.uid(), current_name, current_email, 'cr', 'primary', created_section.id, class_roll, upper(uni_roll))
  ON CONFLICT (id) DO UPDATE
    SET role = 'cr',
        cr_rank = 'primary',
        section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        updated_at = now();

  -- 3. NOW set created_by (user row exists, FK is satisfied)
  UPDATE public.sections
  SET created_by = auth.uid()
  WHERE id = created_section.id;

  -- Re-fetch to return the updated row with created_by set
  SELECT * INTO created_section FROM public.sections WHERE id = created_section.id;

  RETURN created_section;
END;
$$;
