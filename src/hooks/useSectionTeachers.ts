import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface SectionTeacherMember {
  id: string;
  teacher_id: string;
  is_counsellor_for_batch: '1' | '2' | null;
  subject_id: string | null;
  users: {
    name: string | null;
    email: string | null;
  } | null;
  subjects: {
    name: string;
    code: string;
  } | null;
}

export function useSectionTeachers(sectionId?: string) {
  return useQuery({
    queryKey: ['section-teachers-list', sectionId],
    queryFn: async (): Promise<SectionTeacherMember[]> => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from('section_teachers')
        .select('id, teacher_id, is_counsellor_for_batch, users(name, email), subject_id, subjects(name, code)')
        .eq('section_id', sectionId);

      if (error) {
        console.error('[useSectionTeachers] Query failed:', error);
        throw error;
      }
      return (data as unknown as SectionTeacherMember[]) || [];
    },
    enabled: !!sectionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAssignBatchCounsellor(sectionId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mappingId, batch }: { mappingId: string; batch: '1' | '2' | null }) => {
      const { error } = await supabase
        .from('section_teachers')
        .update({ is_counsellor_for_batch: batch })
        .eq('id', mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Batch Counsellor mapping updated! ✓');
      if (sectionId) {
        queryClient.invalidateQueries({ queryKey: ['section-teachers-list', sectionId] });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to assign counsellor';
      toast.error(msg);
    },
  });
}

export function useRevokeTeacherAccess(sectionId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('section_teachers')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Teacher access revoked.');
      if (sectionId) {
        queryClient.invalidateQueries({ queryKey: ['section-teachers-list', sectionId] });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to revoke teacher access';
      toast.error(msg);
    },
  });
}
