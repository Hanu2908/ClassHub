import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

export interface CounsellorInfo {
  name: string;
  email: string;
}

export interface LinkedSubjectItem {
  subject_id: string;
  section_id: string;
  sections: { name: string } | null;
  subjects: { code: string; name: string; accent: string } | null;
}

// ── 1. Batch Counsellor Query ────────────────────────────────────────────────
export function useMyCounsellor(sectionId?: string, subBatch?: string | null) {
  return useQuery<CounsellorInfo | null>({
    queryKey: ['my-counsellor', sectionId, subBatch],
    queryFn: async () => {
      if (!sectionId || !subBatch) return null;
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          teacher:teacher_id (name, email)
        `)
        .eq('section_id', sectionId)
        .eq('is_counsellor_for_batch', subBatch)
        .maybeSingle();

      if (error) {
        console.error('[useMyCounsellor] Query failed:', error);
        throw error;
      }
      return (data?.teacher as unknown as CounsellorInfo) || null;
    },
    enabled: !!sectionId && !!subBatch,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

// ── 2. Teacher Linked Subjects Query ─────────────────────────────────────────
export function useTeacherLinkedSubjects(teacherId?: string, isTeacher: boolean = false) {
  return useQuery<LinkedSubjectItem[]>({
    queryKey: ['my-linked-subjects', teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          subject_id,
          section_id,
          sections:section_id (name),
          subjects:subject_id (code, name, accent)
        `)
        .eq('teacher_id', teacherId);

      if (error) {
        console.error('[useTeacherLinkedSubjects] Query failed:', error);
        throw error;
      }
      return ((data as unknown as LinkedSubjectItem[]) || []).filter(item => item.subject_id !== null);
    },
    enabled: !!teacherId && isTeacher,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

// ── 3. Profile Preference Mutation (Commuter, Batch, Phone) ─────────────────
export function useUpdateProfilePreference() {
  const refreshProfile = useAppStore(s => s.refreshProfile);

  return useMutation({
    mutationFn: async (payload: { day_scholar?: boolean; sub_batch?: string | null; phone?: string | null }) => {
      const authUser = useAppStore.getState().authUser;
      if (!authUser?.id) throw new Error('Not authenticated');

      const isDemoMode = import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true';
      if (isDemoMode) {
        useAppStore.setState(s => {
          if (!s.authUser) return s;
          return {
            authUser: { ...s.authUser, ...payload },
            user: s.user ? { ...s.user, ...payload } : null,
          };
        });
        return;
      }

      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', authUser.id);

      if (error) throw error;
      await refreshProfile();
    },
  });
}

// ── 4. Section Subjects for Faculty Linking ──────────────────────────────────
export function useSectionSubjectsForLinking(sectionId?: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['subjects-for-linking', sectionId],
    queryFn: async () => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('section_id', sectionId)
        .order('code');

      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId && enabled,
    staleTime: 1000 * 60 * 5,
  });
}

// ── 5. Teacher Link / Unlink Subject Mutation ────────────────────────────────
export function useToggleTeacherSubjectLink(teacherId: string, currentSectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectId,
      subjectCode,
      currentLinked,
      applyAll,
    }: {
      subjectId: string;
      subjectCode: string;
      currentLinked: boolean;
      applyAll: boolean;
    }) => {
      if (currentLinked) {
        // Unlink from current section
        const { error: delErr } = await supabase
          .from('section_teachers')
          .delete()
          .eq('section_id', currentSectionId)
          .eq('teacher_id', teacherId)
          .eq('subject_id', subjectId);
        if (delErr) throw delErr;

        // If applyAll, delete for all sections taught by this teacher
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== currentSectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const matchSubjectIds = matchSubjects.map(ms => ms.id);
              await supabase
                .from('section_teachers')
                .delete()
                .eq('teacher_id', teacherId)
                .in('subject_id', matchSubjectIds);
            }
          }
        }
      } else {
        // Link to current section
        const { error: insErr } = await supabase
          .from('section_teachers')
          .insert({
            section_id: currentSectionId,
            teacher_id: teacherId,
            subject_id: subjectId,
          });
        if (insErr) throw insErr;

        // If applyAll, link to all sections taught by this teacher
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== currentSectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const insertRows = matchSubjects.map(ms => ({
                section_id: ms.section_id,
                teacher_id: teacherId,
                subject_id: ms.id,
              }));
              await supabase.from('section_teachers').insert(insertRows);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-linked-subjects', teacherId] });
      queryClient.invalidateQueries({ queryKey: ['subjects-for-linking', currentSectionId] });
    },
  });
}
