# Spec: Announcement Comments CRUD (Editing Capabilities)

This specification defines the design and implementation of the comment editing capabilities (Q&A CRUD Phase 1) inside ClassHub. It enforces a strict **15-minute edit window** for original authors (if their comment has not been verified by a CR) and displays an **`(Edited)`** indicator in the UI.

---

## 1. Product Requirements & Design Goals

1. **Self-Editing Capabilities:** A student or CR author can edit their own comment text directly from the Q&A comments drawer.
2. **Strict 15-Minute Edit Window:** Original authors can only edit their comment content within 15 minutes of creation. This is secure and database-enforced.
3. **No Editing Verified Comments:** If a CR has already marked a comment as a "Verified Answer" (for Q&A integrity), the author is locked out from editing it.
4. **Edit Accountability:** Displays an `(Edited)` text next to the friendly time-ago stamp in the comments feed if the comment has been updated.
5. **No Layout Shift Editing:** Editing is done inline directly inside the comment card, shifting into a styled `<textarea>` without launching modal windows or breaking focus.

---

## 2. Technical Architecture & Database Design

### A. Database Schema Migration
We will add a TIMESTAMPTZ column `edited_at` to the `public.announcement_comments` table to track updates.

```sql
ALTER TABLE public.announcement_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;
```

### B. Secure RLS Update Policies
We will drop any redundant or overly broad update policies and implement two highly specific, isolated update policies:

1. **Author Content Policy (15-Minute Window):**
   ```sql
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
   ```
   * *Plain English:* Restricts students/authors to only update `content`. If they attempt to update after 15 minutes, or edit a verified comment, or alter `is_verified` or `author_id`, the database rejects it.

2. **CR Verification Policy:**
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
     id = id
     AND announcement_id = announcement_id
     AND author_id = author_id
     AND content = content
     AND created_at = created_at
   );
   ```
   * *Plain English:* Allows CRs to verify comments. Restricts them from altering `content` or other metadata columns.

### C. Automatic Timestamping Trigger
A trigger handles setting `edited_at` automatically on the write path:
```sql
CREATE OR REPLACE FUNCTION public.handle_announcement_comment_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content <> OLD.content THEN
    NEW.edited_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_announcement_comment_update
  BEFORE UPDATE ON public.announcement_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_announcement_comment_update();
```

---

## 3. Frontend Component & Hook Design

### A. The `useEditComment` Mutation Hook
Located inside `src/hooks/useAnnouncementsQA.ts`:
```typescript
export function useEditComment(announcementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { error } = await supabase
        .from('announcement_comments' as any)
        .update({ content: content.trim() })
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcement_comments', announcementId] });
      showToast('Comment updated successfully', 'success');
    },
    onError: (err: any) => {
      const isLockout = err.message?.includes('Verified Lockout') || err.code === '42501' || err.status === 401;
      if (isLockout) {
        showToast('Editing locked out: Time window expired or answer verified.', 'error');
      } else {
        showToast('Failed to update comment', 'error');
      }
    },
  });
}
```

### B. Comments Drawer Inline UI
Inside `src/components/announcement-qa/AnnouncementCommentsDrawer.tsx`:
* **Edit Trigger Button:** Renders an elegant Pencil/Edit icon (Lucide `Pencil`) next to the Delete button *only if* `isSelf === true`, `comment.isVerified === false`, and `Date.now() - new Date(comment.createdAt).getTime() <= 15 * 60 * 1000`.
* **State Management:**
  * `editingCommentId` (string | null): Tracks the comment currently being edited.
  * `editInputVal` (string): Standard text state for the active edit input.
* **Inline Form Rendering:**
  * When in edit mode, the raw text switches to a styled `<textarea>` and displays "Save" and "Cancel" buttons.
  * Character limit of 500 is checked dynamically.
* **Accountability Text:**
  * Display a subtle, styled `• (Edited)` text inside the comment meta row if `comment.editedAt` is present.

---

## 4. Proposed File Changes

### 1. [NEW] [20260601000000_enable_comment_editing.sql](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/supabase/migrations/20260601000000_enable_comment_editing.sql)
Create the database migration containing the new `edited_at` column, trigger, and secure RLS update policies.

### 2. [MODIFY] [useAnnouncementsQA.ts](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/hooks/useAnnouncementsQA.ts)
* Update the `QAComment` interface to include `editedAt: string | null`.
* Incorporate `edited_at` into the select query inside `useAnnouncementComments` query hook.
* Create and export the new `useEditComment(announcementId)` mutation hook.

### 3. [MODIFY] [AnnouncementCommentsDrawer.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/announcement-qa/AnnouncementCommentsDrawer.tsx)
* Import `useEditComment` and add the Lucide `Pencil` icon.
* Implement inline textarea editing, "Save" / "Cancel" state triggers, and the `• (Edited)` indicator.
