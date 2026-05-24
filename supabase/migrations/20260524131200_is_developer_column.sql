-- Migration: Decouple Developer privileges from local Class Representative (CR) role
-- Timestamp: 20260524131200

-- 1. Add 'is_developer' boolean column to the public.users table if it does not exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrate any existing users currently using the 'developer' role to the standard 'student' role, 
--    and ensure they are flagged as is_developer = true.
UPDATE public.users 
SET is_developer = true, 
    role = 'student'::public.user_role 
WHERE role = 'developer'::public.user_role;

-- 3. Revert public.is_cr_for_section helper back to checking strictly 'cr' role.
--    This ensures developers do not automatically get administrative access to sections
--    unless they are also assigned the CR role for that section.
CREATE OR REPLACE FUNCTION public.is_cr_for_section(target_section uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role = 'cr'::public.user_role
      AND section_id = target_section
  );
$$;

-- 4. Re-create feedback_reports RLS policies to check is_developer = true instead of role = 'developer'
DROP POLICY IF EXISTS allow_student_read_own ON feedback_reports;
DROP POLICY IF EXISTS allow_developer_all ON feedback_reports;

-- Policy to allow students/CRs to view their own reports, and developers to view all reports
CREATE POLICY allow_student_read_own ON feedback_reports 
  FOR SELECT TO authenticated 
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_developer = true)
  );

-- Policy to allow core developers to have complete administrative privileges (all operations)
CREATE POLICY allow_developer_all ON feedback_reports 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_developer = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_developer = true));
