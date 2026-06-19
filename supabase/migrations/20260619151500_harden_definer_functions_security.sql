-- Migration: Harden SECURITY DEFINER functions missing SET search_path
-- Date: 2026-06-19
-- Fixes search_path dropped by post-remediation CREATE OR REPLACE statements.

-- 1. Re-apply search_path on delete_section_hub (dropped by 20260614190000 redefine)
ALTER FUNCTION public.delete_section_hub(uuid) SET search_path = public;

-- 2. Set search_path on fn_clean_teacher_fields trigger (created without it in 20260614180000)
ALTER FUNCTION public.fn_clean_teacher_fields() SET search_path = public;

-- 3. Revoke direct execution on the trigger function as defense-in-depth
--    (triggers fire automatically; no user should call this directly)
REVOKE EXECUTE ON FUNCTION public.fn_clean_teacher_fields() FROM PUBLIC, anon, authenticated;
