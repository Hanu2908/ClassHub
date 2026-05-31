-- Sprint 4: Exam System and Personal Preparation Schema

-- 1. Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester             INTEGER NOT NULL,
    subject_code         TEXT NOT NULL,
    subject_name         TEXT NOT NULL,
    exam_type            TEXT NOT NULL, -- "MST-1", "MST-2", "End-Sem", "Lab External", "Quiz", etc.
    exam_date            DATE NOT NULL,
    start_time           TIME NOT NULL,
    end_time             TIME NOT NULL,
    max_marks            INTEGER,
    room                 TEXT, -- Centralized default room
    syllabus_units       TEXT[] DEFAULT '{}'::TEXT[], -- Syllabus checklist elements
    syllabus_pdf_path    TEXT, -- Supabase Storage file path to syllabus PDF
    seating_plan_path    TEXT, -- Supabase Storage file path to centralized seating plan
    created_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create exam_overrides table
CREATE TABLE IF NOT EXISTS public.exam_overrides (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id           UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    exam_id              UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    room                 TEXT, -- Section room override
    seating_plan_path    TEXT, -- Section seating plan override
    created_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(section_id, exam_id)
);

-- 3. Create student_exam_prep table
CREATE TABLE IF NOT EXISTS public.student_exam_prep (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exam_id              UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    unit_index           INTEGER NOT NULL, -- Index reference in syllabus_units
    is_prepared          BOOLEAN NOT NULL DEFAULT false,
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, exam_id, unit_index)
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_prep ENABLE ROW LEVEL SECURITY;

-- 5. Grant Permissions to Authenticated Users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_exam_prep TO authenticated;

-- 6. Create RLS Policies for public.exams
DROP POLICY IF EXISTS "Authenticated users read exams" ON public.exams;
CREATE POLICY "Authenticated users read exams"
ON public.exams FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "CR creates exams" ON public.exams;
CREATE POLICY "CR creates exams"
ON public.exams FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_user_role()) = 'cr');

DROP POLICY IF EXISTS "CR updates exams" ON public.exams;
CREATE POLICY "CR updates exams"
ON public.exams FOR UPDATE TO authenticated
USING ((SELECT public.current_user_role()) = 'cr')
WITH CHECK ((SELECT public.current_user_role()) = 'cr');

DROP POLICY IF EXISTS "Creator CR deletes exams" ON public.exams;
CREATE POLICY "Creator CR deletes exams"
ON public.exams FOR DELETE TO authenticated
USING (created_by = (SELECT auth.uid()) AND (SELECT public.current_user_role()) = 'cr');

-- 7. Create RLS Policies for public.exam_overrides
DROP POLICY IF EXISTS "Section members read overrides" ON public.exam_overrides;
CREATE POLICY "Section members read overrides"
ON public.exam_overrides FOR SELECT TO authenticated
USING (section_id = (SELECT public.current_user_section_id()));

DROP POLICY IF EXISTS "CR manages overrides" ON public.exam_overrides;
CREATE POLICY "CR manages overrides"
ON public.exam_overrides FOR ALL TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id));

-- 8. Create RLS Policies for public.student_exam_prep
DROP POLICY IF EXISTS "Students manage own exam prep" ON public.student_exam_prep;
CREATE POLICY "Students manage own exam prep"
ON public.student_exam_prep FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- 9. Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_exams_sem_sub ON public.exams(semester, subject_code);
CREATE INDEX IF NOT EXISTS idx_exam_overrides_exam ON public.exam_overrides(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_prep_user_exam ON public.student_exam_prep(user_id, exam_id);
