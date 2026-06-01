import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

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

export interface SubjectInfo {
  id: string;
  code: string;
  name: string;
  semester: number;
  accent: string;
  sectionId: string;
}

type SubjectIdCode = { id: string; code: string };

// ── Subjects Query ───────────────────────────────────────────────────────────

export function useSubjects() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SubjectInfo[]>({
    queryKey: ['subjects', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, code, name, semester, accent, section_id')
        .eq('section_id', sectionId!)
        .order('code');
      if (error) throw error;
      return (data ?? []).map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        semester: s.semester,
        accent: s.accent,
        sectionId: s.section_id,
      }));
    },
  });
}

// ── Mutate Subjects Mutation ──────────────────────────────────────────────────

export function useMutateSubjects() {
  const queryClient = useQueryClient();
  const { sectionId } = useAuthContext();

  return useMutation({
    mutationFn: async (payload: { action: 'create' | 'update' | 'delete'; subject: Partial<SubjectInfo> }) => {
      if (!sectionId) throw new Error('No section ID');
      const { action, subject } = payload;

      if (action === 'create') {
        const { error } = await supabase
          .from('subjects')
          .insert({
            section_id: sectionId,
            code: subject.code!,
            name: subject.name!,
            semester: subject.semester!,
            accent: subject.accent || '#4A9EFF',
          });
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('subjects')
          .update({
            code: subject.code,
            name: subject.name,
            semester: subject.semester,
            accent: subject.accent,
          })
          .eq('id', subject.id!)
          .eq('section_id', sectionId);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', subject.id!)
          .eq('section_id', sectionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', sectionId] });
    },
  });
}

// ── Ensure Subjects Mutation ──────────────────────────────────────────────────

export function useEnsureSubjects() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (items: Array<{ code: string; name?: string; semester?: number; accent?: string }>) => {
      if (!sectionId) throw new Error('Missing section context');
      const codes = Array.from(new Set(items.map(i => i.code).filter(Boolean)));
      if (codes.length === 0) return {} as Record<string, string>;

      const { data: existing, error: existingErr } = await supabase.from('subjects').select('id,code').in('code', codes).eq('section_id', sectionId);
      if (existingErr) throw existingErr;

      const existingMap = new Map<string, string>();
      (existing ?? []).forEach((s: SubjectIdCode) => existingMap.set(s.code, s.id));

      const missing = items
        .filter(i => i.code && !existingMap.has(i.code))
        .map(i => ({ section_id: sectionId!, code: i.code, name: i.name ?? i.code, semester: i.semester ?? 1, accent: i.accent ?? '#4A9EFF' }));

      let inserted: SubjectIdCode[] = [];
      if (missing.length > 0) {
        const { data: ins, error: insErr } = await supabase.from('subjects').insert(missing).select('id,code');
        if (insErr) throw insErr;
        inserted = ins ?? [];
      }

      const mapping: Record<string, string> = {};
      (existing ?? []).forEach((s: SubjectIdCode) => mapping[s.code] = s.id);
      inserted.forEach(s => mapping[s.code] = s.id);
      return mapping;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}
