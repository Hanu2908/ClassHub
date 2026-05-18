# Student Dashboard Design

Date: 2026-05-18
Status: Draft

## Purpose

Design a calm, student-focused dashboard for ClassHub that balances an overview of the day with subtle urgency cues and fast navigation to the student workflow.

The new student dashboard should feel restful while still calling attention to the next actions students care about: today’s schedule, attendance status, urgent assignments, active polls, and announcements.

## Goals

- Keep the dashboard mobile-first and easy to scan
- Surface the student’s next priority without overwhelming them
- Preserve the existing card-based layout and soft dark UI style
- Support direct navigation to relevant app pages from the dashboard
- Use the existing Supabase-driven hooks and data sources already in place

## Recommended Layout

### 1. Sticky Header

Fields
- Section invite code and section name
- Greeting with the student’s first name
- Notification button with unread count badge
- Announcements button to go directly to `/app/announcements`

Purpose
- Provide consistent context and access to notifications and announcements
- Keep the top area simple, calm, and helpful

### 2. Focus Strip: "What’s Next"

This is the primary dashboard signal area.

Cards
- Next class or a friendly free-time summary
- Attendance snapshot with overall percent and risk hint
- Nearest deadline or active poll highlight

Behavior
- Each card is compact and horizontally scrollable if needed
- Urgent statuses use soft visual accents only (badge or outline) to avoid noise
- Tapping a card navigates to the relevant page

Why this works
- It gives students a quick answer to: what should I do first?
- It keeps the dashboard calm by limiting the top section to 2–3 core items

### 3. Schedule Summary Card

Fields
- Today’s current class or next upcoming class
- A second listed class if available
- Fallback copy when no classes are scheduled today

Navigation
- Button or card tap to `/app/schedule`

### 4. Attendance Summary Card

Fields
- Overall percentage from `useAttendance()`
- A horizontal pill row showing subject-level attendance percentages
- A link to `/app/attendance`

Behavior
- If attendance is low or trending risk, use a warning badge or color accent
- If there is no attendance data, show a gentle empty state with a call to update attendance

### 5. Announcements Summary Card

Fields
- 1–2 latest non-expired announcements from `useAnnouncements()`
- Urgency badge if an announcement has a near deadline or is critical

Navigation
- Link to `/app/announcements`

### 6. Poll Summary Card

Fields
- Active poll title and a short progress preview based on `usePolls()`
- Countdown or closing note if a poll is active and not expired

Navigation
- Link to `/app/polls`

### 7. Assignments Summary Card

Fields
- 1–2 upcoming assignments from `useAssignments()`
- Status badge for `submitted` or deadline category

Navigation
- Link to `/app/assignments`

## Data Sources and Hooks

Use only the existing query hooks from `src/hooks/useSupabaseQuery.ts`:

- `useSection()` for section name and invite code
- `useAnnouncements()` for announcements summary
- `useAssignments()` for assignment cards
- `usePolls()` for active poll summary
- `useSchedule()` for today’s classes
- `useAttendance()` for attendance metrics

No new backend hooks are required for this design.

## Visual Behavior and Tone

- Use a single-column mobile-first layout
- Keep card surfaces soft and low-contrast: dark background, subtle border
- Reserve saturated color only for urgency badges and status indicators
- Avoid dense tables and heavy text blocks
- Prefer short summary text and concise calls to action

## Navigation and Interaction

- The dashboard is not a workspace itself; it points students to the right workflows.
- Each section card should be tappable and offer a visible action link.
- The notification button opens the existing in-page notification sheet.
- The announcements button navigates to the announcements page.

## Success Criteria

- Students can identify their next academic priority within one screenful
- Urgent items are visible but do not dominate the page
- The dashboard uses current app data and does not require new API endpoints
- The student flow from dashboard → detail page is clear and friction-free

## Testing and Validation

Existing frontend patterns require handling:

- `isLoading` and `isError` states for every hook
- Empty state fallbacks for schedule, attendance, announcements, polls, and assignments
- Navigation from each dashboard card to its destination page
- Correct urgency badge rendering for deadlines and attendance risk

Potential tests
- Manual review of the dashboard with: no data, partial data, urgent due items, active poll
- Verify `useSection()` loads section name before greeting renders
- Verify notification button opens the notification sheet and unread count updates

## Notes

- This design focuses on student-facing behavior only.
- CR dashboard variants can be designed later once this student baseline is validated.
- The implementation should reuse existing card and section semantics from `DashboardPage.tsx` where possible.
