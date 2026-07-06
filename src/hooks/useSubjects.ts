import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './useAuthContext';



export interface SubjectInfo {
  id: string;
  code: string;
  name: string;
  semester: number;
  accent: string;
  sectionId: string;
}



// ── Subjects Query ───────────────────────────────────────────────────────────

export function useSubjects(opts?: { sectionId?: string }) {
  const auth = useAuthContext();
  const sectionId = opts?.sectionId ?? auth.sectionId;
  const isDemo = sectionId === 'demo-section';
  const isAuthenticated = auth.isAuthenticated || isDemo;

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
    mutationFn: async (
      payload:
        | Array<{ code: string; name?: string; semester?: number; accent?: string }>
        | {
            items: Array<{ code: string; name?: string; semester?: number; accent?: string }>;
            syncDelete?: boolean;
          }
    ) => {
      if (!sectionId) throw new Error('Missing section context');
      
      const items = Array.isArray(payload) ? payload : payload.items;
      const syncDelete = Array.isArray(payload) ? false : !!payload.syncDelete;

      const codes = Array.from(new Set(items.map(i => i.code).filter(Boolean)));
      if (codes.length === 0) return {} as Record<string, string>;

      // 1. Fetch ALL existing subjects in this section to support custom accent preservation and delete detection
      const { data: existing, error: existingErr } = await supabase
        .from('subjects')
        .select('id, code, accent')
        .eq('section_id', sectionId);
      if (existingErr) throw existingErr;

      const existingMap = new Map<string, { id: string; accent: string }>();
      (existing ?? []).forEach((s) => existingMap.set(s.code, { id: s.id, accent: s.accent }));

      // 2. Prepare payload for upsert (do NOT include id key!)
      const upsertItems = items.map(i => {
        const existingSub = existingMap.get(i.code);
        return {
          section_id: sectionId!,
          code: i.code,
          name: i.name ?? i.code,
          semester: i.semester ?? 1,
          accent: existingSub?.accent ?? i.accent ?? '#4A9EFF'
        };
      });

      // 3. Perform the upsert (inserts new, updates existing)
      const { data: upserted, error: upsertErr } = await supabase
        .from('subjects')
        .upsert(upsertItems, { onConflict: 'section_id,code' })
        .select('id, code');
      if (upsertErr) throw upsertErr;

      // 4. Handle Deleting obsolete subjects if syncDelete is enabled
      let hasFailedDeletions = false;
      if (syncDelete) {
        const importedCodesSet = new Set(codes);
        const obsoleteSubjects = (existing ?? []).filter(s => !importedCodesSet.has(s.code));

        for (const obsolete of obsoleteSubjects) {
          try {
            const { error: delErr } = await supabase
              .from('subjects')
              .delete()
              .eq('id', obsolete.id);
            if (delErr) {
              console.warn(`Could not delete obsolete subject ${obsolete.code}:`, delErr);
              hasFailedDeletions = true;
            }
          } catch (e) {
            console.warn(`Error deleting obsolete subject ${obsolete.code}:`, e);
            hasFailedDeletions = true;
          }
        }
      }

      // 5. Construct output mapping & attach non-enumerable hasFailedDeletions flag
      const mapping: Record<string, string> = {};
      (upserted ?? []).forEach((s) => {
        mapping[s.code] = s.id;
      });

      Object.defineProperty(mapping, '_hasFailedDeletions', {
        value: hasFailedDeletions,
        enumerable: false,
        writable: true,
        configurable: true
      });

      return mapping;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}
