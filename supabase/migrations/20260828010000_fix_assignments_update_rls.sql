-- ── Fix RLS policy for updating assignments ─────────────────────────────────
-- Migration: 20260828010000_fix_assignments_update_rls.sql
-- Plain English: Allows any verified Class Representative of the section to
-- update assignments in their section (removing the restrictive created_by = auth.uid() check).

DROP POLICY IF EXISTS "CR manages assignments_update" ON public.assignments;

CREATE POLICY "CR manages assignments_update"
ON public.assignments FOR UPDATE TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id));
