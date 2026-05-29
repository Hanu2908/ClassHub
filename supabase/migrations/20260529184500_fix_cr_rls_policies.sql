-- Migration: 20260529184500_fix_cr_rls_policies
-- ADR-019: Granular RLS Policies for Assignments and Polls to support Multi-CR edits and Seed edits

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. assignments RLS Update
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "CR manages assignments" ON public.assignments;
DROP POLICY IF EXISTS "CR creates assignments" ON public.assignments;
DROP POLICY IF EXISTS "CR updates assignments" ON public.assignments;
DROP POLICY IF EXISTS "CR deletes assignments" ON public.assignments;

CREATE POLICY "CR creates assignments"
  ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_cr_for_section(section_id)
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "CR updates assignments"
  ON public.assignments
  FOR UPDATE TO authenticated
  USING (public.is_cr_for_section(section_id))
  WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR deletes assignments"
  ON public.assignments
  FOR DELETE TO authenticated
  USING (public.is_cr_for_section(section_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. polls RLS Update
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "CR manages polls" ON public.polls;
DROP POLICY IF EXISTS "CR creates polls" ON public.polls;
DROP POLICY IF EXISTS "CR updates polls" ON public.polls;
DROP POLICY IF EXISTS "CR deletes polls" ON public.polls;

CREATE POLICY "CR creates polls"
  ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_cr_for_section(section_id)
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "CR updates polls"
  ON public.polls
  FOR UPDATE TO authenticated
  USING (public.is_cr_for_section(section_id))
  WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR deletes polls"
  ON public.polls
  FOR DELETE TO authenticated
  USING (public.is_cr_for_section(section_id));
