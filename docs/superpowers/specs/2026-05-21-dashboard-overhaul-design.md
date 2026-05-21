# Design Spec: Dynamic Academic Hero Overhaul

This specification describes the overhaul of the ClassHub dashboard to resolve severe visual redundancies in attendance tracking, unify upcoming deadlines, and introduce an active, threshold-aware academic advisor.

---

## 1. Unified State Aggregation (Deadlines Telemetry)

To replace the limited assignment-only deadline card, the dashboard will dynamically aggregate pending milestones from three separate domain tables:

### Eligible Source Sets
1.  **Assignments**: Outstanding assignments from the user's section.
    *   *Filter Criteria*: `status !== 'submitted'` AND `dueDate` is not expired.
    *   *Source Hook*: `useAssignments`
    *   *Icon*: `ClipboardList`
2.  **Announcements**: Class announcements containing action-oriented deadlines.
    *   *Filter Criteria*: `isAcknowledged === false` AND `deadline` exists AND is not expired.
    *   *Source Hook*: `useAnnouncements`
    *   *Icon*: `Megaphone`
3.  **Polls**: Pending section polls where the student has not yet cast a vote.
    *   *Filter Criteria*: `status === 'active'` AND `userVotes.length === 0` (or `userVote === null`) AND `closesAt` is not expired.
    *   *Source Hook*: `usePolls`
    *   *Icon*: `BarChart2`

### Unified Priority Logic
A unified deadlines array is constructed by merging the above lists, where each element is mapped to:
```typescript
interface UnifiedDeadline {
  id: string;
  title: string;
  type: 'assignment' | 'announcement' | 'poll';
  dueDate: string; // Mapping standard deadline/closesAt/dueDate field
  route: string;
  icon: any; // Lucide icon reference
}
```

*   **Primary Hero Deadline**: The item with the absolute earliest deadline (`dueDate`) is rendered as the primary countdown card on the right-hand panel of the Hero Banner.
*   **Urgency Levels**:
    *   `< 24 Hours`: High Urgency (Pulsing Red/Orange glow, "Due Soon" badge).
    *   `< 72 Hours`: Medium Urgency (Amber glow, "Approaching" badge).
    *   `>= 72 Hours`: Normal Urgency (Blue/Violet glow, "Upcoming" badge).

### Quick-Link Category Navigation
Underneath the primary deadline, we render subtle, premium action icons for categories that have other outstanding due items. This acts as a unified hurdles hub:
*   If outstanding assignments count > 0: `ClipboardList` icon shortcut linking to `/app/assignments`.
*   If unacknowledged announcements count > 0: `Megaphone` icon shortcut linking to `/app/announcements`.
*   If unanswered polls count > 0: `BarChart2` icon shortcut linking to `/app/polls`.

---

## 2. Dynamic Threshold-Aware Attendance Panel (Left Panel)

To resolve the duplicate attendance indicators, the standalone bottom `AttendanceWidget` is completely removed, and its logic is consolidated into the left-hand panel of the **Academic Hero Banner**.

The attendance display becomes context-aware, changing based on the student's actual attendance standing:

### Standing Metrics Calculation
*   **Overall Percentage**: `overallPercent` from `useAttendance`.
*   **Attended Count**: Sum of `present` across all subjects.
*   **Total Count**: Sum of `total` across all subjects.
*   **Consecutive Recovery Needed**: `Math.max(0, Math.ceil((0.75 * overallTotal - overallAttended) / 0.25))`
*   **Safe Skips Allowed**: `Math.max(0, Math.floor((overallAttended - 0.75 * overallTotal) / 0.75))`

### Adaptive Layout States
1.  **Elite/Safe Standing (>= 75%)**:
    *   *Visuals*: Premium cyan/emerald circular SVG progress ring (`DonutRing` or custom visual) with smooth dash-array mapping.
    *   *Copy*: Shows overall percent, `attended / total` classes, and positive, clean status: `"Safe Standing. You can skip up to X classes safely."`
    *   *Interaction*: Tapping navigation goes directly to `/app/attendance`.
2.  **Warning/Critical Standing (< 75%)**:
    *   *Visuals*: Thick amber/red warning border with a soft pulse neon shadow.
    *   *Copy*: Shows overall percent and active recovery advisory: `"Critical Standing! You must attend at least Y consecutive classes to recover."`
    *   *Advisor Diagnostics Accordion*: Renders a collapsible **"Diagnose Issues ▼"** trigger directly in the panel. When tapped, it smoothly expands an inline list of all subjects, showing their name, current percentage, and individual color-coded health (Safe, Warning, Critical). This lets the user see exactly which courses are putting their attendance in danger without leaving the dashboard.

---

## 3. UI/UX Structure & Style Tokens

### Premium Aesthetics
*   **Container Backdrop**: Ultra-premium glassmorphism utilizing high-end CSS values:
    ```css
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    ```
*   **Dividers**: A thin vertical translucent line (`1px solid rgba(255,255,255,0.06)`) separating the Left (Attendance) and Right (Deadline) panels on tablet/desktop widths, stacking vertically on mobile.
*   **Typography**: Emphasizes `Space Grotesk` or `DM Sans` headings, high-contrast text color mappings, and uppercase tabular-number indicators.

---

## 4. Verification Plan

### Automated Verification
*   Verify that `npm run build` succeeds without TypeScript compiler issues.
*   Run the unit test suite (`npm test`) to ensure dashboard component edits do not break existing tests.

### Manual Verification
*   **Data Aggregation**: Verify that answering a poll or submitting an assignment immediately updates the "Next Deadline" card to show the next closest milestone.
*   **Threshold States**: Mock high and low attendance data (e.g. >=75% vs <75%) to verify the active warning visuals and consecutive class recovery text are calculated correctly.
*   **Advisor Accordion**: Open the dashboard under a low-attendance user account, tap the "Diagnose Issues" toggle, and verify the course-by-course list expands smoothly with correct percentages.
