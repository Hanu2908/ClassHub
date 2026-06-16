import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './useAuthContext';



export interface GlobalResource {
  id: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  branch: string;
  accentColor: string;
  syllabusUrl: string;
  notesUrl: string;
  pyqsUrl: string;
  practiceUrl: string;
  labUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface GlobalPYQ {
  id: string;
  semester: string;
  year: string;
  url: string;
  isLatest: boolean;
  createdAt: string;
}

// ── Global Resources Query ───────────────────────────────────────────────────

export function useGlobalResources() {
  const { isAuthenticated } = useAuthContext();
  return useQuery<GlobalResource[]>({
    queryKey: ['global_resources'],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_resources' as any)
        .select('*')
        .order('subject_code', { ascending: true }) as any;
      
      if (error) throw error;
      
      return (data ?? []).map((r: any) => ({
        id: r.id,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        semester: r.semester,
        branch: r.branch,
        accentColor: r.accent_color ?? '#8B5CF6',
        syllabusUrl: r.syllabus_url ?? '',
        notesUrl: r.notes_url ?? '',
        pyqsUrl: r.pyqs_url ?? '',
        practiceUrl: r.practice_url ?? '',
        labUrl: r.lab_url ?? '',
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
      }));
    },
  });
}

// ── Global PYQs Query ────────────────────────────────────────────────────────

export function useGlobalPYQs() {
  const { isAuthenticated } = useAuthContext();
  return useQuery<GlobalPYQ[]>({
    queryKey: ['global_pyqs'],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_pyqs' as any)
        .select('*')
        .order('year', { ascending: false }) as any;
      
      if (error) throw error;
      
      return (data ?? []).map((p: any) => ({
        id: p.id,
        semester: p.semester,
        year: p.year,
        url: p.url,
        isLatest: p.is_latest,
        createdAt: p.created_at,
      }));
    },
  });
}

// ── Global Resource Mutations ────────────────────────────────────────────────

export function useUpdateGlobalResource() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      subjectCode: string;
      subjectName: string;
      semester: string;
      branch: string;
      accentColor: string;
      syllabusUrl: string;
      notesUrl: string;
      pyqsUrl: string;
      practiceUrl: string;
      labUrl: string;
    }) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .update({
          subject_code: input.subjectCode,
          subject_name: input.subjectName,
          semester: input.semester,
          branch: input.branch,
          accent_color: input.accentColor,
          syllabus_url: input.syllabusUrl,
          notes_url: input.notesUrl,
          pyqs_url: input.pyqsUrl,
          practice_url: input.practiceUrl,
          lab_url: input.labUrl,
          updated_by: userId!,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', input.id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useCreateGlobalResource() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      subjectCode: string;
      subjectName: string;
      semester: string;
      branch: string;
      accentColor: string;
      syllabusUrl: string;
      notesUrl: string;
      pyqsUrl: string;
      practiceUrl: string;
      labUrl: string;
    }) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .insert({
          subject_code: input.subjectCode,
          subject_name: input.subjectName,
          semester: input.semester,
          branch: input.branch,
          accent_color: input.accentColor,
          syllabus_url: input.syllabusUrl,
          notes_url: input.notesUrl,
          pyqs_url: input.pyqsUrl,
          practice_url: input.practiceUrl,
          lab_url: input.labUrl,
          updated_by: userId!,
          updated_at: new Date().toISOString(),
        } as any);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useDeleteGlobalResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useCreateGlobalPYQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      semester: string;
      year: string;
      url: string;
      isLatest: boolean;
    }) => {
      const { error } = await supabase
        .from('global_pyqs' as any)
        .insert({
          semester: input.semester,
          year: input.year,
          url: input.url,
          is_latest: input.isLatest,
        } as any);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_pyqs'] }),
  });
}

export function useDeleteGlobalPYQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_pyqs' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_pyqs'] }),
  });
}
