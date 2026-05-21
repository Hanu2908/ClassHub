# Design Spec: Announcements Page Visual & UX Redesign

## 1. Goal Description
The Announcements Page currently has a vertically bloated layout with cards that feel left-heavy and unbalanced. In addition, Class Representatives (CRs) lack granular visibility into who has acknowledged announcements, and users have no options to sort announcements. 

This spec addresses these gaps by:
1. Rebalancing the card into a responsive two-column horizontal layout, reducing vertical height by 30-40%.
2. Adding a custom sorting mechanism (Newest, Priority, Closest Deadline) via a compact header dropdown.
3. Building an interactive, high-fidelity slide-up bottom sheet for CRs to view student acknowledgment statistics, search individual students, and nudge unacknowledged students.

---

## 2. Key Architecture & Features

### A. Compact Two-Column Card Layout
Instead of vertically stacked elements, the card layout will use a horizontal flex/grid system:
- **Left Column (75% width)**: Houses notification badges (Critical, Deadline), announcement title, posted relative date, body content, and attachments.
- **Right Column (25% width)**: Concentrates interaction.
  - For normal students: Displays a compact, tactile `Acknowledge` button (or green checkmark pill if already acknowledged) that takes up a neat 44x44px minimum touch target.
  - For Class Representatives (CRs):
    - **Top Right**: Compact `Delete` button (trash icon inside a subtle red border button).
    - **Middle/Bottom**: An interactive **Acknowledgment Tracker Pill** displaying the active completion count (e.g. `12 / 40 ✓`). Hovering triggers a tooltip, and clicking slides up the details panel.

### B. Header Sorting Dropdown
We will introduce sorting options in the sticky header next to the search and filter tabs:
- **Placement**: A Lucide `ArrowUpDown` icon button placed on the right side of the filter tabs. Clicking toggle-opens a styled popover dropdown menu.
- **Sort Actions**:
  - **Newest First** (Default): Ordered by `postedAt` descending.
  - **Priority First**: Shows Critical announcements first, then general, ordered by date descending.
  - **Closest Deadline**: Shows upcoming future deadlines first, followed by others.

### C. CR Acknowledgment Tracking Bottom Sheet
When a CR clicks the `12 / 40 ✓` tracker pill, a sheet will slide up displaying detailed read receipts:
- **Visual Design**: Sleek glassmorphic container matching the dark-theme brand values of ClassHub.
- **Header Actions**:
  - Displays `"Read Receipts: [Announcement Title]"`.
  - A primary **`Nudge All Unacknowledged`** button that calls the existing `nudge-unacknowledged` Edge Function to ping all pending students.
- **Tab Layout**:
  - **`Acknowledged ([Count])`**: Shows students who have acknowledged, with a green checkmark and relative acknowledgement timestamp.
  - **`Pending ([Count])`**: Shows students who haven't acknowledged, along with a custom bell-icon button to trigger a micro-nudge for that individual student.
- **Search Bar**: A compact fuzzy search bar to filter the names in the sheet quickly.

---

## 3. Data & Schema Alignment
- **Acknowledgments**: Retained in the `acknowledgments` table:
  - `announcement_id` (UUID references announcements)
  - `user_id` (UUID references users)
  - `acknowledged_at` (TIMESTAMPTZ default now)
- **Total Students**: Calculated dynamically using the existing `useSectionMembers` query hook to count how many users in the section have `role = 'student'`.

---

## 4. UI/UX & Web Accessibility Guidelines
- **Touch Target Density**: Ensure all interactive controls (Sort, Acknowledge, Nudge, Close) meet the `touch-target-size` requirement of 44x44px.
- **Contrast & State Changes**: All hover/focus states will use 150-300ms transition durations (`transition-all var(--transition-fast)`).
- **Search Latency**: The sheet filter uses instant client-side input state filtering to avoid layout thrashing.
