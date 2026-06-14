# Design Spec — Digital Attendance Register and Submissions Hub

This specification details the technical architecture, database schema migrations, Row-Level Security (RLS) policies, and frontend updates to introduce a session-based digital Attendance Register log, visual batch-filtered attendance marking, a detailed Submissions Review Hub for assignments, and Lecture Flash Alerts for teachers.

---

## Proposed Changes

### 1. Database Schema Migrations

We will create a new migration file `supabase/migrations/20260614150000_attendance_register_system.sql` containing:

#### **New Tables**
*   **`attendance_sessions`**: Represents an individual class/lecture conducted.
    ```sql
    CREATE TABLE IF NOT EXISTS public.attendance_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
      subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
      teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      date date NOT NULL DEFAULT CURRENT_DATE,
      timetable_slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE SET NULL,
      target_batch text CHECK (target_batch IN ('1', '2')),
      lecture_count integer NOT NULL DEFAULT 1 CHECK (lecture_count >= 1),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ```
*   **`student_session_attendance`**: Junction table logging the attendance status of each student for a specific session.
    ```sql
    CREATE TABLE IF NOT EXISTS public.student_session_attendance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      status text NOT NULL CHECK (status IN ('present', 'absent', 'od', 'makeup')),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (session_id, student_id)
    );
    ```

#### **Indexes for Performance**
To prevent table locks and slow joins, we will index all foreign key columns:
```sql
CREATE INDEX IF NOT EXISTS attendance_sessions_section_idx ON public.attendance_sessions(section_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_subject_idx ON public.attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_teacher_idx ON public.attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_slot_idx ON public.attendance_sessions(timetable_slot_id);

CREATE INDEX IF NOT EXISTS student_session_attendance_session_idx ON public.student_session_attendance(session_id);
CREATE INDEX IF NOT EXISTS student_session_attendance_student_idx ON public.student_session_attendance(student_id);
```

#### **Postgres Trigger for Aggregates**
To automatically sync the aggregate `attendance_records` counts, we define `fn_sync_session_attendance()` triggered `AFTER INSERT OR UPDATE OR DELETE ON student_session_attendance`:
```sql
CREATE OR REPLACE FUNCTION public.fn_sync_session_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_id UUID;
  v_lecture_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT subject_id, lecture_count INTO v_subject_id, v_lecture_count
    FROM public.attendance_sessions WHERE id = NEW.session_id;

    INSERT INTO public.attendance_records (user_id, subject_id, present, absent, od, makeup)
    VALUES (NEW.student_id, v_subject_id, 0, 0, 0, 0)
    ON CONFLICT (user_id, subject_id) DO NOTHING;

    IF NEW.status = 'present' THEN
      UPDATE public.attendance_records SET present = present + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'absent' THEN
      UPDATE public.attendance_records SET absent = absent + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'od' THEN
      UPDATE public.attendance_records SET od = od + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'makeup' THEN
      UPDATE public.attendance_records SET makeup = makeup + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT subject_id, lecture_count INTO v_subject_id, v_lecture_count
    FROM public.attendance_sessions WHERE id = OLD.session_id;

    IF OLD.status = 'present' THEN
      UPDATE public.attendance_records SET present = GREATEST(0, present - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'absent' THEN
      UPDATE public.attendance_records SET absent = GREATEST(0, absent - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'od' THEN
      UPDATE public.attendance_records SET od = GREATEST(0, od - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'makeup' THEN
      UPDATE public.attendance_records SET makeup = GREATEST(0, makeup - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT subject_id, lecture_count INTO v_subject_id, v_lecture_count
    FROM public.attendance_sessions WHERE id = NEW.session_id;

    -- Revert old status
    IF OLD.status = 'present' THEN
      UPDATE public.attendance_records SET present = GREATEST(0, present - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'absent' THEN
      UPDATE public.attendance_records SET absent = GREATEST(0, absent - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'od' THEN
      UPDATE public.attendance_records SET od = GREATEST(0, od - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    ELSIF OLD.status = 'makeup' THEN
      UPDATE public.attendance_records SET makeup = GREATEST(0, makeup - v_lecture_count), updated_at = now()
      WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
    END IF;

    -- Apply new status
    IF NEW.status = 'present' THEN
      UPDATE public.attendance_records SET present = present + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'absent' THEN
      UPDATE public.attendance_records SET absent = absent + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'od' THEN
      UPDATE public.attendance_records SET od = od + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    ELSIF NEW.status = 'makeup' THEN
      UPDATE public.attendance_records SET makeup = makeup + v_lecture_count, updated_at = now()
      WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_session_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.student_session_attendance
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_session_attendance();
```

---

### 2. Row-Level Security (RLS) Policies

We will write robust database policies to enforce data isolation, utilizing cached subqueries `(SELECT auth.uid())`:

*   **`attendance_sessions`**:
    *   **SELECT**: Anyone authenticated in the section or mapped teachers can view.
        ```sql
        section_id = (SELECT public.current_user_section_id())
        OR EXISTS (
          SELECT 1 FROM public.section_teachers st
          WHERE st.teacher_id = (SELECT auth.uid())
            AND st.section_id = attendance_sessions.section_id
        )
        ```
    *   **ALL (Manage)**: Only mapped teachers can manage.
        ```sql
        EXISTS (
          SELECT 1 FROM public.section_teachers st
          WHERE st.teacher_id = (SELECT auth.uid())
            AND st.section_id = attendance_sessions.section_id
            AND st.subject_id = attendance_sessions.subject_id
        )
        ```
*   **`student_session_attendance`**:
    *   **SELECT**: 
        *   Students can only view their own records (ensuring daily logging privacy).
            ```sql
            student_id = (SELECT auth.uid())
            ```
        *   CRs and mapped teachers of the session's section can read all.
            ```sql
            (SELECT public.current_user_role()) = 'cr'::public.user_role
            OR EXISTS (
              SELECT 1 FROM public.attendance_sessions s
              JOIN public.section_teachers st ON st.section_id = s.section_id
              WHERE s.id = student_session_attendance.session_id
                AND st.teacher_id = (SELECT auth.uid())
            )
            ```
    *   **ALL (Manage)**: Only mapped teachers of the session's subject can write/edit.
        ```sql
        EXISTS (
          SELECT 1 FROM public.attendance_sessions s
          JOIN public.section_teachers st ON st.section_id = s.section_id AND st.subject_id = s.subject_id
          WHERE s.id = student_session_attendance.session_id
            AND st.teacher_id = (SELECT auth.uid())
        )
        ```

---

### 3. Frontend Layout & UI Upgrades

#### **Teacher Dashboard Tabs**
We will implement a two-tab interface on `TeacherDashboardPage.tsx`:
1.  **Mark Attendance Tab**:
    *   **Filtering & Parameters**: Dropdown to select subject, date, slot (plus a custom "Extra Class" checkbox/input). Target batch selector (`All / Batch 1 / Batch 2`). Session weight toggle (`1 or 2 lectures`). Helper buttons to default all to Present or Absent.
    *   **Visual Grid**: Renders profile cards for section students. Tapping cycles status: `Present (P - Green) ➔ Absent (A - Red) ➔ On-Duty (OD - Orange) ➔ Present`.
    *   **Double-Submit Protection**: Clicking submit disables the button instantly and inserts a client-generated UUID for the session ID.
2.  **Attendance Log Tab**:
    *   Chronological list of logged sessions.
    *   **Edit Session**: Opens a sheet showing the visual grid pre-loaded with marked states, allowing retroactive updates of student statuses. Subject and Session weight are read-only.
    *   **Delete Session**: Reverts the counts from aggregate records via database triggers.

#### **Submissions Tracker Upgrade**
*   When a teacher clicks an assignment card on their dashboard, it opens a details sheet.
*   The sheet displays student names, Drive/GitHub clickable submission links (read-only), and a "Nudge" button to notify students who have not submitted yet.

#### **Flash Lecture Alerts**
*   A quick-action section on the dashboard lets teachers broadcast a class change.
*   Clicking "Cancel Class" or "Reschedule Class" automatically inserts a Critical Announcement in the `announcements` table with `expires_at = now() + 6 hours`. This triggers push notifications and automatically clears itself from the student feeds after the period.

---

## Verification Plan

### Automated Tests
*   Run unit tests in `tests/unit/permissions.test.ts` to verify:
    *   Submitting a session updates `attendance_records` by the exact lecture count.
    *   Updating a student status correctly shifts aggregate metrics.
    *   Deleting a session subtracts the session weight from aggregates.
    *   Students can read only their own session attendance records.

### Manual Verification
1.  Log in as a Teacher and create an "Extra Class" session with a weight of 2, marking a student absent.
2.  Verify the student's aggregate attendance has absent increased by 2.
3.  Edit the session to mark the student present. Verify the aggregates corrected (absent -2, present +2).
4.  Log in as the student and confirm they can see their daily attendance logs but cannot query other students' status lists.
5.  Post a "Class Cancelled" flash announcement and verify it expires from the database exactly after 6 hours.
