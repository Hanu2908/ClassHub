-- Migration: Teacher and Batch Management System
-- Date: 2026-06-14

-- 1. Alter public.user_role ENUM to add 'teacher'
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';

-- 2. Add sub_batch column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sub_batch text CHECK (sub_batch IN ('1', '2'));

-- 3. Add target_batch column to announcements, assignments, and timetable_slots
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));
ALTER TABLE public.timetable_slots ADD COLUMN IF NOT EXISTS target_batch text CHECK (target_batch IN ('1', '2'));

-- 4. Add teacher_invite_code column to public.sections
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS teacher_invite_code text UNIQUE;

-- 5. Create section_teachers junction table
CREATE TABLE IF NOT EXISTS public.section_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_counsellor_for_batch text CHECK (is_counsellor_for_batch IN ('1', '2')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, teacher_id, subject_id)
);

-- 6. Create mass_bunks and mass_bunk_votes tables
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
  vote_choice text NOT NULL CHECK (vote_choice IN ('bunk', 'class')),
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mass_bunk_id, student_id)
);

-- 7. Create counsellor_notes table
CREATE TABLE IF NOT EXISTS public.counsellor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (counsellor_id, student_id)
);

-- 8. Enable RLS on new tables
ALTER TABLE public.section_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_bunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_bunk_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counsellor_notes ENABLE ROW LEVEL SECURITY;

-- 9. Setup RLS Policies for new tables

-- section_teachers Policies
CREATE POLICY "Anyone authenticated can read section teachers"
  ON public.section_teachers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "CR manages section teachers"
  ON public.section_teachers FOR ALL TO authenticated
  USING (public.is_cr_for_section(section_id))
  WITH CHECK (public.is_cr_for_section(section_id));

-- mass_bunks Policies
CREATE POLICY "Students and CR read section mass bunks"
  ON public.mass_bunks FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND section_id = (SELECT public.current_user_section_id())
  );

CREATE POLICY "Students create mass bunks"
  ON public.mass_bunks FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND created_by = auth.uid()
    AND section_id = (SELECT public.current_user_section_id())
  );

CREATE POLICY "Students and CR manage own section mass bunks"
  ON public.mass_bunks FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND section_id = (SELECT public.current_user_section_id())
  );

-- mass_bunk_votes Policies
CREATE POLICY "Students and CR read mass bunk votes"
  ON public.mass_bunk_votes FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
  );

CREATE POLICY "Students cast mass bunk votes"
  ON public.mass_bunk_votes FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND student_id = auth.uid()
  );

CREATE POLICY "Students update own mass bunk votes"
  ON public.mass_bunk_votes FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND student_id = auth.uid()
  );

-- counsellor_notes Policies
CREATE POLICY "Counsellors manage own remarks"
  ON public.counsellor_notes FOR ALL TO authenticated
  USING (counsellor_id = auth.uid())
  WITH CHECK (counsellor_id = auth.uid());

-- 10. Update RLS Policies on existing tables to grant teacher access

-- Users Table: Allow teachers to read directory
CREATE POLICY "Teachers read members in sections they teach"
  ON public.users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = users.section_id
    )
  );

-- Timetable Slots: Allow teachers to view slots
CREATE POLICY "Teachers read timetable in sections they teach"
  ON public.timetable_slots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = timetable_slots.section_id
    )
  );

-- Announcements: Allow teachers to read/manage section announcements
CREATE POLICY "Teachers read announcements in sections they teach"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = announcements.section_id
    )
  );

CREATE POLICY "Teachers manage own announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = announcements.section_id
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = announcements.section_id
    )
  );

-- Assignments: Allow teachers to read/manage section assignments
CREATE POLICY "Teachers read assignments in sections they teach"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = assignments.section_id
    )
  );

CREATE POLICY "Teachers manage own assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = assignments.section_id
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.section_id = assignments.section_id
    )
  );

-- Submissions: Allow teachers to read student submissions
CREATE POLICY "Teachers read submissions for own assignments"
  ON public.submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND a.created_by = auth.uid()
    )
  );

-- Attendance Records: Allow teachers to read/update attendance
CREATE POLICY "Teachers read attendance in sections they teach"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.subject_id = attendance_records.subject_id
    )
  );

CREATE POLICY "Teachers update attendance for own subject"
  ON public.attendance_records FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.subject_id = attendance_records.subject_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = auth.uid()
        AND st.subject_id = attendance_records.subject_id
    )
  );

-- 11. Add Indexes for junction tables and search targets
CREATE INDEX IF NOT EXISTS section_teachers_teacher_idx ON public.section_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS section_teachers_section_idx ON public.section_teachers(section_id);
CREATE INDEX IF NOT EXISTS mass_bunks_section_idx ON public.mass_bunks(section_id);
CREATE INDEX IF NOT EXISTS mass_bunk_votes_bunk_idx ON public.mass_bunk_votes(mass_bunk_id);
CREATE INDEX IF NOT EXISTS counsellor_notes_student_idx ON public.counsellor_notes(student_id);
