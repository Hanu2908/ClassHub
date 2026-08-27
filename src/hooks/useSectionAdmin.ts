import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './useAuthContext';
import { toast } from 'sonner';
import { useAppStore } from '../store/appStore';

export function useRemoveSectionMember() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (isDemo) {
        return { success: true, targetUserId };
      }
      const { error } = await supabase.rpc('remove_section_member', {
        p_target_user_id: targetUserId,
      });
      if (error) throw error;
      return { success: true, targetUserId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      toast.success('Member removed from section hub');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove member');
    },
  });
}

export function useUpdateSectionMember() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async ({
      targetUserId,
      sectionRoll,
      subBatch,
    }: {
      targetUserId: string;
      sectionRoll: string;
      subBatch: string;
    }) => {
      if (isDemo) {
        return { success: true, targetUserId, sectionRoll, subBatch };
      }
      const { data, error } = await supabase.rpc('update_section_member', {
        p_target_user_id: targetUserId,
        p_section_roll: sectionRoll,
        p_sub_batch: subBatch,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      toast.success('Member details updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update member details');
    },
  });
}

export function useToggleEnrollment() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async (isLocked: boolean) => {
      if (isDemo) {
        const cached = useAppStore.getState().offlineCache?.section;
        if (cached) {
          useAppStore.getState().setOfflineCache('section', { ...cached, isEnrollmentLocked: isLocked });
        }
        return { isEnrollmentLocked: isLocked };
      }
      const { data, error } = await supabase.rpc('toggle_section_enrollment', {
        p_is_locked: isLocked,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, isLocked) => {
      qc.invalidateQueries({ queryKey: ['section', sectionId] });
      toast.success(isLocked ? 'Section enrollment locked' : 'Section enrollment unlocked');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle enrollment lock');
    },
  });
}

export function useRegenerateInviteCode() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async (codeType: 'student' | 'teacher') => {
      if (isDemo) {
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const newCode = codeType === 'student' ? `P2${rand}` : `T-P2${rand}`;
        const cached = useAppStore.getState().offlineCache?.section;
        if (cached) {
          useAppStore.getState().setOfflineCache('section', {
            ...cached,
            ...(codeType === 'student' ? { inviteCode: newCode } : { teacherInviteCode: newCode }),
          });
        }
        return newCode;
      }
      const { data, error } = await supabase.rpc('regenerate_section_invite_code', {
        p_code_type: codeType,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newCode, codeType) => {
      qc.invalidateQueries({ queryKey: ['section', sectionId] });
      toast.success(`New ${codeType === 'student' ? 'Student' : 'Teacher'} invite code: ${newCode}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to regenerate invite code');
    },
  });
}

export function useUpdateBatchConfig() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async ({
      batch1EndRoll,
      applyToExisting,
    }: {
      batch1EndRoll: number;
      applyToExisting: boolean;
    }) => {
      if (isDemo) {
        const cached = useAppStore.getState().offlineCache?.section;
        if (cached) {
          useAppStore.getState().setOfflineCache('section', { ...cached, batch1EndRoll });
        }
        return 5;
      }
      const { data, error } = await supabase.rpc('update_section_batch_config', {
        p_batch1_end_roll: batch1EndRoll,
        p_apply_to_existing: applyToExisting,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, vars) => {
      qc.invalidateQueries({ queryKey: ['section', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      if (vars.applyToExisting && count > 0) {
        toast.success(`Batch boundary updated! ${count} students auto-assigned.`);
      } else {
        toast.success('Batch division configuration saved');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update batch configuration');
    },
  });
}

export function useTogglePinAnnouncement() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async ({
      announcementId,
      isPinned,
    }: {
      announcementId: string;
      isPinned: boolean;
    }) => {
      if (isDemo) {
        return { announcementId, isPinned };
      }
      const { error } = await supabase.rpc('toggle_pin_announcement', {
        p_announcement_id: announcementId,
        p_is_pinned: isPinned,
      });
      if (error) throw error;
      return { announcementId, isPinned };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['announcements', sectionId] });
      toast.success(vars.isPinned ? 'Announcement pinned to top' : 'Announcement unpinned');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update pin status');
    },
  });
}

export function useToggleArchiveAssignment() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async ({
      assignmentId,
      isArchived,
    }: {
      assignmentId: string;
      isArchived: boolean;
    }) => {
      if (isDemo) {
        return { assignmentId, isArchived };
      }
      const { error } = await supabase.rpc('toggle_archive_assignment', {
        p_assignment_id: assignmentId,
        p_is_archived: isArchived,
      });
      if (error) throw error;
      return { assignmentId, isArchived };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['assignments', sectionId] });
      toast.success(vars.isArchived ? 'Assignment archived' : 'Assignment restored');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update assignment archive status');
    },
  });
}

export function useModerateUserTag() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  const isDemo = sectionId === 'demo-section';

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (isDemo) {
        return { success: true, tagId };
      }
      const { error } = await supabase
        .from('user_tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;
      return { success: true, tagId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      toast.success('Inappropriate tag removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove tag');
    },
  });
}
