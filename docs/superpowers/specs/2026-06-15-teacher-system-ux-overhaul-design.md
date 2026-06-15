# 2026-06-15 Teacher System UX Overhaul Design

Overhaul the Teacher Console, Attendance Register, and Student Avatars for ClassHub to deliver a premium, highly performant, and intuitive UX.

## User Review Required

> [!IMPORTANT]
> This change introduces backend modifications, including database RLS policy adjustments and an automated notification trigger. Please review the security and performance implications of these changes before approval.

### 1. Database RLS Policies on `counsellor_notes`
We are updating the `counsellor_notes` Row Level Security (RLS) to allow students to read counsellor remarks directed to them. We are also adding a `student_response` column so students can write explanations (e.g., medical reasons) for their counsellor.
* **Counsellors**: Can read/write all fields for their batch.
* **Students**: Can read remarks where `student_id = auth.uid()`, and update *only* the `student_response` and `student_response_updated_at` columns. A database trigger will enforce this column lock.

### 2. Automated Notification Triggers
A PostgreSQL database trigger will automatically create in-app and push notification events in `public.notification_events` when:
* A counsellor inserts/updates a remark for a student.
* A student inserts/updates a response to a counsellor's remark.

---

## Proposed Changes

We will restructure the teacher console, attendance reports, and student profile images. The dry, messy "Teacher Command Page" will be completely removed, and its notices/assignments composition capabilities will be integrated natively into `/app/announcements` and `/app/assignments` (filtering to show only their relevant items).

### Database & Migrations

#### [NEW] [20260615000000_counsellor_remarks_notifications.sql](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/supabase/migrations/20260615000000_counsellor_remarks_notifications.sql)
* Alter `public.users` onboarding logic to store Google OAuth profile pictures in `avatar_url` (updates `join_section`, `join_section_as_teacher`, and `create_section_hub`).
* Write an update script to sync all existing authenticated users' profile pictures.
* Add columns to `public.counsellor_notes`: `student_response` (TEXT), `student_response_updated_at` (TIMESTAMPTZ), `counsellor_remark_updated_at` (TIMESTAMPTZ).
* Add values `'counsellor_remark'` and `'counsellor_remark_reply'` to `public.notification_kind` enum.
* Alter RLS policies on `public.counsellor_notes`:
  * Allow SELECT for students where `student_id = auth.uid()`.
  * Allow UPDATE for students where `student_id = auth.uid()` via a column-lock trigger check.
* Add database trigger to automatically log events in `public.notification_events` when remarks or student responses are written.

---

### Onboarding & Profile

#### [MODIFY] [JoinHubPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/onboarding/JoinHubPage.tsx)
* Immediately after the teacher RPC succeeds, transition the onboarding wizard to a "Link Your Courses" step instead of redirecting straight to the dashboard.
* Fetch all subjects for their section and display them in a clean, scrollable checklist.
* Link selected subjects to `public.section_teachers`. Include an option to "Apply to all my sections" which checks for matching subject codes across all sections they teach.

#### [MODIFY] [ProfilePage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ProfilePage.tsx)
* Add a "Linked Courses" settings panel in the teacher's profile.
* Allow teachers to link/unlink subjects they teach at any time, including the "Apply to all sections" option.

---

### Redesigned Teacher Dashboard

#### [MODIFY] [TeacherDashboardPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/TeacherDashboardPage.tsx)
* **Header overhaul**: Replace the "Cancel Lecture" button with a global **Section & Course Selector** dropdown. Selecting a class here updates the global Zustand store (`useAppStore`), and all tabs automatically re-filter by this selection.
* **Setup Required Card**: If no subjects are linked, display a premium empty-state card with a 1-tap "Link Subject" CTA button.
* **Top Slider Navigation Tabs**: Split the page into 4 responsive tabs:
  1. **Mark Attendance**: Redesigned roster register.
     * Grid vs. List toggle layout.
     * **Tap-to-Toggle**: Everyone is Present by default (green border/check). Tapping a student toggles them to Absent (red border/cross).
     * **Long-press/Options tap**: Opens a sheet to mark OD or Makeup.
     * **Three-dot list menu**: Houses bulk controls (*Present to all, Absent to all, Makeup to all, OD to all*).
     * **Minimalist Personas**: Fall back to Dicebear's `personas` style instead of robots.
  2. **Attendance Register (Report)**: Renders a full-screen, horizontally scrollable grid.
     * Left column (Names & Rolls) is sticky.
     * Dates scroll horizontally.
     * Tapping a cell opens direct inline editing of that student's status on that specific day.
  3. **Attendance Log**: History log of past sessions with quick Edit/Delete actions.
  4. **Assignments Tracker**: List of assignments for the selected subject (created by the teacher OR the CR).
     * Shows submission progress bar (CR-verified status counts).
     * Tapping an assignment opens a detailed list of students showing their submission verification status and the "Nudge Pending" button.

---

### Notices & Assignments Integration

#### [REMOVE] [TeacherCommandPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/TeacherCommandPage.tsx)
* Completely delete this file to clean up navigation and eliminate code duplication.

#### [MODIFY] [NavBar.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/NavBar.tsx)
* Update teacher tabs to: Dashboard (Home), Notices (Megaphone), Counsellor (if applicable), Profile. Remove the Command tab.

#### [MODIFY] [App.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/App.tsx)
* Remove route guards blocking teachers from accessing `/app/announcements` and `/app/assignments`.

#### [MODIFY] [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx)
* Enable notice composition sheet for teachers.
* Filter the announcements feed for teachers to show: (1) notices created by themselves, (2) notices for subjects they teach, or (3) notices where they are tagged (`@TeacherName`).
* Integrate member autocomplete tagging (autocompletes student names when typing `@` in the notices composer, matching the Q/A comments pattern).

---

### Counsellor Console & Student Dashboard

#### [MODIFY] [CounsellorConsolePage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/CounsellorConsolePage.tsx)
* Replace robot student avatars with Google account photos or the `personas` fallback.
* Add dashboard metric cards at the top (Class average, low-attendance count).
* Show student responses to remarks next to their names in the roster list.

#### [MODIFY] [DashboardPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/DashboardPage.tsx)
* Add a slim, premium **Counsellor Alert Card** at the top of the student's dashboard if there is an active remark from their counsellor.
* Tapping the card expands it inline, showing the remark history and a text area to write and submit their explanation (notifying the counsellor in real-time).

#### [MODIFY] [NotificationSheet.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/NotificationSheet.tsx)
* Add routing for `counsellor_notes` notifications: redirects teachers to `/app/counsellor` and students to `/app/attendance` or home dashboard.

---

## Verification Plan

### Automated Tests
* Run `npm test` to verify no existing unit tests are broken.
* Create a test script in `tests/` to verify that RLS policies block students from editing counsellor note fields except for `student_response`.

### Manual Verification
* Log in as a teacher: verify onboarding subject checklist, linking a subject globally, marking attendance with the new tap-to-toggle grid, and editing cell values in the register.
* Log in as a student: verify counsellor alert card on dashboard, posting a response remark, and checking that Google photos are loaded.
