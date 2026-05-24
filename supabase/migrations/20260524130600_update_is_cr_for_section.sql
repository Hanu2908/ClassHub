-- Update public.is_cr_for_section helper to also recognize the 'developer' role as having full CR access
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
      AND role IN ('cr'::public.user_role, 'developer'::public.user_role)
      AND section_id = target_section
  );
$$;
