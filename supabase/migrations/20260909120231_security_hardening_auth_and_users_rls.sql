-- ============================================================================
-- Migration: Security Hardening - Institutional Email Enforcement & Users RLS
-- Date: 2026-09-09
-- Purpose:
--   1. Enforce institutional @skit.ac.in email domain at the database level on auth.users.
--   2. Lock down public.users RLS policies to eliminate client-side privilege escalation.
-- ============================================================================

-- ── 1. Database-Level Email Domain Enforcement ────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_institutional_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If email is provided, verify it belongs strictly to the institutional domain
  IF NEW.email IS NOT NULL AND LOWER(NEW.email) NOT LIKE '%@skit.ac.in' THEN
    RAISE EXCEPTION 'Access restricted: Only @skit.ac.in institutional email addresses are permitted.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_email_check ON auth.users;
CREATE TRIGGER on_auth_user_created_email_check
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_institutional_email();

-- ── 2. Harden public.users RLS Policies ───────────────────────────────────────

-- Drop older permissive insert/update policies
DROP POLICY IF EXISTS "Users upsert own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own non-role profile" ON public.users;
DROP POLICY IF EXISTS "Users insert own profile default" ON public.users;

-- Client-side direct INSERT on public.users is restricted:
-- Direct inserts may ONLY set default 'student' role and no section.
-- Actual enrollment and CR promotions MUST go through SECURITY DEFINER RPCs:
-- (create_section_hub, join_section, join_section_as_teacher).
CREATE POLICY "Users insert own profile default"
ON public.users FOR INSERT TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  AND role = 'student'::public.user_role
  AND section_id IS NULL
);

-- Client-side direct UPDATE on public.users:
-- Users can safely update profile details (day_scholar, phone, sub_batch, avatar_url, etc.)
-- but CANNOT alter their assigned 'role' or jump to another 'section_id'.
CREATE POLICY "Users update own non-role profile"
ON public.users FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (
  id = (SELECT auth.uid())
  AND role = (SELECT role FROM public.users WHERE id = (SELECT auth.uid()))
  AND section_id IS NOT DISTINCT FROM (SELECT section_id FROM public.users WHERE id = (SELECT auth.uid()))
);
