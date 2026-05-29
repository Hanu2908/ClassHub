# Performance & Bundle Optimization — Phase 2 Design Spec

**Date:** 2026-05-29
**Status:** Approved
**Scope:** Bundle slicing, perceived speed, Dashboard decomposition

---

## Problem

ClassHub's production build has several performance bottlenecks:

| Chunk | Size | Issue |
|---|---|---|
| `index.js` (main) | 506 KB | Over 500 KB warning threshold |
| `AnalyticsTab.js` | 421 KB | recharts dependency (already lazy, but heavy) |
| `es.js` (locale) | 420 KB | Full date/number locale bundle from recharts/d3 |
| `ReportTab.js` | 208 KB | html2canvas statically imported |
| `gpaData.ts` | 45 KB | 740 lines of hardcoded curriculum data |
| `DashboardPage.tsx` | 2,411 lines / 105 KB | Monolith — loads everything upfront |

Additionally:
- Build warning: `appStore.ts` dynamically imported by `AuthProvider.tsx` but also statically imported by itself + 5 others — dynamic import is ineffective
- No route-level skeleton fallbacks (generic pulsing dot on all routes)
- No nav link prefetching
- Fonts loaded via CSS `@import` only — no `<link rel="preload">`

---

## Design

### Section 1: Bundle Slicing

#### 1A. Dynamic import `html2canvas` in pdfExport.ts

**Current:** `import html2canvas from 'html2canvas'` (static, top-level)
**Change:** Move to `const html2canvas = (await import('html2canvas')).default` inside the `exportGPAReport()` function body

**Impact:** ~200 KB off the ReportTab chunk. Library only loads when user taps "Export."

#### 1B. Externalize curriculum data from gpaData.ts

**Current:** `gpaData.ts` is 740 lines, 45 KB. Lines 100–740 are hardcoded `DefaultSubject[]` arrays for 9 branches × 8 semesters.

**Change:**
- Extract curriculum data (the `CURRICULUM` map and all `SEM*` arrays) into `src/lib/curriculumData.ts`
- Keep helper functions (`marksToGrade`, `computeSGPA`, `GRADE_SCALE`, `BRANCHES`, etc.) in `gpaData.ts`
- In `curriculumData.ts`, export a `loadCurriculum()` async function that lazy-loads the data
- The `gpaStore.ts` calls `loadCurriculum()` on first access

**Impact:** ~40 KB off any chunk that imports gpaData. Curriculum data only loads when GPA page opens.

#### 1C. Fix ineffective dynamic import of appStore.ts

**Current:** `AuthProvider.tsx` line 5 has `import { useAppStore, type AuthUser, type DbNotification } from '../store/appStore'` (static). But somewhere Vite detects a dynamic `import()` path too.

**Change:** Audit and remove any leftover `import('../store/appStore')` dynamic import in AuthProvider. Ensure all appStore imports are static (they must be, since appStore is needed app-wide).

**Impact:** Cleaner chunk graph, eliminates build warning.

---

### Section 2: Perception Performance

#### 2A. Route-level skeleton fallbacks

**Current:** `App.tsx` line 110-114 uses a single generic fallback (pulsing dot) for all routes.

**Change:** Create `src/components/PageSkeleton.tsx` with a full-page wireframe skeleton:
- Sticky header placeholder (height ~56px)
- 3-4 card-shaped skeleton blocks
- Bottom nav bar placeholder

Replace the generic `<Suspense fallback>` in `App.tsx` with `<PageSkeleton />`.

**Impact:** Users see a structural preview of the page within milliseconds, instead of a lone pulsing dot. Perceived load time drops significantly.

#### 2B. NavBar prefetch on hover/touch

**Current:** `NavBar.tsx` navigates on click with no prefetching.

**Change:** Add `onMouseEnter` and `onTouchStart` handlers to each nav button that trigger `import()` of the target page's module:

```typescript
const PAGE_IMPORTS: Record<string, () => Promise<unknown>> = {
  '/app/home':          () => import('../pages/app/DashboardPage'),
  '/app/schedule':      () => import('../pages/app/SchedulePage'),
  '/app/announcements': () => import('../pages/app/AnnouncementsPage'),
  '/app/attendance':    () => import('../pages/app/AttendancePage'),
  '/app/cr-command':    () => import('../pages/app/CRCommandPage'),
  '/app/profile':       () => import('../pages/app/ProfilePage'),
};

function prefetch(path: string) {
  PAGE_IMPORTS[path]?.();
}
```

**Impact:** By the time the user taps (after hovering/touching), the chunk is already in the browser cache. Near-instant page transitions.

#### 2C. Preload critical fonts

**Current:** `index.html` line 18 loads 5 font families via a single `<link href="...css2?...">` stylesheet. Fonts don't start downloading until the CSS is parsed.

**Change:** Add `<link rel="preload">` tags for the most critical font files (Plus Jakarta Sans Regular/600 and JetBrains Mono Regular) before the stylesheet link. These are the two fonts visible on every page.

```html
<link rel="preload" href="https://fonts.gstatic.com/s/plusjakartasans/v8/..." as="font" type="font/woff2" crossorigin />
<link rel="preload" href="https://fonts.gstatic.com/s/jetbrainsmono/v18/..." as="font" type="font/woff2" crossorigin />
```

**Impact:** Eliminates FOIT (Flash of Invisible Text). Fonts render with the first paint.

---

### Section 3: DashboardPage Decomposition

**Current:** `DashboardPage.tsx` is 2,411 lines containing:
- Line 18-80: prefetch helper + schedule utilities
- Line 107-186: skeleton styles + WidgetSkeleton
- Line 188-285: NotificationSheet
- Line 286-808: CriticalCarousel + PushPermissionCTA (523 lines!)
- Line 809-919: ScheduleWidget
- Line 920-943: linkify utility
- Line 945-1485: AnnouncementsScroll (540 lines!)
- Line 1487-1529: PollBanner
- Line 1531-1612: AssignmentsScroll
- Line 1614-1712: CRDashboardStation
- Line 1714-2411: DashboardPage main component

**Change:** Decompose into `src/pages/app/dashboard/` directory:

| File | Contents | Lines (est.) |
|---|---|---|
| `DashboardPage.tsx` | Shell orchestrator — layout, hooks, state | ~200 |
| `DashboardHeader.tsx` | Greeting, notification bell icon, notification count | ~50 |
| `NotificationSheet.tsx` | Full notification bottom sheet | ~100 |
| `CriticalAlerts.tsx` | CriticalCarousel + CountdownTimer + PushPermissionCTA | ~520 |
| `ScheduleWidget.tsx` | Today's schedule preview | ~110 |
| `AnnouncementsScroll.tsx` | Horizontal announcements feed + detail sheet | ~540 |
| `PollBanner.tsx` | Active poll quick-view | ~45 |
| `AssignmentsScroll.tsx` | Upcoming assignments strip | ~80 |
| `CRDashboardStation.tsx` | CR-only dashboard widget | ~100 |
| `dashboardUtils.ts` | `todayKey`, `parseTime`, `hoursUntil`, `linkify`, skeleton styles | ~100 |

**Data flow:** The parent `DashboardPage` calls all query hooks (`useAnnouncements`, `useAssignments`, `usePolls`, `useSchedule`, `useAttendance`) and passes data as props to children. No child calls its own hooks — single source of truth.

**Impact:**
- Each sub-component is a separate module that can be tree-shaken independently
- The Dashboard chunk becomes ~200 lines instead of 2,411
- Individual widgets can potentially be lazy-loaded in future sprints
- Developer experience: easier to find, edit, and review code

---

## Verification Plan

1. `npm run build` — zero warnings (no chunk > 500 KB, no ineffective dynamic import)
2. `npm test` — all existing 84 tests pass
3. Manual: open app in Chrome DevTools Network tab, verify:
   - `recharts` chunk only loads when Analytics tab is opened
   - `html2canvas` only loads when Export is tapped
   - Nav link hover triggers prefetch (visible in Network panel)
   - PageSkeleton renders during route transitions (throttle to Slow 3G)
4. Lighthouse: measure LCP, FCP before and after

---

## Non-goals (this sprint)

- Splitting `useSupabaseMutations.ts` / `useSupabaseQuery.ts` into per-feature files (follow-up sprint)
- Eliminating the `es.js` locale chunk (requires recharts internals investigation)
- CRCommandPage decomposition (follow-up sprint)
- UX flow/navigation changes
