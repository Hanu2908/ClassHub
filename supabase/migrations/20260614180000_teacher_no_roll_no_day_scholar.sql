-- Migration: Enforce teacher fields clean (no roll numbers or day scholar data)
-- Date: 2026-06-14

-- 1. Drop NOT NULL constraint on day_scholar to allow NULL for teachers
ALTER TABLE public.users ALTER COLUMN day_scholar DROP NOT NULL;

-- 2. Create trigger function to clean student-only fields for teachers
CREATE OR REPLACE FUNCTION public.fn_clean_teacher_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'teacher'::public.user_role THEN
    NEW.section_roll := NULL;
    NEW.university_roll := NULL;
    NEW.day_scholar := NULL;
    NEW.sub_batch := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Register the trigger
DROP TRIGGER IF EXISTS users_clean_teacher_fields ON public.users;
CREATE TRIGGER users_clean_teacher_fields
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clean_teacher_fields();

-- 4. Clean up existing teachers (if any)
UPDATE public.users
SET section_roll = NULL,
    university_roll = NULL,
    day_scholar = NULL,
    sub_batch = NULL
WHERE role = 'teacher'::public.user_role;

-- 5. Add check constraint to enforce this integrity constraint permanently
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_teacher_fields_check;
ALTER TABLE public.users ADD CONSTRAINT users_teacher_fields_check CHECK (
  (role != 'teacher'::public.user_role) OR (
    section_roll IS NULL AND 
    university_roll IS NULL AND 
    day_scholar IS NULL AND
    sub_batch IS NULL
  )
);
