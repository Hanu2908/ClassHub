-- Migration: 20260602000000_relax_remaining_restrict_fks
-- Fixes missing ON DELETE SET NULL and CASCADE for foreign keys that block deletion flows.

-- 1. sections.created_by: RESTRICT → SET NULL
-- Fixes delete-account edge function failing when user has created a section.
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_created_by_fkey;
ALTER TABLE public.sections ADD CONSTRAINT sections_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. assignments.subject_id: RESTRICT → CASCADE
-- Fixes delete_section_hub failing when a section has assignments.
-- When a section is deleted, it cascades to subjects, which then cascades to assignments.
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_subject_id_fkey;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
