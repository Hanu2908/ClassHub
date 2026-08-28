-- Migration: 20260828000000_unit_tests.sql
-- Description: Unit Tests (UT-1 and UT-2) and student submissions tracking

CREATE TABLE IF NOT EXISTS unit_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  test_type       TEXT NOT NULL CHECK (test_type IN ('UT1', 'UT2')),
  title           TEXT NOT NULL,
  form_url        TEXT,
  due_date        TIMESTAMPTZ NOT NULL,
  max_marks       INTEGER NOT NULL DEFAULT 10,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_tests_section ON unit_tests(section_id);
CREATE INDEX IF NOT EXISTS idx_unit_tests_due_date ON unit_tests(due_date);

CREATE TABLE IF NOT EXISTS unit_test_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_test_id    UUID NOT NULL REFERENCES unit_tests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted')),
  marks_obtained  NUMERIC(5,2),
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (unit_test_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ut_submissions_user ON unit_test_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_ut_submissions_test ON unit_test_submissions(unit_test_id);

-- Enable RLS
ALTER TABLE unit_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_test_submissions ENABLE ROW LEVEL SECURITY;

-- unit_tests RLS Policies
CREATE POLICY "unit_tests_select_section" ON unit_tests
  FOR SELECT TO authenticated
  USING (
    section_id IN (
      SELECT section_id FROM users WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "unit_tests_insert_cr_teacher" ON unit_tests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_cr_for_section(section_id)
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND section_id = unit_tests.section_id
        AND role IN ('cr', 'teacher')
    )
  );

CREATE POLICY "unit_tests_update_cr_teacher" ON unit_tests
  FOR UPDATE TO authenticated
  USING (
    public.is_cr_for_section(section_id)
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND section_id = unit_tests.section_id
        AND role IN ('cr', 'teacher')
    )
  );

CREATE POLICY "unit_tests_delete_cr_teacher" ON unit_tests
  FOR DELETE TO authenticated
  USING (
    public.is_cr_for_section(section_id)
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND section_id = unit_tests.section_id
        AND role IN ('cr', 'teacher')
    )
  );

-- unit_test_submissions RLS Policies
CREATE POLICY "ut_submissions_select_student_or_cr" ON unit_test_submissions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM users u
      JOIN unit_tests ut ON ut.section_id = u.section_id
      WHERE ut.id = unit_test_submissions.unit_test_id
        AND u.id = (SELECT auth.uid())
        AND u.role IN ('cr', 'teacher')
    )
  );

CREATE POLICY "ut_submissions_insert_self" ON unit_test_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "ut_submissions_update_self" ON unit_test_submissions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "ut_submissions_delete_self" ON unit_test_submissions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
