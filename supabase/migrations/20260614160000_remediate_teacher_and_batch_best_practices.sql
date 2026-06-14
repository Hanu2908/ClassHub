-- Migration: Remediate Teacher and Batch Management Best Practices
-- Date: 2026-06-14

-- ============================================================================
-- 1. Create Missing Foreign Key Indexes (schema-foreign-key-indexes)
-- ============================================================================
CREATE INDEX IF NOT EXISTS section_teachers_subject_idx ON public.section_teachers(subject_id);
CREATE INDEX IF NOT EXISTS mass_bunks_created_by_idx ON public.mass_bunks(created_by);
CREATE INDEX IF NOT EXISTS mass_bunks_subject_idx ON public.mass_bunks(subject_id);
CREATE INDEX IF NOT EXISTS mass_bunks_timetable_slot_idx ON public.mass_bunks(timetable_slot_id);
CREATE INDEX IF NOT EXISTS mass_bunk_votes_student_idx ON public.mass_bunk_votes(student_id);
CREATE INDEX IF NOT EXISTS counsellor_notes_counsellor_idx ON public.counsellor_notes(counsellor_id);

-- ============================================================================
-- 2. Optimize RLS Policies with Cached Subqueries (security-rls-performance)
-- ============================================================================

-- mass_bunks Table Policies
DROP POLICY IF EXISTS mass_bunks_student_insert ON public.mass_bunks;
CREATE POLICY mass_bunks_student_insert ON public.mass_bunks
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND created_by = (SELECT auth.uid())
    AND section_id = (SELECT public.current_user_section_id())
  );

-- mass_bunk_votes Table Policies
DROP POLICY IF EXISTS mass_bunk_votes_student_insert ON public.mass_bunk_votes;
CREATE POLICY mass_bunk_votes_student_insert ON public.mass_bunk_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND student_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Students cast mass bunk votes" ON public.mass_bunk_votes;
CREATE POLICY "Students cast mass bunk votes" ON public.mass_bunk_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND student_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Students update own mass bunk votes" ON public.mass_bunk_votes;
CREATE POLICY "Students update own mass bunk votes" ON public.mass_bunk_votes
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) != 'teacher'::public.user_role
    AND student_id = (SELECT auth.uid())
  );

-- counsellor_notes Table Policies
DROP POLICY IF EXISTS "Counsellors manage own remarks" ON public.counsellor_notes;
CREATE POLICY "Counsellors manage own remarks" ON public.counsellor_notes
  FOR ALL TO authenticated
  USING (counsellor_id = (SELECT auth.uid()))
  WITH CHECK (counsellor_id = (SELECT auth.uid()));

-- public.users Table Policies (Granting Teacher Access)
DROP POLICY IF EXISTS "Teachers read members in sections they teach" ON public.users;
CREATE POLICY "Teachers read members in sections they teach" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = users.section_id
    )
  );

-- public.timetable_slots Table Policies
DROP POLICY IF EXISTS "Teachers read timetable in sections they teach" ON public.timetable_slots;
CREATE POLICY "Teachers read timetable in sections they teach" ON public.timetable_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = timetable_slots.section_id
    )
  );

-- public.announcements Table Policies
DROP POLICY IF EXISTS "Teachers read announcements in sections they teach" ON public.announcements;
CREATE POLICY "Teachers read announcements in sections they teach" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = announcements.section_id
    )
  );

DROP POLICY IF EXISTS "Teachers manage own announcements" ON public.announcements;
CREATE POLICY "Teachers manage own announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = announcements.section_id
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = announcements.section_id
    )
  );

-- public.assignments Table Policies
DROP POLICY IF EXISTS "Teachers read assignments in sections they teach" ON public.assignments;
CREATE POLICY "Teachers read assignments in sections they teach" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = assignments.section_id
    )
  );

DROP POLICY IF EXISTS "Teachers manage own assignments" ON public.assignments;
CREATE POLICY "Teachers manage own assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = assignments.section_id
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = assignments.section_id
    )
  );

-- public.submissions Table Policies
DROP POLICY IF EXISTS "Teachers read submissions for own assignments" ON public.submissions;
CREATE POLICY "Teachers read submissions for own assignments" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND a.created_by = (SELECT auth.uid())
    )
  );

-- public.attendance_records Table Policies
DROP POLICY IF EXISTS "Teachers read attendance in sections they teach" ON public.attendance_records;
CREATE POLICY "Teachers read attendance in sections they teach" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.subject_id = attendance_records.subject_id
    )
  );

DROP POLICY IF EXISTS "Teachers update attendance for own subject" ON public.attendance_records;
CREATE POLICY "Teachers update attendance for own subject" ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.subject_id = attendance_records.subject_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.subject_id = attendance_records.subject_id
    )
  );

-- public.notification_events Table Policies
DROP POLICY IF EXISTS "CR and Teachers create notification events" ON public.notification_events;
CREATE POLICY "CR and Teachers create notification events" ON public.notification_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_role()) IN ('cr'::public.user_role, 'teacher'::public.user_role)
    AND actor_id = (SELECT auth.uid())
  );
