# Design Spec: Premium Zenith Header Row for Attendance

This specification describes the implementation of the premium **Zenith Header Row** at the absolute top of the **Attendance Page** (`src/pages/app/AttendancePage.tsx`). It upgrades the simple, single-card statistics banner into an immersive, multi-metric grid displaying student standing, aggregated classes attended, total lectures held, and a daily review streak. Furthermore, it synchronizes these new tier definitions and theme classes with the main **Dashboard Page** (`src/pages/app/DashboardPage.tsx`) for perfect app-wide visual cohesiveness.

---

## 1. Visual & Layout Architecture

The current statistics card (lines 501–543 in `AttendancePage.tsx`) is replaced with a premium, horizontally aligned 4-column glassmorphic stats bar. To maintain usability on all screen widths, the layout utilizes responsive CSS grid styles.

### A. Responsive Grid
* **Desktop & Tablet Viewports ($\ge 768\text{px}$)**: Renders as a single horizontal row with 4 equal-width glassmorphic columns.
* **Mobile Viewports ($< 768\text{px}$)**: Gracefully adapts into a **2x2 grid** (Column 1 & 2 on Row 1, Column 3 & 4 on Row 2) to prevent text wrapping or truncation.

### B. Core Metrics & Column Specifications
1. **Column 1: Zenith Standing**
   * **Title Label**: "STANDING"
   * **Badge Text**: Renders active tier: **Zenith** ($\ge 90\%$), **Gold** ($80\% - 89.9\%$), **Silver** ($75\% - 79.9\%$), or **Warned** ($< 75\%$).
   * **Icon**: Custom themed Lucide icon reflecting standing:
     * *Zenith*: `Crown`
     * *Gold*: `Trophy`
     * *Silver*: `Sparkles`
     * *Warned*: `AlertTriangle`
   * **Value**: Prominently displays the overall percentage (e.g. `84.5%`).

2. **Column 2: Sessions**
   * **Title Label**: "SESSIONS"
   * **Icon**: Lucide `BookOpen`
   * **Value**: Aggregate classes attended (`overallAttended` = sum of `present + od + makeup` across all subjects).
   * **Subtitle**: "Classes Attended"

3. **Column 3: Study Time**
   * **Title Label**: "STUDY TIME"
   * **Icon**: Lucide `Clock`
   * **Value**: Aggregate total lectures held (`overallTotal` = sum of `present + od + absent` across all subjects).
   * **Subtitle**: "Total Lectures"

4. **Column 4: Streak**
   * **Title Label**: "STREAK"
   * **Icon**: Lucide `Flame` with a vibrant, animated breathing glow (`flame-glow-pulse`).
   * **Value**: Calculated daily check-in review count (e.g. `5 Days`).
   * **Subtitle**: "Daily Review"

---

## 2. Humorous & Motivational Banner

To keep the unique gamified and humored character of ClassHub alive, the dynamic `tierMessage` is preserved and showcased in a dedicated horizontal ribbon immediately below the grid:

* **Placement**: Located between the 4-column Zenith stats grid and the charts.
* **Styling**: Sleek glassmorphism banner utilizing the active tier's colors (`--tier-border`, `--tier-shadow`).
* **Content**: Centers the `tierMessage` with subtle emoji accents and italics to represent the user's standing humorously.

---

## 3. Streak Engine (Zero-Migration)

To avoid database modifications, daily check-in engagement is tracked on the client side using a resilient browser-local state machine backed by `localStorage`:

### State Machine Rules
1. **Keys**:
   * `classhub_attendance_streak_count`: (Integer) Current streak.
   * `classhub_attendance_streak_last_date`: (String, ISO format) Date string of the last visit.
2. **Logic on Mount**:
   * Read both values.
   * If `last_date` is absent, initialize streak count to `1` and set `last_date` to today.
   * Else, parse `last_date` and calculate the difference in calendar days relative to today (resetting hours to `00:00:00.000` to prevent timezone/hour shifting bugs):
     * **Difference = 0 days (Visited today)**: Retain current streak count.
     * **Difference = 1 day (Visited yesterday)**: Increment streak count by `1` and update `last_date` to today.
     * **Difference > 1 day (Skipped a day)**: Reset streak count to `1` and update `last_date` to today.

---

## 4. Dashboard Alignment & Synchronization

To deliver a perfectly cohesive experience, `src/pages/app/DashboardPage.tsx` is updated to sync with this upgraded tiering and visual system:

* **Tier Mapping in Dashboard**:
  ```typescript
  let statusLabel: string;
  let tierClass: string;
  if (overallPercent >= 90) {
    statusLabel = 'Zenith';
    tierClass = 'attendance-zenith';
  } else if (overallPercent >= 80) {
    statusLabel = 'Gold';
    tierClass = 'attendance-gold';
  } else if (overallPercent >= 75) {
    statusLabel = 'Silver';
    tierClass = 'attendance-silver';
  } else {
    statusLabel = 'Warned';
    tierClass = 'attendance-warned';
  }
  ```
* **Card Theming**: Apply the active `tierClass` to the Dashboard's attendance card so it dynamically pulls the correct themed borders, shadows, and status colors.

---

## 5. Premium Style System & Animations

New theme configurations are appended to `src/index.css` to enable the colored metal and status glows:

### CSS Rules to Add
```css
/* Custom Zenith & Status Glows */
.attendance-zenith {
  --tier-color: #c084fc; /* Light Purple / Amethyst */
  --tier-bg-glow: rgba(192, 132, 252, 0.05);
  --tier-border: rgba(192, 132, 252, 0.25);
  --tier-shadow: 0 0 20px rgba(192, 132, 252, 0.15);
}

.attendance-gold {
  --tier-color: #fbbf24; /* Golden Amber */
  --tier-bg-glow: rgba(251, 191, 36, 0.05);
  --tier-border: rgba(251, 191, 36, 0.25);
  --tier-shadow: 0 0 20px rgba(251, 191, 36, 0.15);
}

.attendance-silver {
  --tier-color: #cbd5e1; /* Silver Slate */
  --tier-bg-glow: rgba(203, 213, 225, 0.05);
  --tier-border: rgba(203, 213, 225, 0.25);
  --tier-shadow: 0 0 20px rgba(203, 213, 225, 0.15);
}

.attendance-warned {
  --tier-color: #ef4444; /* Crimson Red */
  --tier-bg-glow: rgba(239, 68, 68, 0.05);
  --tier-border: rgba(239, 68, 68, 0.25);
  --tier-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
}

/* Pulsing Flame Breathing Glow */
@keyframes flame-glow-pulse {
  0% {
    filter: drop-shadow(0 0 4px rgba(249, 115, 22, 0.5));
    transform: scale(1);
  }
  100% {
    filter: drop-shadow(0 0 12px rgba(249, 115, 22, 0.9));
    transform: scale(1.08);
  }
}

.flame-glow-pulse {
  animation: flame-glow-pulse 1.4s infinite alternate ease-in-out;
  color: #f97316; /* Flame Orange */
}
```

---

## 6. Verification Plan

### Automated Verification
* Run `npm run build` and `npm run lint` to guarantee that all modifications compile cleanly and satisfy TypeScript's strict type requirements.

### Manual Verification
* **Responsive Layouts**: Resize browser windows down to mobile widths ($< 768\text{px}$) and check that the 4 stats cells transition smoothly to a perfect 2x2 grid.
* **Streak Validation**: Verify `localStorage` values in browser developer tools:
  * Set `classhub_attendance_streak_last_date` to yesterday's date, refresh the page, and check if the streak increases by `1`.
  * Set it to 3 days ago, refresh, and check if it resets to `1`.
* **Visual Synchronization**: Change attendance values in the playground simulator to cross the $90\%$, $80\%$, and $75\%$ boundaries. Confirm that both the active standing badge title and the border-glow styling match perfectly on the Attendance Page, and verify their synchronization on the Dashboard.
