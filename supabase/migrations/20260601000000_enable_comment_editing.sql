-- Migration: 20260601000000_enable_comment_editing
-- Enables comment editing with a 15-minute window for author,
-- adds edited_at tracking column and trigger, and applies highly optimized, 
-- plan-cached, role-targeted RLS policies for announcement_comments.

-- 1. Add edited_at column to announcement_comments
ALTER TABLE public.announcement_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop old policies to prevent collision
DROP POLICY IF EXISTS "Enable read access to comments for section members" ON public.announcement_comments;
DROP POLICY IF EXISTS "Enable comment creation for self in same section" ON public.announcement_comments;
DROP POLICY IF EXISTS "Enable comment deletion for author or CR" ON public.announcement_comments;
DROP POLICY IF EXISTS "Enable CR to verify comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "Enable comment content update for author within 15 mins" ON public.announcement_comments;
DROP POLICY IF EXISTS "authenticated_read_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "authenticated_insert_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "authenticated_delete_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "authenticated_update_comments" ON public.announcement_comments;

-- 3. Create optimized, plan-cached SELECT, INSERT, and DELETE policies (targeted TO authenticated)
CREATE POLICY "authenticated_read_comments"
ON public.announcement_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

CREATE POLICY "authenticated_insert_comments"
ON public.announcement_comments FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = author_id
  AND is_verified = false
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

CREATE POLICY "authenticated_delete_comments"
ON public.announcement_comments FOR DELETE TO authenticated
USING (
  ((SELECT auth.uid()) = author_id AND is_verified = false)
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
);

-- 4. Create merged & targeted UPDATE policy (resolves multiple permissive update policies)
CREATE POLICY "authenticated_update_comments"
ON public.announcement_comments FOR UPDATE TO authenticated
USING (
  -- Either the original author updating within 15 mins (unverified)
  (
    (SELECT auth.uid()) = author_id 
    AND is_verified = false
    AND created_at > now() - interval '15 minutes'
  )
  OR
  -- Or the CR of the section verifying comments
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
)
WITH CHECK (
  -- For original author edits: must maintain id, announcement_id, author_id, created_at, and is_verified must remain false
  (
    (SELECT auth.uid()) = author_id
    AND is_verified = false
    AND id = id
    AND announcement_id = announcement_id
    AND author_id = author_id
    AND created_at = created_at
  )
  OR
  -- For CR verification updates: must maintain id, announcement_id, author_id, content, created_at
  (
    EXISTS (
      SELECT 1 FROM public.announcements a
      JOIN public.users u ON u.section_id = a.section_id
      WHERE a.id = announcement_comments.announcement_id
        AND u.id = (SELECT auth.uid())
        AND u.role = 'cr'
    )
    AND id = id
    AND announcement_id = announcement_id
    AND author_id = author_id
    AND content = content
    AND created_at = created_at
  )
);

-- 5. Create automatic edited_at update function & trigger
CREATE OR REPLACE FUNCTION public.handle_announcement_comment_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content <> OLD.content THEN
    NEW.edited_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_announcement_comment_update ON public.announcement_comments;
CREATE TRIGGER on_announcement_comment_update
  BEFORE UPDATE ON public.announcement_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_announcement_comment_update();
