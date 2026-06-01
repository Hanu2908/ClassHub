-- Migration: 20260601110000_relax_attachments_uploaded_by_fk
-- attachments.uploaded_by was ON DELETE RESTRICT, blocking account deletion.
-- Relax to SET NULL so attachments remain visible after uploader account is deleted.

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;
ALTER TABLE public.attachments ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
