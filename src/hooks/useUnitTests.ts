import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './useAuthContext';
import { toast } from 'sonner';

export interface UnitTest {
  id: string;
  sectionId: string;
  subjectId: string;
  subject: string;
  subjectCode?: string;
  createdBy: string;
  testType: 'UT1' | 'UT2';
  title: string;
  formUrl?: string | null;
  dueDate: string;
  maxMarks: number;
  description?: string | null;
  createdAt: string;
  isSubmitted: boolean;
  marksObtained?: number | null;
  submittedAt?: string | null;
}

export interface UnitTestRosterStudent {
  userId: string;
  name: string;
  sectionRoll: string | null;
  universityRoll: string | null;
  isSubmitted: boolean;
  marksObtained: number | null;
  submittedAt: string | null;
}

const DEMO_UNIT_TESTS: UnitTest[] = [
  {
    id: 'demo-ut-1',
    sectionId: 'demo-section',
    subjectId: 'demo-subj-1',
    subject: 'Statistics and Probability Theory',
    subjectCode: 'MAUL301',
    createdBy: 'demo-cr',
    testType: 'UT1',
    title: 'Unit 1: Probability Distributions & Bayes Theorem',
    formUrl: 'https://forms.google.com',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    maxMarks: 10,
    description: '10 MCQs on Normal & Binomial Distributions. Submit before 5:00 PM.',
    createdAt: new Date().toISOString(),
    isSubmitted: false,
    marksObtained: null,
    submittedAt: null,
  },
  {
    id: 'demo-ut-2',
    sectionId: 'demo-section',
    subjectId: 'demo-subj-2',
    subject: 'Data Structures & Algorithms',
    subjectCode: 'CSUL302',
    createdBy: 'demo-cr',
    testType: 'UT1',
    title: 'Unit 1 & 2: Asymptotic Analysis & Recursion',
    formUrl: 'https://forms.google.com',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    maxMarks: 10,
    description: 'Pre-Midterm 1 evaluation quiz.',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    isSubmitted: true,
    marksObtained: 9,
    submittedAt: new Date(Date.now() - 86400000 * 1.5).toISOString(),
  }
];

// ── Query: useUnitTests ───────────────────────────────────────────────────────
export function useUnitTests() {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useQuery<UnitTest[]>({
    queryKey: ['unit_tests', sectionId, userId],
    enabled: !!sectionId && (isAuthenticated || isDemo),
    staleTime: 1000 * 60, // 1 minute
    queryFn: async () => {
      if (isDemo) return DEMO_UNIT_TESTS;
      if (!sectionId) return [];

      // Fetch unit tests for this section
      const { data: tests, error: testsErr } = await supabase
        .from('unit_tests')
        .select(`
          id, section_id, subject_id, created_by, test_type, title,
          form_url, due_date, max_marks, description, created_at,
          subjects:subject_id (code, name)
        `)
        .eq('section_id', sectionId)
        .order('due_date', { ascending: true });

      if (testsErr) {
        console.error('Failed to fetch unit tests:', testsErr);
        throw testsErr;
      }

      if (!tests || tests.length === 0) return [];

      // Fetch current user's submissions
      const { data: submissions, error: subErr } = await supabase
        .from('unit_test_submissions')
        .select('unit_test_id, status, marks_obtained, submitted_at')
        .eq('user_id', userId!);

      if (subErr) {
        console.error('Failed to fetch unit test submissions:', subErr);
      }

      const subMap = new Map<string, { marksObtained: number | null; submittedAt: string }>();
      submissions?.forEach(s => {
        subMap.set(s.unit_test_id, {
          marksObtained: s.marks_obtained,
          submittedAt: s.submitted_at
        });
      });

      return tests.map((t: any): UnitTest => {
        const sub = subMap.get(t.id);
        const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
        return {
          id: t.id,
          sectionId: t.section_id,
          subjectId: t.subject_id,
          subject: subj?.name || 'General Subject',
          subjectCode: subj?.code || '',
          createdBy: t.created_by,
          testType: t.test_type,
          title: t.title || `${subj?.name || 'Subject'} - ${t.test_type}`,
          formUrl: t.form_url || null,
          dueDate: t.due_date,
          maxMarks: t.max_marks ?? 10,
          description: t.description,
          createdAt: t.created_at,
          isSubmitted: !!sub,
          marksObtained: sub?.marksObtained ?? null,
          submittedAt: sub?.submittedAt ?? null,
        };
      });
    },
  });
}

// ── Mutation: useCreateUnitTest ──────────────────────────────────────────────
export function useCreateUnitTest() {
  const queryClient = useQueryClient();
  const { sectionId, userId } = useAuthContext();

  return useMutation({
    mutationFn: async (payload: {
      subjectId: string;
      testType: 'UT1' | 'UT2';
      title?: string;
      formUrl?: string | null;
      dueDate: string;
      maxMarks?: number;
      description?: string;
    }) => {
      if (!sectionId || !userId) throw new Error('Unauthenticated');

      const { data, error } = await supabase
        .from('unit_tests')
        .insert({
          section_id: sectionId,
          subject_id: payload.subjectId,
          created_by: userId,
          test_type: payload.testType,
          title: payload.title?.trim() || '',
          form_url: payload.formUrl ? payload.formUrl.trim() : null,
          due_date: payload.dueDate,
          max_marks: payload.maxMarks ?? 10,
          description: payload.description?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit_tests'] });
      toast.success('Unit Test published successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to publish Unit Test');
    },
  });
}

// ── Mutation: useUpdateUnitTest ──────────────────────────────────────────────
export function useUpdateUnitTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      subjectId?: string;
      testType?: 'UT1' | 'UT2';
      title?: string;
      formUrl?: string | null;
      dueDate?: string;
      maxMarks?: number;
      description?: string;
    }) => {
      const updates: any = {};
      if (payload.subjectId) updates.subject_id = payload.subjectId;
      if (payload.testType) updates.test_type = payload.testType;
      if (payload.title !== undefined) updates.title = payload.title.trim();
      if (payload.formUrl !== undefined) updates.form_url = payload.formUrl ? payload.formUrl.trim() : null;
      if (payload.dueDate) updates.due_date = payload.dueDate;
      if (payload.maxMarks !== undefined) updates.max_marks = payload.maxMarks;
      if (payload.description !== undefined) updates.description = payload.description ? payload.description.trim() : null;

      const { data, error } = await supabase
        .from('unit_tests')
        .update(updates)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit_tests'] });
      toast.success('Unit Test updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update Unit Test');
    },
  });
}

// ── Mutation: useDeleteUnitTest ──────────────────────────────────────────────
export function useDeleteUnitTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase
        .from('unit_tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
      return testId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit_tests'] });
      toast.info('Unit Test deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete Unit Test');
    },
  });
}

// ── Mutation: useToggleUnitTestSubmission ────────────────────────────────────
export function useToggleUnitTestSubmission() {
  const queryClient = useQueryClient();
  const { userId } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      unitTestId,
      isSubmitted,
      marksObtained,
    }: {
      unitTestId: string;
      isSubmitted: boolean;
      marksObtained?: number | null;
    }) => {
      if (!userId) throw new Error('Unauthenticated');

      if (isSubmitted) {
        // Upsert submission
        const { error } = await supabase
          .from('unit_test_submissions')
          .upsert(
            {
              unit_test_id: unitTestId,
              user_id: userId,
              status: 'submitted',
              marks_obtained: marksObtained ?? null,
              submitted_at: new Date().toISOString(),
            },
            { onConflict: 'unit_test_id,user_id' }
          );
        if (error) throw error;
      } else {
        // Remove submission
        const { error } = await supabase
          .from('unit_test_submissions')
          .delete()
          .eq('unit_test_id', unitTestId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit_tests'] });
      if (variables.isSubmitted) {
        toast.success('Marked as submitted ✓');
      } else {
        toast.info('Marked as unsubmitted');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update submission status');
    },
  });
}

// ── Query: useUnitTestRoster (For CR/Teacher) ─────────────────────────────────
export function useUnitTestRoster(unitTestId: string | null) {
  const { sectionId } = useAuthContext();

  return useQuery<UnitTestRosterStudent[]>({
    queryKey: ['unit_test_roster', unitTestId, sectionId],
    enabled: !!unitTestId && !!sectionId,
    queryFn: async () => {
      if (!unitTestId || !sectionId) return [];

      // Get all section students
      const { data: students, error: stuErr } = await supabase
        .from('users')
        .select('id, name, section_roll, university_roll')
        .eq('section_id', sectionId)
        .order('section_roll', { ascending: true });

      if (stuErr) throw stuErr;
      if (!students) return [];

      // Get all submissions for this unit test
      const { data: subs, error: subsErr } = await supabase
        .from('unit_test_submissions')
        .select('user_id, marks_obtained, submitted_at')
        .eq('unit_test_id', unitTestId);

      if (subsErr) throw subsErr;

      const subMap = new Map<string, { marks: number | null; submittedAt: string }>();
      subs?.forEach(s => {
        subMap.set(s.user_id, {
          marks: s.marks_obtained,
          submittedAt: s.submitted_at
        });
      });

      return students.map((st): UnitTestRosterStudent => {
        const submission = subMap.get(st.id);
        return {
          userId: st.id,
          name: st.name,
          sectionRoll: st.section_roll,
          universityRoll: st.university_roll,
          isSubmitted: !!submission,
          marksObtained: submission?.marks ?? null,
          submittedAt: submission?.submittedAt ?? null,
        };
      });
    },
  });
}
