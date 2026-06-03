-- Profile Tags: user_tags table, constraints, indexes, trigger, and RLS
-- Spec: docs/superpowers/specs/2026-06-03-profile-tags-design.md

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  tag_text    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ,          -- NULL = permanent
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT tag_text_length CHECK (char_length(trim(tag_text)) BETWEEN 1 AND 24)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Case-insensitive duplicate prevention per user
CREATE UNIQUE INDEX idx_user_tags_no_duplicates
  ON public.user_tags (user_id, lower(tag_text));

-- Section-scoped queries (autocomplete pool, member tags)
CREATE INDEX idx_user_tags_section ON public.user_tags (section_id);

-- User-scoped queries (profile page, batch fetch)
CREATE INDEX idx_user_tags_user ON public.user_tags (user_id);

-- ── Trigger: max 5 active tags per user ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_max_active_tags()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.user_tags
    WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 active tags allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_active_tags
  BEFORE INSERT ON public.user_tags
  FOR EACH ROW EXECUTE FUNCTION public.check_max_active_tags();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: read tags for users in the same section
CREATE POLICY "user_tags_select"
  ON public.user_tags FOR SELECT
  USING (
    section_id = (SELECT section_id FROM public.users WHERE id = auth.uid())
  );

-- INSERT: users can only add tags for themselves, in their own section
CREATE POLICY "user_tags_insert"
  ON public.user_tags FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND section_id = (SELECT section_id FROM public.users WHERE id = auth.uid())
  );

-- DELETE: users can delete own tags; CR can delete any tag in their section
CREATE POLICY "user_tags_delete"
  ON public.user_tags FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      section_id = (SELECT section_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'cr'
    )
  );
