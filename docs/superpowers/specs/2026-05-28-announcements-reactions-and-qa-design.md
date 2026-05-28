# Design Specification: Announcements Emoji Reactions & High-Signal Q&A

This document specifies the database architecture, security policies, real-time synchronization, and premium visual components to transform ClassHub announcements from a one-way communication channel into a highly engaging, two-way collaborative FAQ.

---

## 1. Product Requirements & Scope

* **Reactions**: Allows students and CRs to express lightweight, non-verbal feedback using standardized academic emojis.
* **Public Q&A Comments**: Collapsible, chronological public comment drawer under each notice for Q&A, reducing repeat queries for CRs.
* **Verified Answers**: A CR can mark any peer or CR comment as "Verified." Verified answers receive distinct glowing visual cues.
* **Refined Notifications**: Real-time push alerts that keep threads interactive while avoiding alert fatigue:
  1. *Peer replies* notify the question author.
  2. *Verified alerts* notify the question author.
  3. *CR alerts* are aggregated to prevent notification fatigue.
  4. *Deep linking* scrolls and expands the drawer automatically.
  5. *Mute Toggles* allow users to opt out of noisy threads.
* **Verified Lockout**: Once a comment is verified by the CR, the student author loses the ability to edit or delete it (only the CR can delete or un-verify it).
* **Autocomplete Mentions**: Typing `@` inside the comments drawer displays a floating suggestion panel listing section members (excluding self) which filters dynamically and inserts selected names automatically.

---

## 2. Database Schema & Performance Safeguards

We will introduce two new core tables and one relationship table for notification management. 

### A. Table Definitions

```sql
-- 1. Emoji Reactions Table (Unified Unique selection)
CREATE TABLE public.announcement_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji           TEXT NOT NULL CHECK (char_length(emoji) <= 8),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user is restricted to exactly one active reaction per announcement
  UNIQUE(announcement_id, user_id)
);

-- Index for speedy reaction aggregations
CREATE INDEX idx_announcement_reactions_lookup ON public.announcement_reactions(announcement_id);

-- 2. Q&A Comments Table
CREATE TABLE public.announcement_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         VARCHAR(500) NOT NULL CHECK (char_length(content) >= 1),
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for chronological listing inside Q&A feeds
CREATE INDEX idx_announcement_comments_lookup ON public.announcement_comments(announcement_id, created_at ASC);

-- 3. Thread Mute Subscriptions Table
CREATE TABLE public.announcement_thread_mutes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(announcement_id, user_id)
);
```

---

### B. Row Level Security (RLS) Policies

All tables carry strict RLS policies to guarantee section-scoped isolation (ADR-004).

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_reactions
Policy name: Enable read access to reactions for section members
SQL:
```sql
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
```
Plain English: Allows any student or CR to read reactions on an announcement if that announcement belongs to their own academic section.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_reactions
Policy name: Enable reaction creation/update for self in same section
SQL:
```sql
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
```
Plain English: Allows a user to insert/UPSERT their own reaction on an announcement belonging to their section.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_reactions
Policy name: Enable reaction deletion for self
SQL:
```sql
CREATE POLICY "Enable reaction deletion for self"
ON public.announcement_reactions
FOR DELETE
USING ( auth.uid() = user_id );
```
Plain English: Allows a user to remove their own emoji reaction.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_comments
Policy name: Enable read access to comments for section members
SQL:
```sql
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
```
Plain English: Allows any section member to see comments posted under announcements in their section.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_comments
Policy name: Enable comment creation for self in same section
SQL:
```sql
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
```
Plain English: Allows a user to post a comment in their own section. The comment must default to `is_verified = false`.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_comments
Policy name: Enable comment deletion for author or CR
SQL:
```sql
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
  ) -- CR can delete any comment in their section
);
```
Plain English: Allows the author of the comment (only if it is NOT verified) OR any CR of that announcement's section to delete the comment.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_comments
Policy name: Enable CR to verify comments
SQL:
```sql
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
```
Plain English: Allows only a CR of the section to toggle the `is_verified` status of a comment, while preventing edits to other columns.
---

---
RLS POLICY PROPOSED - require confirm before apply
Table: announcement_thread_mutes
Policy name: Enable user to manage own thread mutes
SQL:
```sql
CREATE POLICY "Enable user to manage own thread mutes"
ON public.announcement_thread_mutes
FOR ALL
USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );
```
Plain English: Allows users full control to mute or unmute notification threads for specific announcements.
---

---

## 3. High-Fidelity Frontend & Interactive UX

### A. Overhauled Announcements Page Card (Vertical Flow Layout)
We discard the legacy two-column structure (`75%/25%` layout) in favor of a cohesive vertical block layout optimized for legibility and visual rhythm:
* **Card Outer Boundary**: Features a curved edge (`border-radius: var(--radius-lg)`), semi-transparent glass background (`var(--bg-surface)`), and a category-coded color outline (e.g. ruby red border for `Critical`, violet for `Academic Exam`, light blue for `General Announcement`). Includes subtle scaling transitions on hover (`transform: scale(1.015)`) for responsiveness.
* **Metadata Row (Header)**: Category pill tag + Deadline badge aligned on the left. The CR actions (`Trash` and `Tracking Receipts`) are grouped on the far right.
* **Spacious Title**: Spans full-width with a bold display typography (`font-weight: 700`, `font-size: 16px`, `line-height: 1.3`).
* **In-Place Truncation & Expansion (Option A)**:
  * Descriptions longer than 3 lines are capped with a standard CSS `-webkit-line-clamp: 3` block and a fading glassmask overlay.
  * Below the text, a clean `Read More` trigger (with a small caret chevron) is displayed.
  * Clicking `Read More` expands the container **in-place** with a smooth CSS height transition. The text changes to `Show Less` and chevrons rotate dynamically.
* **Attachments Cards**: Mount in a full-width row or grid directly below the description.
* **Integrated Action Footer**: A bottom bar that stretches the card width, housing:
  * **Reactions Pill Hub** (left-aligned)
  * **Q&A Drawer Trigger Button** (middle-aligned)
  * **Acknowledge / Acked Pill** (right-aligned)

---

### B. Dashboard notices stack clean-up
* **Card Stack Layout**: Remove the bottom bar of reactions/Q&A trigger entirely from the notice cards on the dashboard. The card size remains fixed at `148px`, completely avoiding overlaps with carousels or scroll indicators below.
* **Expanded drawer capabilities**: In `DashboardPage.tsx`, render the complete `AnnouncementReactions` and `AnnouncementCommentTrigger` components inside the `selectedAnn` expanded detailed bottom-sheet drawer! Tapping a dashboard card opens the sheet, which fully loads all reactions and commenting capabilities in a safe space.

---

### C. Circular `+` Button Popover & Native Emoji Keyboard Link
* **Popover layout**: Tapping the smiley face or `+` button in the reactions hub opens a floating glassmorphic popover displaying:
  * **6 Quick-Select Emojis** (👍, ❓, 🚀, 👀, 🎉, 👎).
  * A vertical dividing line.
  * A circular button containing a Lucide `Plus` icon.
* **Keyboard Linkage**:
  * Tapping the circular `+` button programmatically focuses a hidden, overlaying `<input type="text" />` inside the popover.
  * Focusing an input inside a direct click handler instantly triggers the device's native virtual keyboard emoji selectors.
  * Once the user inputs a custom emoji from their keyboard pack, it triggers `onChange`, registers the reaction on the backend, closes the popover, and clears the input state immediately.

---

### D. Comments Drawer Styling & Autocomplete Mentions (`@`)
* **Form styling**: The input area has a fully transparent background (`background: 'none'`), removing any grey/white blocks. The `textarea` has a deep solid background (`var(--bg-base)`) for high-contrast, zero-bleed text entry.
* **Floating Autocomplete Panel**:
  * Employs the `useSectionMembers()` query hook to fetch list of section members on mount.
  * When the user types `@`, a floating glassmorphic autocomplete panel appears above the input form.
  * **Filtering**: The panel dynamically lists matching names as they type (e.g. `@him` filters names containing "him"), **strictly excluding the user's own name** to prevent self-mentioning noise.
  * Show roll number and CR badge in the selection cards.
  * **Insertion**: Tapping any member in the list inserts their clean, formatted name (e.g., `@HimanshuSaini `) into the text box and returns focus to the cursor.

---

## 4. Real-Time Sync & Notifications Pipeline

### A. Real-Time State Management
Zustand or TanStack Query will listen directly to changes via Supabase Realtime channels. Every hook instance appends a random unique suffix to the channel name (`supabase.channel("channel-name-[id]-[random-suffix]")`) to avoid callback collisions:
```typescript
const uniqueId = Math.random().toString(36).slice(2, 9);
const channel = supabase
  .channel(`announcement-qa-realtime-${announcementId}-${uniqueId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reactions', filter: `announcement_id=eq.${announcementId}` }, handleReactionUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${announcementId}` }, handleCommentUpdate)
  .subscribe();
```

---

### B. Push Notification Worker (Edge Functions)
We will create a Supabase Edge Function `notify-qa-events` triggered by a database webhook on `announcement_comments` inserts or updates.

1. **Verify Notification Path**:
   * If a comment's `is_verified` becomes `true`: Send a push notification immediately to the comment author.
2. **Peer Reply Notification Path**:
   * If a student posts a comment containing `@Name`:
     * Look up the mentioned student's ID. If not muted, send a push notification.
3. **CR Aggregated Notification Path**:
   * If a student posts a new comment/question:
     * Aggregate notifications to the CR within a 15-minute window.
4. **Deep Linking Payload**:
   * Push notification packages will carry an actionable data payload:
     `{ "url": "/announcements?id=[announcement_id]&expand_qa=true&focus_comment=[comment_id]" }`
   * The frontend `AnnouncementsPage.tsx` router listener will parse these search params on mount, scroll to the targeted element, and open the drawer automatically.

---

## 5. Verification Plan

### A. Automated Integration Tests
* **RLS Verification**: Run Postgres tests validating section boundaries.
* **Lockout Validation**: Verify that attempts to delete or edit an `is_verified = true` comment by student authors fail with an RLS database block.
* **Vite Production Compile**: Ensure that all changes build cleanly without compilation errors (`npm run build`).
* **ESLint Validation**: Check that our code additions introduce zero lints (`npm run lint`).

### B. Manual Visual Checks
1. **Vertical Flow Cards**: Validate that cards expand/collapse smoothly in-place upon tapping `Read More`.
2. **Dashboard Cleanliness**: Tapping stack cards correctly opens the detailed bottom drawer housing active commenting and reactions, without any bottom-bar carousel overlaps.
3. **Plus Emoji keyboard**: Click the circular `+` button in the popover, verify that the virtual keyboard opens instantly, and custom selected emojis increment counts correctly.
4. **Mention Autocomplete**: Write `@` in the comment textarea and confirm the floating member suggestions overlay appears, excludes your own name, filters as you type, and auto-completes the username cleanly on tap.
