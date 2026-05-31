# Design Spec: Premium UX & Stability Upgrades

We are implementing four highly curated quality-of-life and stability features inside ClassHub:
1. **PWA Draft Autosave System:** Offline-friendly local form auto-saving for CR notice/assignment creation.
2. **Submissions Verification Pipeline:** Visualizing the verified state (`cr_verified` field) on the student dashboard & assignments list.
3. **Double-Click Deduplication Guard:** Protecting forms, voting, and creation processes at both UI and mutation layers.
4. **Context-Aware Exact Timestamps:** Swapping basic relative dates with friendly, readable times (e.g., `"Today at 2:30 PM"`).

---

## 📐 1. PWA Draft Autosave System

### Concept
When a CR is filling out forms to create announcements or assignments, a sudden tab refresh, browser crash, or session timeout can lose their progress. An offline-friendly draft saving mechanism preserves their text state automatically.

### Technical Design
- **Storage Strategy:** Leverage standard browser `localStorage` to read/write active draft content. This keeps drafts completely offline-first with zero database overhead.
- **Save Trigger:** Bind input text-change hooks (`onChange` handlers) to debounced/direct sync calls writing to specific keys:
  - `classhub-draft-announcement`: Stores `{ title, body, priority }`
  - `classhub-draft-assignment`: Stores `{ title, subjectId, dueDate, description }`
- **Load Trigger:** On mounting the sheet containers (inside `CreateAssignmentSheet` and `SendNotificationSheet` in `AssignmentsPage.tsx` and `CRCommandPage.tsx` respectively), check if `localStorage` has any matching draft keys. If found, initialize form fields with these values and pop a lightweight, temporary toast notification: `"Unsaved draft restored ✓"`.
- **Destruction:** Once the mutation request succeeds (publication completes), delete the corresponding keys from `localStorage` cleanly.

---

## 📐 2. Student "Verified Safely ✓" Pipeline

### Concept
Currently, when a student submits an assignment, they only see `"Submitted"`. If the CR reviews and verifies it in the command center, the student has no direct visual awareness of this receipt confirmation, leading to academic anxiety. We will visually surface the verified state.

### Technical Design
- **Database Mapping:** Pull `cr_verified` from the backend `submissions` table inside the student's active query (`useAssignments` in `useSupabaseQuery.ts`).
  - Update `useAssignments` to select `cr_verified` in the inner select.
  - Expose `crVerified` boolean field inside the return array of assignments.
- **UX Pipeline States:**
  - **Pending:** Grey/Amber badge (`Pending`) showing they need to submit.
  - **Submitted (Pending Review):** Yellow badge (`Submitted`) showing they successfully submitted but the CR hasn't marked it verified yet.
  - **Verified Safely ✓:** Emerald-green badge with checkmark (`Verified Safely ✓`) showing that the CR has checked and confirmed receipt of the assignment.
- **UI Integrations:** Update [AssignmentsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AssignmentsPage.tsx) to map and style these statuses.

---

## 📐 3. Dual Deduplication Guard (UI + Mutation)

### Concept
High-latency mobile internet connections are vulnerable to double-taps on action buttons. This causes duplicate network requests, optimistic state jitters, or double database insertions.

### Technical Design
- **UI Locking:**
  - Bind `disabled={isPending}` to all submit buttons in form sheets, poll voting choices, and announcement acks.
  - Replace button texts with spinners (`<Loader2 className="animate-spin" />`) during mutation processes.
- **Mutation-Level Checking:**
  - Introduce an active transaction lock flag in optimistic actions inside `useSupabaseMutations.ts` or in client-side sync loops so that secondary triggers within 1.5 seconds of an active request are discarded silently.

---

## 📐 4. Context-Aware Exact Timestamps

### Concept
Relative terms like `"posted 2h ago"` or `"posted 3d ago"` can make it difficult for students to verify schedules or announcements against academic timetables. Showing precise friendly dates is more valuable.

### Technical Design
- **Global Helper Upgrade:** Refactor the global helper `timeAgo(iso)` in [Shared.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/Shared.tsx) to perform context-aware calculations:
  - If the posted date is today: return `"Today at HH:MM AM/PM"` (e.g. `"Today at 2:30 PM"`).
  - If the posted date was yesterday: return `"Yesterday at HH:MM AM/PM"`.
  - If older: return `"Day Month at HH:MM AM/PM"` (e.g., `"29 May at 10:15 AM"`).
- **Format Consistency:** All components rendering date/time values across notifications, announcements, and notice board modules will inherit this upgraded exact-formatting helper automatically.
