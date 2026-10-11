-- ============================================================================
-- Migration: Lock privileged columns on public.users
-- Date: 2026-10-11
-- Why:
--   The UPDATE policy pinned role and section_id but not is_developer, cr_rank
--   or roll numbers, so any student could run
--     update users set is_developer = true where id = auth.uid()
--   and pass requireDeveloper() in edge functions (service-role reads of any
--   section's names and emails).
-- Fix:
--   Allowlist the columns the client actually writes. Every other column,
--   including ones added later, is read-only for API roles. Enrollment and CR
--   changes go through SECURITY DEFINER RPCs, which run as the table owner and
--   are unaffected.
-- Tests: supabase/tests/users_privileges.test.sql
-- ============================================================================

REVOKE INSERT, UPDATE ON public.users FROM anon, authenticated;

GRANT UPDATE (day_scholar, sub_batch, phone, branch, notifications_enabled)
  ON public.users TO authenticated;
