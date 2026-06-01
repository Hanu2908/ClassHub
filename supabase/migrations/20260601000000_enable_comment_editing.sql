-- Migration: 20260601000000_enable_comment_editing
-- Enables a strict 15-minute comment editing system for original authors on unverified comments.
-- Adds the edited_at timestamp tracking, triggers, and secure RLS policies.

-- 1. Add edited_at column to announcement_comments
ALTER TABLE public.announcement_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop existing update policies for announcement_comments
DROP POLICY IF EXISTS "Enable CR to verify comments" ON public.announcement_comments;

-- 3. Create update policy for original authors (strict 15-minute window, content-only edit)
DROP POLICY IF EXISTS "Enable comment content update for author within 15 mins" ON public.announcement_comments;
CREATE POLICY "Enable comment content update for author within 15 mins"
ON public.announcement_comments
FOR UPDATE
USING (
  auth.uid() = author_id 
  AND is_verified = false
  AND created_at > now() - interval '15 minutes'
)
WITH CHECK (
  auth.uid() = author_id
  AND is_verified = false
  AND id = id
  AND announcement_id = announcement_id
  AND author_id = author_id
  AND created_at = created_at
);

-- 4. Create update policy for CRs (strictly verification toggle, content locked)
CREATE POLICY "Enable CR to verify comments"
ON public.announcement_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = auth.uid()
      AND u.role = 'cr'
  )
)
WITH CHECK (
  id = id
  AND announcement_id = announcement_id
  AND author_id = author_id
  AND content = content
  AND created_at = created_at
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
