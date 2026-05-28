# Design Specification: Announcements Emoji Reactions & High-Signal Q&A

This document specifies the database architecture, security policies, real-time synchronization, and premium visual components to transform ClassHub announcements from a one-way communication channel into a highly engaging, two-way collaborative FAQ.

---

## 1. Product Requirements & Scope

* **Reactions**: Allows students and CRs to express lightweight, non-verbal feedback using 6 standardized academic emojis.
* **Public Q&A Comments**: Collapsible, chronological public comment drawer under each notice for Q&A, reducing repeat queries for CRs.
* **Verified Answers**: A CR can mark any peer or CR comment as "Verified." Verified answers receive distinct glowing visual cues.
* **Refined Notifications**: Real-time push alerts that keep threads interactive while avoiding alert fatigue:
  1. *Peer replies* notify the question author.
  2. *Verified alerts* notify the question author.
  3. *CR alerts* are aggregated to prevent notification fatigue.
  4. *Deep linking* scrolls and expands the drawer automatically.
  5. *Mute Toggles* allow users to opt out of noisy threads.
* **Verified Lockout**: Once a comment is verified by the CR, the student author loses the ability to edit or delete it (only the CR can delete or un-verify it).

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

### A. The Emoji Reactions Bar
* **Location**: Placed at the bottom-left edge of each announcement card.
* **Component flow**:
  * **Dynamic Visibility**: If an announcement has **zero reactions**, no reaction pills are displayed. Instead, only a single desaturated smiley-face icon button is shown next to the Q&A trigger.
  * **Reaction Pills**: If reactions exist, display active reactions in rounded pills (e.g. `👍 14`, `❓ 2`).
  * If the user reacted to a pill, it lights up with a subtle glowing indigo/emerald border (`border: 1.5px solid var(--accent-primary)`) and a soft opacity fill.
  * Clicking a pill optimistic-updates the count and executes the upsert/retract logic.
  * **Add Reaction popover**: Clicking the Smiley face or `+` button triggers a compact bubble popover displaying:
    1. **6 Quick-Select Emojis** (👍, ❓, 🚀, 👀, 🎉, 👎).
    2. A text input box styled as `➕ Custom...` that accepts a single character. Clicking this input field triggers the user's native mobile/desktop virtual keyboard, allowing them to type or select **any custom emoji from their own emoji pack/keyboard**.
    3. Entering any custom emoji registers it as their reaction on the backend instantly, optimizing PWA bundles to 0kb external library footprint!

### B. Collapsible Q&A Drawer
* **Visual Trigger**: A collapsible counter `💬 5 Questions & Comments` placed at the bottom-right of the card.
* **Action Header**:
  * If verified comments exist, a top banner mounts: `💡 Verified answer available. [Jump to Answer]`.
  * Clicking it cycles focus smoothly (`scrollIntoView`) down to each highlighted verified card in order.
* **Flat Thread Feed**:
  * Chronological cards. Authors display Name + Section Roll Number (e.g. `Rohan Mehta (P-12)`).
  * CR authors carry a specialized gold background badge: `[CR]`.
  * Verified cards are highlighted with a glowing green border (`border: 1px solid rgba(16,185,129,0.3)`) and an emerald checkmark header: `✓ Verified Answer`.
* **Actions**:
  * **Reply**: Tapping `Reply` on any card auto-appends `@Rohan Mehta ` to the input box and focuses it.
  * **Verify (CR Only)**: If the logged-in user is a CR, they see a toggle button: `✓ Verify`. Tapping it triggers an RLS-validated update converting the comment into the highlighted green verified block.

### C. Input & Interaction Safeguards
* **Limit Indicator**: Character counter counts down from **500 characters** max.
* **Submission Throttle**: A client-side **3-second debounce throttle** blocks double-clicking or rapid question submissions.
* **Mute Toggle**: A small bell icon is situated near the Q&A toggle. Tapping it toggles the notification mute state.

---

## 4. Real-Time Sync & Notifications Pipeline

### A. Real-Time State Management
Zustand or TanStack Query will listen directly to changes via Supabase Realtime channels. If a new reaction or comment is added/removed/verified, the component updates instantly:
```typescript
const channel = supabase
  .channel(`announcement-qa-${announcementId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reactions', filter: `announcement_id=eq.${announcementId}` }, handleReactionUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${announcementId}` }, handleCommentUpdate)
  .subscribe();
```

### B. Push Notification Worker (Edge Functions)
We will create a Supabase Edge Function `notify-qa-events` triggered by a database webhook on `announcement_comments` inserts or updates.

1. **Verify Notification Path**:
   * If a comment's `is_verified` becomes `true`: Send a push notification immediately to the comment author:
     * Title: `✓ Verified Answer`
     * Message: `[CR] verified your question in: "[Announcement Title]"`
2. **Peer Reply Notification Path**:
   * If a student posts a comment containing `@Name`:
     * Look up the mentioned student's ID.
     * If they are not muted, send a push notification:
       * Title: `New Reply`
       * Message: `[Author Name] replied to you: "[Excerpt]"`
3. **CR Aggregated Notification Path**:
   * If a student posts a new comment/question:
     * Look up if a notification was sent to the CR in the last 15 minutes.
     * If yes: Do nothing (aggregate).
     * If no: Send a push notification:
       * Title: `New Question`
       * Message: `Students are asking questions in: "[Announcement Title]"`
4. **Deep Linking Payload**:
   * Push notification packages will carry an actionable data payload:
     ```json
     {
       "url": "/announcements?id=[announcement_id]&expand_qa=true&focus_comment=[comment_id]"
     }
     ```
   * The frontend `App.tsx` or router listener will parse these search params on mount, scroll to the targeted element, and open the drawer automatically.

---

## 5. Verification Plan

### A. Automated Integration Tests
* **RLS Verification**: Run Postgres integration tests validating that students cannot insert comments for announcements in other sections.
* **Lockout Validation**: Run test trying to delete an `is_verified = true` comment under a student's token; assert that Postgres returns an RLS violation error.

### B. Manual Visual Checks
1. **Fluid Reactions**: React with 👍, select 🚀, and ensure the 👍 reaction count decrements while the 🚀 reaction increments smoothly in a single fluid transition.
2. **Cyclic Jump**: Mark two comments as verified. Click `Jump to Answer` repeatedly, confirming that focus smoothly alternates between the two highlighted cards.
3. **Mute & Push**: Mute a thread, have a mock user reply, and verify that no push notifications arrive. Unmute, reply, and verify instant delivery.

---
