-- Migration: Digital Attendance Register System
-- Date: 2026-06-14

-- 1. Create tables with constraints
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

CREATE TABLE IF NOT EXISTS public.student_session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'od', 'makeup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 2. Index all Foreign Key columns to prevent Seq Scans and table locks (schema-foreign-key-indexes)
CREATE INDEX IF NOT EXISTS attendance_sessions_section_idx ON public.attendance_sessions(section_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_subject_idx ON public.attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_teacher_idx ON public.attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_slot_idx ON public.attendance_sessions(timetable_slot_id);

CREATE INDEX IF NOT EXISTS student_session_attendance_session_idx ON public.student_session_attendance(session_id);
CREATE INDEX IF NOT EXISTS student_session_attendance_student_idx ON public.student_session_attendance(student_id);

-- 3. Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_session_attendance ENABLE ROW LEVEL SECURITY;

-- 4. Create optimized RLS Policies (using cached subqueries (SELECT auth.uid()))

-- attendance_sessions Policies
CREATE POLICY "Users read attendance sessions in their section"
  ON public.attendance_sessions FOR SELECT TO authenticated
  USING (
    section_id = (SELECT public.current_user_section_id())
    OR EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = attendance_sessions.section_id
    )
  );

CREATE POLICY "Teachers create and manage own sessions"
  ON public.attendance_sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = attendance_sessions.section_id
        AND st.subject_id = attendance_sessions.subject_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = attendance_sessions.section_id
        AND st.subject_id = attendance_sessions.subject_id
    )
  );

-- student_session_attendance Policies
CREATE POLICY "Students read own daily status log"
  ON public.student_session_attendance FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "Teachers and CRs read all section attendance logs"
  ON public.student_session_attendance FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'cr'::public.user_role
    OR EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.section_teachers st ON st.section_id = s.section_id
      WHERE s.id = student_session_attendance.session_id
        AND st.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers manage student session records"
  ON public.student_session_attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.section_teachers st ON st.section_id = s.section_id AND st.subject_id = s.subject_id
      WHERE s.id = student_session_attendance.session_id
        AND st.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.section_teachers st ON st.section_id = s.section_id AND st.subject_id = s.subject_id
      WHERE s.id = student_session_attendance.session_id
        AND st.teacher_id = (SELECT auth.uid())
    )
  );

-- 5. Trigger Function to sync aggregates
CREATE OR REPLACE FUNCTION public.fn_sync_session_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_id UUID;
  v_lecture_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Fetch session details
    SELECT subject_id, lecture_count INTO v_subject_id, v_lecture_count
    FROM public.attendance_sessions WHERE id = NEW.session_id;

    -- Ensure aggregate row exists
    INSERT INTO public.attendance_records (user_id, subject_id, present, absent, od, makeup)
    VALUES (NEW.student_id, v_subject_id, 0, 0, 0, 0)
    ON CONFLICT (user_id, subject_id) DO NOTHING;

    -- Increment status
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

    -- Decrement status
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

-- 6. Attach trigger
CREATE OR REPLACE TRIGGER tr_sync_session_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.student_session_attendance
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_session_attendance();
