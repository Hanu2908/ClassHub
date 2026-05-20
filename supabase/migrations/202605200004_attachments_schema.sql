-- Migration: Setup attachments table and secure Supabase private storage bucket RLS policies

-- 1. Create public.attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE, -- Full storage path: section_id/type/parent_id/filename
  filename text NOT NULL,
  file_size integer NOT NULL,        -- In bytes
  file_type text NOT NULL,            -- MIME type (e.g. "application/pdf")
  uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent attachments from belonging to both tables simultaneously
  CONSTRAINT attachments_parent_check CHECK (
    (announcement_id IS NOT NULL AND assignment_id IS NULL) OR
    (assignment_id IS NOT NULL AND announcement_id IS NULL)
  )
);

-- Index foreign keys for RLS performance
CREATE INDEX IF NOT EXISTS attachments_section_id_idx ON public.attachments(section_id);
CREATE INDEX IF NOT EXISTS attachments_announcement_id_idx ON public.attachments(announcement_id);
CREATE INDEX IF NOT EXISTS attachments_assignment_id_idx ON public.attachments(assignment_id);

-- Enable RLS on attachments table
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Recreate policies cleanly
DROP POLICY IF EXISTS "Section members read attachments" ON public.attachments;
CREATE POLICY "Section members read attachments"
ON public.attachments FOR SELECT TO authenticated
USING (section_id = (SELECT public.current_user_section_id()));

DROP POLICY IF EXISTS "CR inserts attachments" ON public.attachments;
CREATE POLICY "CR inserts attachments"
ON public.attachments FOR INSERT TO authenticated
WITH CHECK (public.is_cr_for_section(section_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "CR deletes attachments" ON public.attachments;
CREATE POLICY "CR deletes attachments"
ON public.attachments FOR DELETE TO authenticated
USING (public.is_cr_for_section(section_id));


-- 2. Register attachments private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attachments', 'attachments', false, 10485760, null) -- 10MB limit
ON CONFLICT (id) DO UPDATE 
SET public = false, file_size_limit = 10485760;


-- 3. Storage bucket object policies
-- Clean existing storage policies for attachments bucket
DROP POLICY IF EXISTS "Section members read storage objects" ON storage.objects;
CREATE POLICY "Section members read storage objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments' 
  AND (split_part(name, '/', 1))::uuid = (SELECT public.current_user_section_id())
);

DROP POLICY IF EXISTS "CR inserts storage objects" ON storage.objects;
CREATE POLICY "CR inserts storage objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments' 
  AND public.is_cr_for_section((split_part(name, '/', 1))::uuid)
);

DROP POLICY IF EXISTS "CR deletes storage objects" ON storage.objects;
CREATE POLICY "CR deletes storage objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments' 
  AND public.is_cr_for_section((split_part(name, '/', 1))::uuid)
);
