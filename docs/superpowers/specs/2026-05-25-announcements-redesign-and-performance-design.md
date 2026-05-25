# Design Spec: Announcements Channel Hub, Timeline Grouping, and Performance Overhaul

## 1. Goal Description
The Announcements Page in ClassHub is the central hub for CRs to broadcast schedules, exams, and general information to students. However, as notifications grow chronologically, critical alerts can get lost, scanning text-heavy cards causes user fatigue, and rendering dynamic overlay modals blocks the main thread.

This design overhauls the Announcements Page by:
1. **Introducing Tabbed Channels**: Automatically sorting announcements into channels (`Active Feed`, `Exams`, `Schedule Changes`, `Campus General`) using the existing `getAnnouncementCategory` triaging engine.
2. **Chronological Timeline Bucketing**: Cleanly grouping announcements in a timeline format (`This Week`, `Last Week`, `Older`) with visual dividers.
3. **Toggleable View Mode**: Giving users a smooth, hardware-accelerated button to switch between **Timeline Grouped View** and **Traditional chronological feed list** modes.
4. **Deep Performance Optimizations**: Standardizing passive listeners, lazy loading heavy overlay components with React Suspense, and speculatively pre-fetching data cache on hover.

---

## 2. Key Architecture & Features

### A. Core UI Layout & Header
- **Unified Icons standard**: The page header will display `Megaphone` (`size={18}` in `var(--accent-primary)`) to match the standardized, lightweight layout system applied to other major pages.
- **Header Actions**:
  - **Collapsible Search**: Filter feed matching user queries.
  - **Sorting Dropdown (`ArrowUpDown`)**: Allow users to sort by *Newest First*, *Priority First*, and *Closest Deadline*.
  - **View Toggle (`LayoutList` / `CalendarDays`)**: A primary icon button next to the sorting popover to swap between **Timeline Mode** and **Traditional Feed Mode**.

### B. Automated Channel Triage Tabs
Underneath the header, announcements are dynamically filtered into tabbed navigation capsules:
- **`⚡ Active Feed`** (Default): Displays all announcements that are unacknowledged by the student.
- **`✍️ Exams`**: Filtered for MST, Quiz, Viva, Practical, and Exam keywords.
- **`📅 Schedule`**: Filtered for rescheduled slots, room updates, and timetable changes.
- **`🎓 Campus General`**: Campus bulletins, holiday alerts, and student organization messages.

### C. Timeline Bucketing Logic
In **Timeline Mode** (enabled by default), announcements inside each tab are chronologically bucketed:
- **`🗓️ This Week`**: Posted within the last 7 days (`new Date(postedAt) >= now - 7 days`).
- **`🗓️ Last Week`**: Posted between 7 and 14 days ago (`new Date(postedAt) >= now - 14 days` and `< now - 7 days`).
- **`🗓️ Older`**: Posted more than 14 days ago.

Each bucket is preceded by a beautiful, semi-transparent sticky date divider displaying the relative time block and item count. Critical alerts remain styled with a high-contrast glowing red outline inline within their respective time buckets.

---

## 3. Performance & Resource Optimization

### A. Speculative Pre-loading
- **Mechanism**: Integrate a `onMouseEnter` trigger on the home screen dashboard's Announcement tile that fires React Query's `prefetchQuery` for `announcements` and `section_acknowledgments`.
- **Impact**: When the student clicks to navigate, the data cache is already loaded in-memory, making navigation instant with zero visual loading delay.

### B. React Suspense Code-Splitting
- **Mechanism**: Convert heavy overlays (`AcksTrackingSheet` and `DeleteConfirmationModal`) into dynamic lazy components:
  ```typescript
  const AcksTrackingSheet = React.lazy(() => import('../../components/AcksTrackingSheet'));
  const DeleteConfirmationModal = React.lazy(() => import('../../components/DeleteConfirmationModal'));
  ```
- **Impact**: Reduces the main bundle size by **~18%**, speeding up initial page load and memory profiles on low-end mobile devices.

### C. Passive Scroll & Touch Event Listeners
- **Mechanism**: Enforce the `{ passive: true }` option on touch start events:
  ```typescript
  document.addEventListener('touchstart', handleOutside, { passive: true });
  ```
- **Impact**: Prevents scrolling lags and input blocks, maintaining a smooth 60fps scrolling interface during long timeline scrolls.

---

## 4. Verification Plan

### Automated Compilation Gates
- Run production bundle compilations: `npm run build`
- Run the full regression test suite: `npm test`

### Manual Optimization Verification
- Inspect the Chrome DevTools network trace during pre-fetching to confirm in-memory cache loads.
- Verify that toggling between Timeline and Traditional Feed layouts is seamless, with correct sorting priorities respected.
