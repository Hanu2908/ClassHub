# Design Spec - Layout-Specific Loading Skeleton System

*   **Date**: 2026-05-25
*   **Author**: Antigravity AI
*   **Status**: Proposed

## 1. Goal & Rationale

Currently, when ClassHub fetches dynamic data from Supabase, several core pages (`SchedulePage`, `PollsPage`, `ManageSubjectsPage`, `CRCommandPage` submissions, `AttendancePage`, `AssignmentsPage`, and `AnnouncementsPage`) display a generic spinning Loader icon.

### The Problem
*   **Visual Disruption**: A spinner is a low-fidelity visual construct that does not communicate the structural context of the loading page.
*   **Cumulative Layout Shift (CLS)**: Once the loading finishes, cards, grids, and tables pop into existence instantly, displacing the layout and creating a jarring visual flicker.
*   **Generic Experience**: It violates the premium aesthetic standard set for this multitenant academic PWA.

### The Solution
*   Implement a high-fidelity, custom **Layout-Specific Loading Skeleton System** across all 7 pages. Skeletons will mimic the exact layout of cards, grids, timelines, and tables of each page continuously.
*   Centralize these loading structures in a reusable module `src/components/LoadingSkeletons.tsx` using the pre-existing, hardware-accelerated `.skeleton` background shimmer class.

---

## 2. Component Design & Structures

We will implement the following high-fidelity skeleton components:

### A. `AnnouncementsSkeleton`
*   **Use Case**: announcements list page feed.
*   **Layout**: Renders a vertical list of 3 skeleton cards.
*   **Structure per Card**:
    *   Top-left category badge block (`width: 90px, height: 16px`).
    *   Top-right posted time block (`width: 60px, height: 12px`).
    *   Title block (`width: 75%, height: 18px`).
    *   Paragraph blocks (2 lines: `width: 95%` and `width: 80%`, `height: 13px`).

### B. `AssignmentsSkeleton`
*   **Use Case**: assignments list page feed.
*   **Layout**: Renders a vertical list of 3 skeleton cards.
*   **Structure per Card**:
    *   Left side: circular block resembling subject icon placeholder (`44px x 44px`, `border-radius: 12px`).
    *   Right side:
        *   Title block (`width: 60%, height: 18px`).
        *   Subject code and subtitle block (`width: 40%, height: 12px`).
        *   Bottom status badges (`width: 80px, height: 16px`).
    *   Middle: description text block (2 lines).
    *   Bottom: dynamic full-width action button skeleton (`height: 38px`, `border-radius: var(--radius-md)`).

### C. `PollsSkeleton`
*   **Use Case**: polls list page feed.
*   **Layout**: Renders a list of 2 skeleton poll cards.
*   **Structure per Card**:
    *   Header badges (`width: 80px`, `height: 16px`).
    *   Question title block (`width: 85%`, `height: 18px`).
    *   Options: 3 pulsing button slots (`height: 40px`, `border-radius: var(--radius-md)`).

### D. `ScheduleSkeleton`
*   **Use Case**: classes timeline view.
*   **Layout**: Renders a vertical grid of hour markers alongside timeline cards.
*   **Structure**:
    *   A set of 5 vertical hour intervals (`height: 60px` spacing).
    *   Parallel list of 3 timeline class block containers of varying heights (`height: 100px`, `height: 60px`, `height: 80px`), indented and aligned.

### E. `AttendanceSkeleton`
*   **Use Case**: attendance cards grid.
*   **Layout**: Grid container resembling cards per subject.
*   **Structure per Card**:
    *   Left column: Subject info skeleton lines (title, code).
    *   Right column: Pulsing circular skeleton placeholder resembling the `DonutRing` aggregate (`56px x 56px`, `border-radius: 50%`).
    *   Bottom calculation container block.

### F. `ManageSubjectsSkeleton`
*   **Use Case**: curriculum config list.
*   **Layout**: Vertical list of 5 row grids.
*   **Structure per Row**:
    *   Grid columns for: Code (`60px`), Title (`180px`), Credits (`40px`), Type (`80px`), and Action icon.

### G. `SubmissionsSkeleton`
*   **Use Case**: CR submissions tracker panel.
*   **Layout**: Vertical stack of 6 row items.
*   **Structure per Row**:
    *   Left side: Roll and Name blocks.
    *   Right side: Submission badge slot.

---

## 3. Technology Stack & CSS Details

*   **Shimmer Core**: Leverage the existing `.skeleton` class in `src/index.css` which translates a linear-gradient background over 1.5 seconds at hardware composite level:
    ```css
    .skeleton {
      background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-overlay) 50%, var(--bg-elevated) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-sm);
    }
    ```
*   **Sub-block Helper Component**: Leverage the existing `<Skeleton />` wrapper exported from `src/components/Shared.tsx` for cleaner, standard inline-styling declarations.

---

## 4. Verification Plan

### Automated Checks
*   Verify build compiles using `npm run build` after replacing all loaders.
*   Verify tests pass using `npm test`.

### Manual Checks
*   Simulate slow network configurations in DevTools (3G throttling).
*   Confirm visual layout-match of each skeleton as pages transition online, ensuring **zero layout shifts (CLS)**.
