# Profile Tags — Design Spec

**Date:** 2026-06-03
**Author:** Himanshu Saini (PM) + AI Architect
**Status:** Approved
**ADR:** ADR-020 (new table `user_tags`)

## Summary

Allow students to add up to 5 freeform tags on their profile (e.g., "🤖 Robotics", "Looking for Expo Team", "Dance Crew"). Tags are visible to all members within the same section and enable discovery for group formation, event participation, and self-expression.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Same-section students only | Consistent with section-scoped multi-tenancy (ADR-010) |
| Tag input | Freeform with autocomplete from section pool | Organic convergence without CR maintenance |
| Expiry | Optional, preset durations | Covers event-driven tags (expos, competitions) |
| Max tags | 5 per user | Room for permanent + temporary tags to coexist |
| Expiry durations | 1 day, 3 days, 1 week, 2 weeks, permanent | Covers all realistic use cases without calendar picker |
| Text constraints | Max 24 chars, alphanumeric + spaces + emojis + hyphens | Concise labels, emoji-friendly |
| Autocomplete matching | Case-insensitive, display as typed | "robotics" and "Robotics" suggest the same tag |
| Duplicate prevention | UNIQUE on (user_id, lower(tag_text)) | No "Robotics" + "robotics" on same user |
| CR moderation | CR can delete any student's tag | Consistent with existing CR moderation (comments) |
| Expired tag handling | Client-side filtering (WHERE expires_at IS NULL OR expires_at > NOW()) | Consistent with announcement expiry pattern |
| Tag interaction | Tap-to-filter: tapping a tag pill filters member list | Enables group-formation discovery workflow |
| UI surfaces | Profile page (manage), member list (display + filter), comment section (display) | Three existing surfaces, no new pages |

## Schema

### New table: `user_tags`

```sql
CREATE TABLE public.user_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  tag_text    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ,          -- NULL = permanent
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT tag_text_length CHECK (char_length(trim(tag_text)) BETWEEN 1 AND 24),
  -- no_duplicate_tags enforced via unique index below
);

-- Prevent duplicate tags per user (case-insensitive)
CREATE UNIQUE INDEX idx_user_tags_no_duplicates
  ON user_tags (user_id, lower(tag_text));

-- Performance: autocomplete queries and section-scoped reads
CREATE INDEX idx_user_tags_section ON user_tags (section_id);
CREATE INDEX idx_user_tags_user ON user_tags (user_id);
```

### Max 5 active tags trigger

```sql
CREATE OR REPLACE FUNCTION check_max_active_tags()
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
  FOR EACH ROW EXECUTE FUNCTION check_max_active_tags();
```

### RLS Policies

```sql
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

-- No UPDATE policy: delete + re-add is the edit workflow
```

## Frontend Architecture

### Data Layer: `src/hooks/useUserTags.ts`

**Queries:**
- `useUserTags(userId?)` — fetch tags for a specific user or current user; client-side filters expired tags
- `useSectionTagPool()` — fetch all distinct active `tag_text` values in the section for autocomplete; query: `SELECT DISTINCT lower(tag_text) as tag, tag_text FROM user_tags WHERE section_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`
- `useUserTagsBatch(userIds: string[])` — fetch tags for multiple users in one query (for member list and comments); returns a `Record<string, Tag[]>` keyed by user_id

**Mutations:**
- `useAddTag()` — inserts a new tag row with `user_id`, `section_id`, `tag_text`, and optional `expires_at` computed from selected preset duration
- `useDeleteTag()` — deletes a tag by `id`; used for both self-removal and CR moderation

All queries filter by `section_id` (ADR-010). All mutations invalidate `['user_tags']` query keys on success.

### Profile Page: Tag Management Section

**Location:** Between the "Avatar + identity" card and "Hub Info" section in `ProfilePage.tsx`.

**Section title:** "MY TAGS"

**Layout:**
- Row of current active tag pills, each showing:
  - Tag text (e.g., "🤖 Robotics")
  - Dismiss button (×) to remove
  - If expiring: subtle clock icon + remaining time (e.g., "2d left")
- "Add Tag" button below the pills (disabled when 5 active tags exist)

**Add Tag bottom sheet (new component `AddTagSheet.tsx`):**
1. Text input with autocomplete dropdown
   - On type, `useSectionTagPool()` results filtered by input
   - Dropdown shows matching existing tags; user can pick one or type a new one
   - Input trims whitespace and enforces 24-char max
2. Duration picker
   - Row of pill-style buttons: `1 day` | `3 days` | `1 week` | `2 weeks` | `∞ Permanent`
   - Default selection: `∞ Permanent`
   - Selected pill gets accent color highlight
3. "Add Tag" submit button
   - Disabled if input is empty or whitespace-only
   - On submit: calls `useAddTag()` mutation, closes sheet on success

### Member List: Tag Display + Tap-to-Filter

**Changes to `useSectionMembers` or parallel query:**
- Fetch active tags per member via `useUserTagsBatch()`
- Extend `SectionMember` interface with `tags: { id: string; tagText: string; expiresAt: string | null }[]`

**Display:**
- After the existing role badge and roll number on each member row, render tag pills
- Pills use a distinct visual style (smaller, muted background) to differentiate from system badges
- Max 3 pills visible per row; overflow shows "+N" indicator

**Tap-to-filter:**
- Tapping any tag pill navigates to the member list with `?tag=<tagText>` query param
- When `tag` param is present:
  - Member list filters to show only users with that tag (case-insensitive match)
  - A "Showing: \<tag\> ×" chip renders at the top of the list
  - Tapping × on the chip clears the filter (removes query param)

**CR moderation:**
- When CR views a member's tags in the member list, each pill shows a small × button
- Tapping × prompts a confirmation and calls `useDeleteTag()` with the tag's `id`

### Comment Section: Tag Display

**Changes to `AnnouncementCommentsDrawer.tsx`:**
- After the author name + roll + CR badge row (existing lines 338-351), append tag pills
- Space-constrained: show max 2 tag pills per comment
- If user has >2 active tags, show first 2 + "+N" overflow pill
- Tapping a tag pill navigates to member list with `?tag=<tagText>` filter

**Data source:**
- Comments already fetch via `useSectionMembers()` for the mention autocomplete (line 58)
- Tags can be loaded alongside or via a separate `useUserTagsBatch()` call with the unique author IDs from the loaded comments

### Shared Component: `TagPill.tsx`

A reusable pill component used across all three surfaces:

```typescript
interface TagPillProps {
  tagText: string;
  expiresAt?: string | null;
  size?: 'sm' | 'md';           // sm for comments, md for profile/members
  onTap?: () => void;            // tap-to-filter navigation
  onRemove?: () => void;         // × button (self-remove or CR moderation)
  showExpiry?: boolean;          // show "2d left" indicator
}
```

**Visual style:**
- Background: `rgba(74, 158, 255, 0.1)` with `1px solid rgba(74, 158, 255, 0.2)` border
- Text: `var(--text-primary)` at 11-12px
- Border radius: pill (`var(--radius-pill)`)
- Hover/tap: slightly brighter background
- Expiry indicator: clock icon + muted text showing remaining time

## Expiry Duration Calculation

Preset durations map to `expires_at` timestamps:

| Label | Calculation |
|---|---|
| 1 day | `new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)` |
| 3 days | `new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)` |
| 1 week | `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` |
| 2 weeks | `new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)` |
| Permanent | `null` (no `expires_at`) |

Remaining time display logic:
- ≥1 day remaining: "Nd left" (e.g., "2d left")
- <1 day remaining: "Nh left" (e.g., "5h left")
- <1 hour remaining: "expiring soon"

## Security Considerations

- **Section scoping:** All queries include `section_id` filter. RLS enforces at DB level.
- **Tag content:** No HTML or script injection risk — tags render as text content only, never as `dangerouslySetInnerHTML`.
- **Rate limiting:** The 5-tag limit and DB trigger prevent abuse. No additional rate limiting needed for a 70-student section.
- **CR moderation:** CR delete power is section-scoped — a CR cannot delete tags in another section.

## Out of Scope

- Cross-section tag discovery
- Tag categories or types (interest vs. event vs. looking-for-group)
- Tag analytics (most popular tags, trending tags)
- Dedicated "People" / directory page with search
- Server-side expired tag cleanup (pg_cron)
- Tag notifications ("X just tagged themselves as 'Expo Team Needed'")
