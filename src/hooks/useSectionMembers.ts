import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { SectionInfo } from '../store/appStore';
import { useAuthContext } from './useAuthContext';



export interface SectionMember {
  id: string;
  name: string;
  email: string;
  classRoll: string | null;
  universityRoll: string | null;
  role: 'student' | 'cr' | 'teacher';
  crRank: 'primary' | 'co' | null;
  avatarUrl: string | null;
  dayScholar: boolean | null;
  phone: string | null;
  subBatch?: string | null;
}

export interface StudentAttendanceAggregate {
  userId: string;
  totalPresent: number;
  totalHeld: number;
  overallPercentage: number | null;
}

export interface SectionCR {
  id: string;
  name: string;
  email: string;
  classRoll: string | null;
  crRank: 'primary' | 'co' | null;
  avatarUrl: string | null;
}

export interface CRTransferEntry {
  id: string;
  actorId: string | null;
  targetId: string | null;
  action: string;
  note: string | null;
  createdAt: string;
}

// ── Section Info Query ───────────────────────────────────────────────────────

export function useSection(opts?: { sectionId?: string }) {
  const auth = useAuthContext();
  const sectionId = opts?.sectionId ?? auth.sectionId;
  const isDemo = sectionId === 'demo-section';
  const isAuthenticated = auth.isAuthenticated || isDemo;

  return useQuery<SectionInfo | null>({
    queryKey: ['section', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        const cached = useAppStore.getState().offlineCache?.section;
        const fallback: SectionInfo = {
          id: 'demo-section',
          name: 'Demo Section',
          college: 'SKIT',
          inviteCode: 'G2RALT',
          teacherInviteCode: 'T-DEMOCO',
          createdBy: 'demo-creator-id',
        };
        if (!cached || !cached.teacherInviteCode) {
          const updated = { ...fallback, ...cached, teacherInviteCode: cached?.teacherInviteCode || 'T-DEMOCO' };
          useAppStore.getState().setOfflineCache('section', updated);
          return updated;
        }
        return cached;
      }

      try {
        const { data, error } = await supabase
          .from('sections')
          .select('id, name, college, invite_code, teacher_invite_code, created_by, is_enrollment_locked, batch1_end_roll')
          .eq('id', sectionId!)
          .single();
        
        if (error) throw error;
        if (!data) throw new Error('No section data returned');

        const sectionData: SectionInfo = {
          id: data.id,
          name: data.name,
          college: data.college,
          inviteCode: data.invite_code,
          teacherInviteCode: data.teacher_invite_code,
          createdBy: data.created_by,
          isEnrollmentLocked: (data as any).is_enrollment_locked ?? false,
          batch1EndRoll: (data as any).batch1_end_roll ?? 30,
        };
        useAppStore.getState().setOfflineCache('section', sectionData);
        return sectionData;
      } catch (err) {
        console.error('[useSection] Error, using offline cache fallback:', err);
        const cached = useAppStore.getState().offlineCache?.section;
        if (cached) return cached;
        return null;
      }
    },
  });
}

const DEMO_MEMBERS: SectionMember[] = [
  { id: 'demo-user-id', name: 'Demo Contributor', email: 'contributor@skit.ac.in', classRoll: 'P-01', universityRoll: '24ESKCS001', role: 'student', crRank: null, avatarUrl: null, dayScholar: true, phone: '9876543210' },
  { id: 'demo-cr-id', name: 'Aarav Sharma (CR)', email: 'aarav.sharma@skit.ac.in', classRoll: 'P-02', universityRoll: '24ESKCS002', role: 'cr', crRank: 'primary', avatarUrl: null, dayScholar: false, phone: '9876543211' },
  { id: 'demo-stud-3', name: 'Bhavna Patel', email: 'bhavna.patel@skit.ac.in', classRoll: 'P-03', universityRoll: '24ESKCS003', role: 'student', crRank: null, avatarUrl: null, dayScholar: true, phone: null },
  { id: 'demo-stud-4', name: 'Chirag Sen', email: 'chirag.sen@skit.ac.in', classRoll: 'P-04', universityRoll: '24ESKCS004', role: 'student', crRank: null, avatarUrl: null, dayScholar: false, phone: null },
  { id: 'demo-stud-5', name: 'Divya Rathore', email: 'divya.rathore@skit.ac.in', classRoll: 'P-05', universityRoll: '24ESKCS005', role: 'student', crRank: null, avatarUrl: null, dayScholar: true, phone: null },
];

// ── Section Members Query ────────────────────────────────────────────────────

export function useSectionMembers() {
  const { sectionId, isAuthenticated } = useAuthContext();
  const isDemo = sectionId === 'demo-section';
  return useQuery<SectionMember[]>({
    queryKey: ['members', sectionId],
    enabled: !!sectionId && (isAuthenticated || isDemo),
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      if (isDemo) return DEMO_MEMBERS;
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, university_roll, role, cr_rank, avatar_url, day_scholar, phone, sub_batch')
        .eq('section_id', sectionId!)
        .order('section_roll')
        .limit(200); // safeguard: avoid extremely large member lists on the dashboard
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        universityRoll: u.university_roll,
        role: u.role as 'student' | 'cr' | 'teacher',
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
        dayScholar: u.day_scholar,
        phone: u.phone ?? null,
        subBatch: (u as Record<string, unknown>).sub_batch as string | null ?? null,
      }));
    },
  });
}

// ── Section Attendance Aggregates Query (CR-only) ────────────────────────────

export function useSectionAttendance() {
  const { role, sectionId, isAuthenticated } = useAuthContext();
  const isCR = role === 'cr';

  return useQuery<Record<string, StudentAttendanceAggregate>>({
    queryKey: ['section_attendance', sectionId],
    enabled: !!sectionId && isAuthenticated && isCR,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    queryFn: async () => {
      const { data: sectionUsers, error: usersErr } = await supabase
        .from('users')
        .select('id')
        .eq('section_id', sectionId!);

      if (usersErr) throw usersErr;

      const userIds = (sectionUsers ?? []).map((u) => u.id);
      if (userIds.length === 0) return {};

      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, present, od, makeup, absent')
        .in('user_id', userIds);
      
      if (error) throw error;

      const aggregates: Record<string, StudentAttendanceAggregate> = {};
      
      (data ?? []).forEach(r => {
        const total = r.present + r.od + r.absent;
        const attended = r.present + r.od + r.makeup;
        
        if (!aggregates[r.user_id]) {
          aggregates[r.user_id] = {
            userId: r.user_id,
            totalPresent: 0,
            totalHeld: 0,
            overallPercentage: null
          };
        }
        
        aggregates[r.user_id].totalPresent += attended;
        aggregates[r.user_id].totalHeld += total;
      });

      Object.values(aggregates).forEach(agg => {
        if (agg.totalHeld > 0) {
          agg.overallPercentage = (agg.totalPresent / agg.totalHeld) * 100;
        }
      });

      return aggregates;
    }
  });
}

// ── Section CRs Query ────────────────────────────────────────────────────────

export function useSectionCRs() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SectionCR[]>({
    queryKey: ['section_crs', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds for quick updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, cr_rank, avatar_url')
        .eq('section_id', sectionId!)
        .eq('role', 'cr')
        .order('cr_rank');
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
      }));
    },
  });
}

// ── CR Transfer Log Query ────────────────────────────────────────────────────

export function useCRTransferLog() {
  const { sectionId, role, isAuthenticated } = useAuthContext();
  return useQuery<CRTransferEntry[]>({
    queryKey: ['cr_transfer_log', sectionId],
    enabled: !!sectionId && isAuthenticated && role === 'cr',
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cr_transfer_log')
        .select('id, actor_id, target_id, action, note, created_at')
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        actorId: e.actor_id,
        targetId: e.target_id,
        action: e.action,
        note: e.note,
        createdAt: e.created_at,
      }));
    },
  });
}

// ── CR Management Mutations (ADR-018) ────────────────────────────────────────

export function useTransferPrimaryCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      newPrimaryId: string;
      oldCrAction: 'become_student' | 'become_co_cr';
    }) => {
      const { error } = await supabase.rpc('transfer_primary_cr', {
        new_primary_id: input.newPrimaryId,
        old_cr_action: input.oldCrAction,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
      useAppStore.getState().refreshProfile();
    },
  });
}

export function usePromoteToCoCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('promote_to_co_cr', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
    },
  });
}

export function useDemoteCoCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('demote_co_cr', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
    },
  });
}

export function useResignAsCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resign_as_cr');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
      useAppStore.getState().refreshProfile();
    },
  });
}
