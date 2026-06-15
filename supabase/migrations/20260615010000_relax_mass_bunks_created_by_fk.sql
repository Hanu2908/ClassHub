-- Migration: relax ON DELETE RESTRICT → ON DELETE CASCADE for mass_bunks.created_by
-- Fixes delete-account failing when a student has created a mass bunk.

ALTER TABLE public.mass_bunks DROP CONSTRAINT IF EXISTS mass_bunks_created_by_fkey;
ALTER TABLE public.mass_bunks ADD CONSTRAINT mass_bunks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
