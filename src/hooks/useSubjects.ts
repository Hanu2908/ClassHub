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
    mutationFn: async (payload: { action: 'create' | 'update' | 'delete'; subject: Partial<SubjectInfo>; teacherId?: string | null }) => {
      if (!sectionId) throw new Error('No section ID');
      const { action, subject, teacherId } = payload;

      if (action === 'create') {
        const { data: newSubject, error } = await supabase
          .from('subjects')
          .insert({
            section_id: sectionId,
            code: subject.code!,
            name: subject.name!,
            semester: subject.semester!,
            accent: subject.accent || '#4A9EFF',
          })
          .select('id')
          .single();

        if (error) throw error;

        if (teacherId && newSubject?.id) {
          const { error: teacherError } = await supabase
            .from('section_teachers')
            .insert({
              section_id: sectionId,
              teacher_id: teacherId,
              subject_id: newSubject.id,
            });
          if (teacherError) throw teacherError;
        }
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

        // Fetch existing section_teachers mapping for this subject in this section
        const { data: existingMapping, error: fetchErr } = await supabase
          .from('section_teachers')
          .select('id, teacher_id')
          .eq('section_id', sectionId)
          .eq('subject_id', subject.id!)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        if (teacherId) {
          if (existingMapping) {
            // Update mapping
            const { error: updateErr } = await supabase
              .from('section_teachers')
              .update({ teacher_id: teacherId })
              .eq('id', existingMapping.id);
            if (updateErr) throw updateErr;
          } else {
            // Insert mapping
            const { error: insertErr } = await supabase
              .from('section_teachers')
              .insert({
                section_id: sectionId,
                teacher_id: teacherId,
                subject_id: subject.id!,
              });
            if (insertErr) throw insertErr;
          }
        } else {
          // Delete mapping if no teacher is assigned
          if (existingMapping) {
            const { error: deleteErr } = await supabase
              .from('section_teachers')
              .delete()
              .eq('id', existingMapping.id);
            if (deleteErr) throw deleteErr;
          }
        }
      } else if (action === 'delete') {
        // Clean up section_teachers mapping first
        await supabase
          .from('section_teachers')
          .delete()
          .eq('section_id', sectionId)
          .eq('subject_id', subject.id!);

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
      queryClient.invalidateQueries({ queryKey: ['section-teachers-list', sectionId] });
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
