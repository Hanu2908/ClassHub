-- ============================================================================
-- Migration: Close cross-section RLS gaps found by the pgTAP suite
-- Date: 2026-10-11
-- Each block names the supabase/tests/*.test.sql check it makes pass.
-- Rule kept throughout: no policy selects from its own table (42P17);
-- cross-table lookups only, or the SECURITY DEFINER helpers.
-- ============================================================================

-- ── 1. student_session_attendance: CRs read only their own section ──────────
-- The old policy let ANY user with role 'cr' read every section's logs.
-- Own-section CR reads are already covered by "CRs manage student session
-- records" (FOR ALL), so this policy keeps only the teacher branch.
-- Test: attendance_rls "CR of section B cannot read section A session logs"
DROP POLICY IF EXISTS "Teachers and CRs read all section attendance logs" ON public.student_session_attendance;
DROP POLICY IF EXISTS "Teachers read section attendance logs" ON public.student_session_attendance;
CREATE POLICY "Teachers read section attendance logs"
  ON public.student_session_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.section_teachers st ON st.section_id = s.section_id
      WHERE s.id = student_session_attendance.session_id
        AND st.teacher_id = (SELECT auth.uid())
    )
  );

-- ── 2. Register -> attendance_records sync ──────────────────────────────────
-- The trigger ran as the caller, and CRs have no INSERT policy on
-- attendance_records, so a CR marking the register failed. It now runs as
-- owner. Because that skips RLS, it first checks the student belongs to the
-- session's section (the register policies never checked student_id).
-- Test: attendance_rls "CR marks attendance in own section session",
--       "CR cannot mark a student of another section"
CREATE OR REPLACE FUNCTION public.fn_sync_session_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subject_id UUID;
  v_lecture_count INTEGER;
  v_section_id UUID;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT subject_id, lecture_count, section_id INTO v_subject_id, v_lecture_count, v_section_id
    FROM public.attendance_sessions WHERE id = NEW.session_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE id = NEW.student_id AND section_id = v_section_id
    ) THEN
      RAISE EXCEPTION 'Student is not a member of this session''s section' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT subject_id, lecture_count INTO v_subject_id, v_lecture_count
    FROM public.attendance_sessions WHERE id = OLD.session_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.attendance_records SET
      present = GREATEST(0, present - CASE WHEN OLD.status = 'present' THEN v_lecture_count ELSE 0 END),
      absent  = GREATEST(0, absent  - CASE WHEN OLD.status = 'absent'  THEN v_lecture_count ELSE 0 END),
      od      = GREATEST(0, od      - CASE WHEN OLD.status = 'od'      THEN v_lecture_count ELSE 0 END),
      makeup  = GREATEST(0, makeup  - CASE WHEN OLD.status = 'makeup'  THEN v_lecture_count ELSE 0 END),
      updated_at = now()
    WHERE user_id = OLD.student_id AND subject_id = v_subject_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO public.attendance_records (user_id, subject_id, present, absent, od, makeup)
    VALUES (NEW.student_id, v_subject_id, 0, 0, 0, 0)
    ON CONFLICT (user_id, subject_id) DO NOTHING;

    UPDATE public.attendance_records SET
      present = present + CASE WHEN NEW.status = 'present' THEN v_lecture_count ELSE 0 END,
      absent  = absent  + CASE WHEN NEW.status = 'absent'  THEN v_lecture_count ELSE 0 END,
      od      = od      + CASE WHEN NEW.status = 'od'      THEN v_lecture_count ELSE 0 END,
      makeup  = makeup  + CASE WHEN NEW.status = 'makeup'  THEN v_lecture_count ELSE 0 END,
      updated_at = now()
    WHERE user_id = NEW.student_id AND subject_id = v_subject_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_sync_session_attendance() FROM PUBLIC, anon, authenticated;

-- ── 3. section_teachers: a linked subject must belong to that section ───────
-- Neither the CR policy nor join_section_as_teacher(invite, p_subject_id)
-- checked this, and teacher read policies on attendance/submissions join on
-- subject_id alone, so a bad link exposed another section's data. A composite
-- FK covers every writer, including SECURITY DEFINER RPCs.
-- NOT VALID: existing rows are not re-checked. Find violators with
--   select st.* from section_teachers st join subjects s on s.id = st.subject_id
--   where s.section_id <> st.section_id;
-- Test: attendance_rls "CR cannot link a subject from another section"
ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_id_section_id_key;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_id_section_id_key UNIQUE (id, section_id);

ALTER TABLE public.section_teachers
  DROP CONSTRAINT IF EXISTS section_teachers_subject_in_section_fkey;
ALTER TABLE public.section_teachers
  ADD CONSTRAINT section_teachers_subject_in_section_fkey
  FOREIGN KEY (subject_id, section_id) REFERENCES public.subjects (id, section_id)
  ON DELETE SET NULL (subject_id)
  NOT VALID;

-- ── 4. counsellor_notes: only a counsellor of the student's section writes ──
-- The old WITH CHECK was only counsellor_id = auth.uid(), so any user could
-- write a "counsellor remark" about any student in any section.
-- Test: counsellor_notes_rls "student cannot write a counsellor note...",
--       "counsellor cannot write a note for a student in a section they do not teach"
DROP POLICY IF EXISTS "Counsellors manage own remarks" ON public.counsellor_notes;
CREATE POLICY "Counsellors manage own remarks" ON public.counsellor_notes
  FOR ALL TO authenticated
  USING (counsellor_id = (SELECT auth.uid()))
  WITH CHECK (
    counsellor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.section_teachers st
      JOIN public.users u ON u.section_id = st.section_id
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.is_counsellor_for_batch IS NOT NULL
        AND u.id = counsellor_notes.student_id
    )
  );

-- The column lock keyed on role = 'student', so a CR who is the subject of a
-- note could rewrite the remark. Key on "caller is this note's student".
-- Test: counsellor_notes_rls "CR cannot rewrite a counsellor remark written about them"
CREATE OR REPLACE FUNCTION public.check_student_counsellor_notes_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) = OLD.student_id THEN
    IF NEW.counsellor_id IS DISTINCT FROM OLD.counsellor_id OR
       NEW.student_id IS DISTINCT FROM OLD.student_id OR
       NEW.note_text IS DISTINCT FROM OLD.note_text OR
       NEW.counsellor_remark_updated_at IS DISTINCT FROM OLD.counsellor_remark_updated_at THEN
      RAISE EXCEPTION 'Students are only permitted to update their response text.';
    END IF;
    NEW.student_response_updated_at := NOW();
  ELSIF NEW.note_text IS DISTINCT FROM OLD.note_text THEN
    NEW.counsellor_remark_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. submissions: rows stay inside the assignment's section ───────────────
-- Student branch never pinned the assignment's section on UPDATE; CR branch
-- never checked the student is in the CR's section (INSERT or UPDATE).
-- Test: coursework_rls "student cannot move own submission onto another
--       section's assignment", "CR cannot create a submission row for a
--       student of another section"
DROP POLICY IF EXISTS "authenticated_insert_submissions" ON public.submissions;
CREATE POLICY "authenticated_insert_submissions"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (
  (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND a.section_id = (SELECT public.current_user_section_id())
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.users u ON u.id = submissions.student_id AND u.section_id = a.section_id
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
);

DROP POLICY IF EXISTS "authenticated_update_submissions" ON public.submissions;
CREATE POLICY "authenticated_update_submissions"
ON public.submissions FOR UPDATE TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
)
WITH CHECK (
  (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND a.section_id = (SELECT public.current_user_section_id())
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.users u ON u.id = submissions.student_id AND u.section_id = a.section_id
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
);

-- ── 6. announcement_comments: pin immutable columns in the trigger ──────────
-- RLS cannot compare OLD and NEW, so the old WITH CHECK (id = id,
-- content = content, ...) was always true. The BEFORE UPDATE trigger now
-- rejects changes to identity columns and content edits by non-authors.
-- auth.uid() is null for service-role/maintenance updates, which skip checks.
-- Test: announcement_engagement_rls "author cannot move created_at forward",
--       "CR cannot rewrite a student's comment"
CREATE OR REPLACE FUNCTION public.handle_announcement_comment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.announcement_id IS DISTINCT FROM OLD.announcement_id OR
       NEW.author_id IS DISTINCT FROM OLD.author_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'A comment''s id, announcement, author and created_at cannot change'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content AND (SELECT auth.uid()) IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'Only the author can edit a comment' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "authenticated_update_comments" ON public.announcement_comments;
CREATE POLICY "authenticated_update_comments"
ON public.announcement_comments FOR UPDATE TO authenticated
USING (
  (
    (SELECT auth.uid()) = author_id
    AND is_verified = false
    AND created_at > now() - interval '15 minutes'
  )
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
)
WITH CHECK (
  ((SELECT auth.uid()) = author_id AND is_verified = false)
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
);
