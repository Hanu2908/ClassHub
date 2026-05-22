-- Migration: 202605220003_cr_submission_override
-- Adds a CR-controlled verification flag to submissions.
-- Student self-marking sets status='submitted' (unchanged).
-- CR independently marks cr_verified=true to confirm submission on their tracker.
-- These are two separate concerns on the same row, no extra table needed.

alter table public.submissions
  add column if not exists cr_verified boolean not null default false;

-- Allow CR to update cr_verified for assignments in their section.
-- The existing "CR may nudge submissions" policy only allows updating nudge_sent.
-- This new policy explicitly covers cr_verified updates by the CR.
create policy "CR updates submission verification status"
on public.submissions for update to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = submissions.assignment_id
      and public.is_cr_for_section(a.section_id)
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = submissions.assignment_id
      and public.is_cr_for_section(a.section_id)
  )
);

-- Index for efficient CR queries filtering by cr_verified
create index if not exists submissions_cr_verified_idx
  on public.submissions (assignment_id, cr_verified);
