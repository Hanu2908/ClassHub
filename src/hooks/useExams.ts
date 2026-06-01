import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Exam, StudentExamPrep } from '../store/appStore';

// ── Helper: current user context ─────────────────────────────────────────────

function useAuthContext() {
  const authUser = useAppStore(s => s.authUser);
  const session = useAppStore(s => s.session);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const isDemo = authUser?.sectionId === 'demo-section';
  const isAuthenticated = !!session || isDemo;
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
    isAuthLoading,
    isAuthenticated,
  };
}

// ── Exams Query ──────────────────────────────────────────────────────────────

export function useExams() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<Exam[]>({
    queryKey: ['exams', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      // 1. Fetch active subjects in this section
      const { data: subjects, error: subjError } = await supabase
        .from('subjects')
        .select('code')
        .eq('section_id', sectionId!);
      if (subjError) throw subjError;

      const subjectCodes = (subjects ?? []).map(s => s.code);
      if (subjectCodes.length === 0) return [];

      // 2. Fetch base exams filtered by subject codes, and join section-specific overrides
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          *,
          exam_overrides (
            id,
            room,
            seating_plan_path,
            section_id
          )
        `)
        .in('subject_code', subjectCodes)
        .order('exam_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (examsError) throw examsError;

      return (examsData ?? []).map((e: any) => {
        // Find override for current section
        const overrides = e.exam_overrides || [];
        const sectionOverride = overrides.find((o: any) => o.section_id === sectionId);

        return {
          id: e.id,
          semester: e.semester,
          subjectCode: e.subject_code,
          subjectName: e.subject_name,
          examType: e.exam_type,
          examDate: e.exam_date,
          startTime: e.start_time,
          endTime: e.end_time,
          maxMarks: e.max_marks,
          room: e.room,
          seatingPlanPath: e.seating_plan_path,
          syllabusUnits: e.syllabus_units || [],
          syllabusPdfPath: e.syllabus_pdf_path,
          activeRoom: sectionOverride?.room || e.room,
          activeSeatingPlan: sectionOverride?.seating_plan_path || e.seating_plan_path,
          baseCreatorId: e.created_by,
          overrideId: sectionOverride?.id || null,
          createdAt: e.created_at,
          createdBy: e.created_by
        };
      });
    }
  });
}

// ── Student Exam Preparation Query ───────────────────────────────────────────

export function useStudentExamPrep(examId: string) {
  const { userId, isAuthenticated } = useAuthContext();
  return useQuery<StudentExamPrep[]>({
    queryKey: ['student_exam_prep', examId, userId],
    enabled: !!examId && !!userId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_exam_prep')
        .select('*')
        .eq('exam_id', examId)
        .eq('user_id', userId!);
      if (error) throw error;

      return (data ?? []).map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        examId: p.exam_id,
        unitIndex: p.unit_index,
        isPrepared: p.is_prepared
      }));
    }
  });
}

// ── Upsert Exam Mutation ─────────────────────────────────────────────────────

export function useUpsertExam() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (exam: {
      id?: string;
      isEdit?: boolean;
      semester: number;
      subjectCode: string;
      subjectName: string;
      examType: string;
      examDate: string;
      startTime: string;
      endTime: string;
      maxMarks?: number | null;
      room?: string | null;
      syllabusUnits?: string[];
      syllabusPdfPath?: string | null;
      seatingPlanPath?: string | null;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const payload: any = {
        semester: exam.semester,
        subject_code: exam.subjectCode,
        subject_name: exam.subjectName,
        exam_type: exam.examType,
        exam_date: exam.examDate,
        start_time: exam.startTime,
        end_time: exam.endTime,
        max_marks: exam.maxMarks ?? null,
        room: exam.room ?? null,
        syllabus_units: exam.syllabusUnits ?? [],
        syllabus_pdf_path: exam.syllabusPdfPath ?? null,
        seating_plan_path: exam.seatingPlanPath ?? null,
        created_by: userId
      };

      if (exam.isEdit && exam.id) {
        const { error } = await supabase
          .from('exams')
          .update(payload)
          .eq('id', exam.id);
        if (error) throw error;
      } else {
        if (exam.id) {
          payload.id = exam.id;
        }
        const { error } = await supabase
          .from('exams')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
    }
  });
}

// ── Delete Exam Mutation ─────────────────────────────────────────────────────

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (examId: string) => {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
    }
  });
}

// ── Upsert Exam Override Mutation ────────────────────────────────────────────

export function useUpsertExamOverride() {
  const qc = useQueryClient();
  const { userId, sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (override: {
      examId: string;
      room?: string | null;
      seatingPlanPath?: string | null;
    }) => {
      if (!sectionId) throw new Error('Missing section context');
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('exam_overrides')
        .upsert({
          section_id: sectionId,
          exam_id: override.examId,
          room: override.room ?? null,
          seating_plan_path: override.seatingPlanPath ?? null,
          created_by: userId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_id,exam_id'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
    }
  });
}

// ── Upsert Student Preparation Mutation ──────────────────────────────────────

export function useUpsertStudentExamPrep() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (prep: {
      examId: string;
      unitIndex: number;
      isPrepared: boolean;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('student_exam_prep')
        .upsert({
          user_id: userId,
          exam_id: prep.examId,
          unit_index: prep.unitIndex,
          is_prepared: prep.isPrepared,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,exam_id,unit_index'
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['student_exam_prep', variables.examId, userId] });
    }
  });
}
