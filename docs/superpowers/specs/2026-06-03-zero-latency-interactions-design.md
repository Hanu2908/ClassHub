# Spec: Premium Tactile Interactions & Zero-Latency Submissions

Implement tactile haptic feedback and zero-latency submission workflows to elevate ClassHub's PWA interactions to a premium mobile-native standard.

---

## 1. Context & Objectives

Academic PWAs must feel fast and responsive under daily usage. Currently:
- **Poll Voting**: Performs optimistic updates, but lacks tactile feedback and success prompts.
- **Assignment Submissions**: Hits the network first, causing a loader delay before updating card status, and provides no way for a student to undo a submission clicked by mistake.
- **ERP Attendance Import**: Confirmation hits the database first and blocks, showing a loader, before transitioning the stats and UI.

This specification addresses these limits by introducing a micro-haptic click profile, optimistic submission/import update loops, and an interactive "Undo" toast cue.

---

## 2. Proposed Changes

### A. New Component/Utility: `src/lib/haptics.ts`
Establish a platform-safe vibration integration layer that checks features before running.

- **`lightClick()`**: `10ms` pulse. Used for positive selection triggers (e.g. toggling a checkbox, selecting a poll option).
- **`heavyClick()`**: `20ms` pulse. Used for deselecting an item, removing a vote, or opening details.
- **`doublePulse()`**: `[8ms, 50ms, 8ms]` pulse. Used for major actions (e.g. marking assignment as submitted, confirming ERP sync).

---

### B. Modified Hook: `src/hooks/useAssignments.ts`
Enhance assignments mutations to manage cache optimistically and introduce the undo-submission path.

1.  **Modify `useSubmitAssignment`**:
    - Add `onMutate` to queryClient to cancel incoming assignments refetches and update `status: 'submitted'` and `submittedLink: 'marked-submitted'` immediately.
    - Add `onError` to restore the previous cache snapshot if the API call fails.
2.  **Add `useUnsubmitAssignment`**:
    - Introduce a mutation to delete the user's submission row in Supabase:
      ```typescript
      supabase.from('submissions').delete().eq('assignment_id', assignmentId).eq('student_id', userId)
      ```
    - Implement `onMutate` to optimistically revert `status: 'pending'` and clear the submission link.

---

### C. Modified Page: `src/pages/app/AssignmentsPage.tsx`
Hook up the haptics and the Undo toast trigger.

- When clicking "Mark as Submitted":
  1. Trigger `haptics.doublePulse()`.
  2. Invoke `submitMutation.mutateAsync({ assignmentId: a.id, link: 'marked-submitted' })`.
  3. Render an active Toast containing an **"Undo" button** and a 4-second progress indicator bar.
  4. If "Undo" is tapped:
     - Trigger `haptics.lightClick()`.
     - Dismiss toast.
     - Invoke `unsubmitMutation.mutateAsync({ assignmentId: a.id })`.

---

### D. Modified Page: `src/pages/app/PollsPage.tsx`
Add tactile feedback to poll voting.

- Update `handleVote`:
  - If selecting a poll option (`isSelected` is false): trigger `haptics.lightClick()`.
  - If deselecting/clearing a poll option (`isSelected` is true): trigger `haptics.heavyClick()`.

---

### E. Modified Page: `src/pages/app/AttendancePage.tsx` & `src/hooks/useAttendance.ts`
Add optimistic update transitions and haptic triggers to the bulk ERP confirmation button.

1. **Modify `useBulkUpsertAttendance`**:
   - Add `onMutate` to cancel the `attendance` query and optimistically construct the new list of attendance subjects, overall percentage, and logs based on the upserted list.
   - Close the BottomSheet and reset state immediately on clicking the confirm button.
   - Rollback the state `onError` if the upsert encounters an API failure.
2. **Tactile Confirm**:
   - Trigger `haptics.doublePulse()` when the user taps the **Confirm & Update** button inside the ERP BottomSheet.

---

## 3. Verification Plan

### Automated & Manual Checks
1. **Compilation**: Verify build completes cleanly using `npm run build`.
2. **Haptic Verification**: Test on a mobile browser or PWA install to confirm vibration pulses match expected profiles on voting, submitting, and importing.
3. **Optimistic State Verification**: Verify that clicking "Confirm & Update" in ERP import closes the sheet immediately and transitions the overall percentage gauge/stats instantly.
4. **Undo Integrity**: Click "Mark as Submitted" → click "Undo" → verify database table `submissions` has no row inserted for the assignment.
