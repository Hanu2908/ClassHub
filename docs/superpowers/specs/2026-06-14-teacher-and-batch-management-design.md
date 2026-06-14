# Design Spec — Teacher and Batch Management System

This specification details the technical architecture, database schema migrations, Row-Level Security (RLS) policies, and frontend updates to introduce teacher accounts, section sub-batches (A1/A2), a dedicated Mass Bunk tracking table, and dual teacher navigation (Dashboard + Command Center).

---

## User Review Required

> [!IMPORTANT]
> **Database Role Extension:** We are adding `'teacher'` as a valid role to the Postgres enum `public.user_role`. RLS policies will be strictly applied to prevent teachers from accessing mass bunks and private student records.
> 
> **Separate Mass Bunk Tables:** To prevent any possibility of database leaks via general poll queries, we are creating dedicated `mass_bunks` and `mass_bunk_votes` tables. These tables will be completely hidden from teacher roles via RLS.

---

## Proposed Changes

### 1. Database Schema Migrations

We will create a new migration file `supabase/migrations/20260614120000_teacher_and_batch_management.sql` containing:

#### **Enum & Column Alterations**
*   Add `'teacher'` to the `public.user_role` enum type:
    ```sql
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';
    ```
*   Add `sub_batch` to `public.users` table:
    ```sql
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sub_batch text CHECK (sub_batch IN ('1', '2'));
    ```
*   Add `target_batch` to `public.announcements`, `public.assignments`, and `public.timetable_slots`:
    ```sql
    ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));
    ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));
    ALTER TABLE public.timetable_slots ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));
    ```
*   Add `teacher_invite_code` to `public.sections` table:
    ```sql
    ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS teacher_invite_code text UNIQUE;
    ```

#### **New Junction Table (`section_teachers`)**
Maps teachers to the sections and subjects they teach:
```sql
CREATE TABLE IF NOT EXISTS public.section_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_counsellor_for_batch text CHECK (is_counsellor_for_batch IN ('1', '2')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, teacher_id, subject_id)
);
```

#### **New First-Class Mass Bunk Tables**
A dedicated schema isolated from standard polls:
```sql
CREATE TABLE IF NOT EXISTS public.mass_bunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  date date NOT NULL,
  timetable_slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'active', 'failed', 'cancelled')),
  closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mass_bunk_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mass_bunk_id uuid NOT NULL REFERENCES public.mass_bunks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote_choice text NOT NULL CHECK (vote_choice IN ('bunk', 'class')), -- 'bunk' (Bunk Maarle) vs 'class' (Class Lagao)
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mass_bunk_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.counsellor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (counsellor_id, student_id)
);
```

---

### 2. Row-Level Security (RLS) Policies

We will write robust database policies to enforce data isolation:

#### **Mass Bunks & Votes Isolation**
Teachers are explicitly forbidden from reading or interacting with mass bunk data:
```sql
-- Disable all teacher access to mass_bunks
ALTER TABLE public.mass_bunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY mass_bunks_student_only_select ON public.mass_bunks
  FOR SELECT
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND section_id = public.current_user_section_id()
  );

CREATE POLICY mass_bunks_student_insert ON public.mass_bunks
  FOR INSERT
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND created_by = auth.uid()
  );

-- Disable all teacher access to mass_bunk_votes
ALTER TABLE public.mass_bunk_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mass_bunk_votes_student_only_select ON public.mass_bunk_votes
  FOR SELECT
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
  );

-- Restrict counsellor_notes to the assigned counsellor only
ALTER TABLE public.counsellor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY counsellor_notes_owner_access ON public.counsellor_notes
  USING (counsellor_id = auth.uid())
  WITH CHECK (counsellor_id = auth.uid());
```

#### **Section Teacher Permissions**
*   Allow teachers to read details for sections they teach in `section_teachers`.
*   Allow teachers to insert/update assignments, announcements, and timetable slots for their mapped sections.

---

### 3. Subject-Teacher Auto-Linking Heuristics

To ensure a teacher mapped to "Mathematics" is automatically connected to "Mathematics (Tutorial)" or "Mathematics Lab":
*   When fetching a teacher's schedule or active courses, the query will fetch:
    1.  Timetable slots matching their exact `subject_id`.
    2.  Timetable slots where the subject's name or code matches a fuzzy regex of the teacher's subject name (e.g. `^Math(ematics)?(\s*(III|3))?(\s*(Tutorial|Lab|Tuto))?$`).
*   An explicit `timetable_slots.teacher_id` override field will also be supported so a CR or teacher can select a specific teacher for a tutorial slot if they are different from the lecture teacher.

---

### 4. Smart Parsing & Form Creation Sheets

To support targeted scheduling and communication, we will update the creation sheets/composers:
*   **Form Scoping Selectors:** The creation sheets for **Announcements**, **Assignments**, and **Timetable Slots** will be updated to include a dropdown/toggle selector for `Target Batch` (`All / Batch 1 / Batch 2`).
*   **Target Batch Auto-Select:** If the composer text (title/body/description) contains batch identifiers (e.g. `\b(A1|A2|Batch\s*1|Batch\s*2|Group\s*1|Group\s*2)\b`), the form will automatically pre-select `'1'` or `'2'` for the `target_batch` field.
*   **Subject Auto-Select:** Continue using the existing smart acronym/keyword parser (`matchSubject`) to link subject tags based on text hints.

---

### 5. Frontend Navigation & Pages

#### **Navigation Changes for Teachers**
We will add three distinct navigation items in the app's sidebar / `NavBar` for teachers:
1.  **Teacher Dashboard (`/app/teacher-dashboard`):**
    *   **Section Selector:** Drops down to switch sections.
    *   **Timetable Widget:** Shows today's classes for the teacher.
    *   **Visual Student Grid:** A visual directory displaying **all students in the selected section** (to ensure teachers can verify students section-wide). Each card contains:
        *   Student profile picture/avatar (mandatory for proxy verification).
        *   Name and Roll number.
        *   Single-tap toggle (Present = Green, Absent = Red).
        *   "Copy ERP Format" button to export formatted roll numbers.
        *   "1-Click Nudge" to alert absent students.
        *   "Assignments Pending Alert" indicator icons.
    *   **Submission Tracker:** Monitor student assignment submissions for their subjects.
2.  **Counsellor Console Page (`/app/counsellor`):**
    *   *Note: Only visible in the sidebar/nav for teachers who are designated as counsellors (`is_counsellor_for_batch IS NOT NULL`).*
    *   **My Batch Directory:** Filters down to see only their specific ~30 students (Batch A1 or A2).
    *   **Red-Alert Attendance Dashboard (Priority Sorted):**
        *   **Priority 1 (Red Alert):** Students whose **overall aggregate attendance** across all subjects is below 75%.
        *   **Priority 2 (Orange Alert):** Students whose aggregate is OK, but their **subject-specific attendance** falls below 75% in a particular subject.
    *   **Private Counsellor Remarks:** A text box on each student card to save private remarks (e.g. "Spoke with father on 14th June. Health issues."). Saved in the secure `counsellor_notes` table.
3.  **Teacher Command Center (`/app/teacher-command`):**
    *   CRUD Panel for creating assignments, announcements, and subjects.
    *   Teachers can edit/delete *only* the content they authored.
    *   **Manage Teachers (CR Command Center):** CR Command Page gains a "Manage Teachers" tab to view teacher mappings, rotate the Teacher Invite Code, assign/modify counsellor status (`is_counsellor_for_batch`) to a teacher for batch 1 or 2, and demote/remove unauthorized teacher logins. (Permissions available to CRs and the Hub Creator).

#### **Student Directory & Connection**
*   **Teachers Directory Tab:** On the Section Members page (`/app/members`), students will see two tabs: `[ Students | Teachers ]`.
    *   The **Teachers** tab displays all teachers teaching the section, their subject, email address, and a shortened counsellor badge if applicable.
*   **Shortened Badges:** The batch counsellor badge will be shortened for visual cleanliness:
    *   **`[Batch Counsellor-A1]`** (Batch Counsellor for A1)
    *   **`[Batch Counsellor-A2]`** (Batch Counsellor for A2)
*   **Student-Counsellor Connection:** On the student profile page or sidebar, if a student has an assigned Batch Counsellor, their profile displays a **"Contact Counsellor"** button. Tapping this opens a quick contact request or direct email pre-filled with their current attendance and academic summary.

#### **Student Timetable Toggle**
On the Student Schedule page, replace the batch selectors with a simple 2-state toggle:
*   **My Batch:** Shows core lectures + their own sub-batch labs (A1 or A2).
*   **Full Section:** Shows core lectures + both A1 & A2 labs side-by-side to see the full classroom timeline.

---

## Verification Plan

### Automated Tests
*   **RLS Verification:** Add test cases in `tests/unit/permissions.test.ts` to verify:
    *   `role = 'teacher'` cannot read from `mass_bunks` or `mass_bunk_votes`.
    *   `role = 'teacher'` can read student directory but not private records.
    *   Timetable slot queries route tutorials and lectures correctly to subject teachers.
*   **Smart Parser Tests:** Verify batch regex successfully identifies A1 vs A2 target scopes from text.

### Manual Verification
1.  Log in as CR and generate a Teacher Invite Code.
2.  Log in as a Teacher using the invite code, select "Mathematics", and check the navbar for two options: **Teacher Dashboard** and **Teacher Command Center**.
3.  On the **Teacher Dashboard**, mark attendance on the visual image grid, tap "Copy ERP", and verify the generated text output.
4.  On the **Student Feed**, create a Mass Bunk poll ("Bunk Maarle? 🔥").
5.  Switch back to the Teacher login and verify that the Mass Bunk poll is completely invisible on the feed and queries return no results.
