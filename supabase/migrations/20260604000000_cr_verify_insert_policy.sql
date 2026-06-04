-- Migration: 20260604000000_cr_verify_insert_policy
-- Fixes the CR "Verify" button in the Submission Tracker.
--
-- Root cause: useCRToggleSubmission does an upsert on submissions.
-- When a student has no submission row at all (truly pending),
-- the upsert attempts an INSERT — but the existing INSERT policy
-- ("Students submit own work") only allows student_id = auth.uid().
-- CRs are blocked from inserting, so the upsert silently fails or throws.
--
-- Fix: Add an INSERT policy that lets CRs create a placeholder submission row
-- for students in their section. The row is created with status='pending'
-- and cr_verified=true (the upsert will supply both fields).
-- The check constraint requires: status='pending' AND submission_link IS NULL,
-- OR status='submitted' AND submission_link IS NOT NULL.
-- CR-inserted rows will always be status='pending', submission_link=null,
-- cr_verified=true — which satisfies the constraint.

drop policy if exists "CR inserts submission verification record" on public.submissions;

create policy "CR inserts submission verification record"
on public.submissions for insert to authenticated
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and public.is_cr_for_section(a.section_id)
  )
);
