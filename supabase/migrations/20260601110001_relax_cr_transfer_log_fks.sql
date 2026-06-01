-- Migration: 20260601110001_relax_cr_transfer_log_fks
-- Fixes missing ON DELETE CASCADE/SET NULL for cr_transfer_log foreign keys
-- which block section deletion and user account deletion.

-- 1. section_id: Cascade on section delete
ALTER TABLE public.cr_transfer_log DROP CONSTRAINT IF EXISTS cr_transfer_log_section_id_fkey;
ALTER TABLE public.cr_transfer_log ADD CONSTRAINT cr_transfer_log_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;

-- 2. actor_id: Set null on user delete (keep audit log, drop reference)
ALTER TABLE public.cr_transfer_log DROP CONSTRAINT IF EXISTS cr_transfer_log_actor_id_fkey;
ALTER TABLE public.cr_transfer_log ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.cr_transfer_log ADD CONSTRAINT cr_transfer_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. target_id: Set null on user delete (keep audit log, drop reference)
ALTER TABLE public.cr_transfer_log DROP CONSTRAINT IF EXISTS cr_transfer_log_target_id_fkey;
ALTER TABLE public.cr_transfer_log ALTER COLUMN target_id DROP NOT NULL;
ALTER TABLE public.cr_transfer_log ADD CONSTRAINT cr_transfer_log_target_id_fkey
  FOREIGN KEY (target_id) REFERENCES public.users(id) ON DELETE SET NULL;
