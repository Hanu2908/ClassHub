# Design Spec — Polls Realtime Syncing & Mass Bunk Bento Overhaul

This spec documents the design and architecture to implement real-time syncing across all polls, fix the broken timetabled schedule class matcher, introduce a friction-free bento quick-launch bar for CRs, and overhaul the Mass Bunk template card with dynamic HSL coloring and warning glows.

---

## 🎯 Goals & Objectives
1. **Real-time Synchronization**: Classmates see active polls, vote counts, and new creations instantly as they occur, using Supabase Postgres changes sockets.
2. **Eradicate Bunk Friction**: Expose today's classes directly to the CR as 1-click launch chips at the top of the Polls Page.
3. **High-Signal Visual Feedback**: Calculate the mass bunk threshold based on the **entire class section size** rather than active voters, displaying dynamic HSL colors (amber to emerald green) and breathing crimson-red outlines once the 60% mark is crossed.
4. **Fix timetabled schedule lookup bug**: Resolve the day-number vs day-name index mismatch to cleanly populate classes.

---

## 🛠️ Detailed Architectural & Visual Designs

### 1. Timetable Schedule Index Bug Fix
* **Broken Code**:
  ```typescript
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' }); // E.g. "Mon"
  const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todaysClasses = ((schedule as any || {})[DAY_MAP[todayStr] ?? 1] || []);
  ```
* **Correct Code**:
  ```typescript
  const todaysClasses = (schedule?.[todayStr] || []).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  ```
  Since `useSchedule()` maps slots into day string keys (e.g. `'Mon'`, `'Thu'`), indexing by names is 100% correct and retrieves class lists immediately.

---

### 2. Timetabled Bento Quick-Panel (For CRs Only)
* Rendered at the absolute top of `PollsPage.tsx`, just below the navigation bar.
* Lists today's active classes as horizontal interactive glass buttons (chips) in a flex row.
* **Instant Activation**: Clicking a chip instantly launches the pre-filled, actionable mass bunk consensus tracker in **1-click**, setting:
  * Question: `Are we bunking [SubjectCode]: [SubjectName] today?`
  * Options: `['Ditch & Chill', 'Front Bench Energy']`
  * Expiry: Synced to class start time.

---

### 3. Overhauled Actionable Mass Bunk Card
For polls matching the template signature (`o.text === 'Ditch & Chill'`), we display:
1. **Dynamic HSL progress bar**:
   * Calculate consensus against the **entire class size**: `pct = Math.min(100, Math.round((ditchVotes / totalStudents) * 100))` where `totalStudents` is fetched from `useSectionMembers()`.
   * Fill bar maps color using HSL color space:
     `const hue = 35 + Math.min(1, pct / 60) * 85;`
     `const progressColor = \`hsl(\${hue}, 85%, 50%)\`;`
     This transitions the color from a warm amber (35) to vibrant neon emerald green (120) exactly at the 60% threshold.
2. **Breathing Crimson-Red Outline Alert**:
   * If `pct >= 60%`, the card frame lights up with a pulsing crimson shadow glow (`--shadow-glow-red`) and displays a warning banner: `🚨 MASS BUNK IN EFFECT — Stay Safe.`.
3. **CR Live Voter Badges**: Collapsible list of classmate roll number badges, updating in real-time as classmates vote.

---

### 4. Supabase Postgres Realtime Sockets
We establish a section-scoped realtime channel `polls-realtime-${sectionId}-${uniqueId}` inside `src/hooks/useSupabaseQuery.ts`:
* Listens to `'postgres_changes'` on `polls` table filtered by `section_id=eq.${sectionId}` ➔ Invalidates the `polls` query.
* Listens to `'postgres_changes'` on `votes` table ➔ Invalidates both `polls` and `actionable_poll_votes` queries.
* Lifecycle is bound to component mounting via `useEffect`, automatically cleaning up and unsubscribing on page transitions.

---

## 🧪 Verification Plan

### Automated Checks
* Run compilation command to verify TypeScript type-safety:
  ```bash
  npm run build
  ```
* Run linter to ensure code conforms to style constraints:
  ```bash
  npm run lint
  ```

### Manual Visual Tests
1. **Real-time Voting Sync**: Open two browser tabs (one student, one CR), vote on one tab, and verify that progress bars, voter counts, and voter list badges update immediately on the other tab.
2. **Timetable Quick-Panel**: Verify that today's classes appear as clickable chips for the CR at the top of the Polls Page. Click one, and verify a pre-filled mass bunk poll is created instantly.
3. **HSL & 60% Threshold Alert**: Vote up to the 60% total mark. Check that the progress bar transitions dynamically from amber to green, the outline glows with a breathing crimson alarm, and the warning banner displays.
