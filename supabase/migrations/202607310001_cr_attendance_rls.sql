-- Migration: CR Direct Class Attendance RLS Policies
-- Date: 2026-07-31

-- Allow CRs (Primary & Co-CRs) to manage attendance sessions in their own section
CREATE POLICY "CRs manage section attendance sessions"
  ON public.attendance_sessions FOR ALL TO authenticated
  USING (
    section_id = (SELECT public.current_user_section_id())
    AND (SELECT public.current_user_role()) = 'cr'::public.user_role
  )
  WITH CHECK (
    section_id = (SELECT public.current_user_section_id())
    AND (SELECT public.current_user_role()) = 'cr'::public.user_role
  );

-- Allow CRs (Primary & Co-CRs) to insert and update student session markings in their own section
CREATE POLICY "CRs manage student session records"
  ON public.student_session_attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = student_session_attendance.session_id
        AND s.section_id = (SELECT public.current_user_section_id())
        AND (SELECT public.current_user_role()) = 'cr'::public.user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = student_session_attendance.session_id
        AND s.section_id = (SELECT public.current_user_section_id())
        AND (SELECT public.current_user_role()) = 'cr'::public.user_role
    )
  );
