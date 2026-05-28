-- Migration: 20260528000000_announcements_reactions_and_qa
-- Adds tables, indexes, RLS policies, and triggers for announcement reactions, public Q&A comments, and notification mutes.

-- Add Q&A notification kinds to the public.notification_kind enum
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'qa_verified';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'qa_reply';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'qa_question_agg';

-- 1. Create announcement_reactions table
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji           TEXT NOT NULL CHECK (char_length(emoji) <= 8),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Limit each user to exactly one active reaction per announcement
  CONSTRAINT unique_announcement_user_reaction UNIQUE(announcement_id, user_id)
);

-- Index for speedy reaction counts
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_lookup ON public.announcement_reactions(announcement_id);

-- 2. Create announcement_comments table
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         VARCHAR(500) NOT NULL CHECK (char_length(content) >= 1),
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for chronological listing of comments
CREATE INDEX IF NOT EXISTS idx_announcement_comments_lookup ON public.announcement_comments(announcement_id, created_at ASC);

-- 3. Create announcement_thread_mutes table
CREATE TABLE IF NOT EXISTS public.announcement_thread_mutes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique mute setting per user per announcement
  CONSTRAINT unique_announcement_user_mute UNIQUE(announcement_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_thread_mutes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for announcement_reactions
DROP POLICY IF EXISTS "Enable read access to reactions for section members" ON public.announcement_reactions;
CREATE POLICY "Enable read access to reactions for section members"
ON public.announcement_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_reactions.announcement_id
      AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable reaction creation/update for self in same section" ON public.announcement_reactions;
CREATE POLICY "Enable reaction creation/update for self in same section"
ON public.announcement_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_reactions.announcement_id
      AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable reaction deletion for self" ON public.announcement_reactions;
CREATE POLICY "Enable reaction deletion for self"
ON public.announcement_reactions
FOR DELETE
USING ( auth.uid() = user_id );

-- 5. RLS Policies for announcement_comments
DROP POLICY IF EXISTS "Enable read access to comments for section members" ON public.announcement_comments;
CREATE POLICY "Enable read access to comments for section members"
ON public.announcement_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable comment creation for self in same section" ON public.announcement_comments;
CREATE POLICY "Enable comment creation for self in same section"
ON public.announcement_comments
FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND is_verified = false
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable comment deletion for author or CR" ON public.announcement_comments;
CREATE POLICY "Enable comment deletion for author or CR"
ON public.announcement_comments
FOR DELETE
USING (
  -- Verified Lockout: Student author can only delete if comment is NOT verified!
  (auth.uid() = author_id AND is_verified = false)
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = auth.uid()
      AND u.role = 'cr'
  )
);

DROP POLICY IF EXISTS "Enable CR to verify comments" ON public.announcement_comments;
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
  id = announcement_comments.id
  AND announcement_id = announcement_comments.announcement_id
  AND author_id = announcement_comments.author_id
  AND content = announcement_comments.content
  AND created_at = announcement_comments.created_at
);

-- 6. RLS Policies for announcement_thread_mutes
DROP POLICY IF EXISTS "Enable user to manage own thread mutes" ON public.announcement_thread_mutes;
CREATE POLICY "Enable user to manage own thread mutes"
ON public.announcement_thread_mutes
FOR ALL
USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );
