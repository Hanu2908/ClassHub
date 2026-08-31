import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

// ── Exported types — backend-ready interfaces ─────────────────────────────────

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'student' | 'cr' | 'teacher';
  crRank: 'primary' | 'co' | null;
  sectionId: string | null;
  sectionRoll: string | null;
  universityRoll: string | null;
  dayScholar: boolean | null;
  notificationsEnabled: boolean;
  isDeveloper: boolean;
  subBatch?: string | null;
  isCounsellorForBatch?: '1' | '2' | null;
  phone?: string | null;
  branch?: string | null;
}

export interface HubInfo {
  hubCode: string;
  section: string;
  hubName: string;
  institution: string;
  classRoll: string;
  universityRoll: string;
}

import type { AttendanceInsights } from '../lib/utils/attendance';

export interface AttendanceSubject {
  code: string;
  name: string;
  type: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  canSkip: number;
  needToAttend: number;
  semester?: number;
  insights?: AttendanceInsights | null;
}

export interface AssignmentSet {
  id: string;
  label: string;
  rollStart: number;
  rollEnd: number;
  pageNumbers: string;
  description: string;
  pdfUrl: string | null;
}

export interface Attachment {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  signedUrl?: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  subjectId?: string;
  dueDate: string;
  description: string;
  status: 'pending' | 'submitted';
  pdfUrl: string | null;
  hasSets: boolean;
  sets: AssignmentSet[];
  submittedLink: string | null;
  crVerified?: boolean;
  createdAt: string;
  attachments?: Attachment[];
  targetBatch?: '1' | '2' | null;
  isArchived?: boolean;
}

export interface Announcement {
  id: string;
  authorId?: string | null;
  title: string;
  body: string;
  priority: 'critical' | 'general';
  deadline: string | null;
  postedAt: string;
  expiresAt?: string | null;
  attachmentUrl?: string | null;
  attachments?: Attachment[];
  targetBatch?: '1' | '2' | null;
  isPinned?: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  type: 'anonymous' | 'actionable';
  closesAt: string;
  status: 'active' | 'closed';
  options: PollOption[];
  createdAt: string;
  allowMultiple: boolean;
  userVotes: string[];
  userVote: string | null;
  voterCount?: number;
}

export interface ScheduleSlot {
  id: string;
  day: string;
  subject: string;
  code: string;
  room: string;
  teacher: string;
  type: string;
  startTime: string;
  endTime: string;
  subjectId?: string;
  targetBatch?: string | null;
}

export type ScheduleMap = Record<string, ScheduleSlot[]>;

export interface Exam {
  id: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  examType: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maxMarks: number | null;
  syllabusUnits: string[];
  syllabusPdfPath: string | null;
  room: string | null;
  seatingPlanPath: string | null;
  activeRoom: string | null;
  activeSeatingPlan: string | null;
  baseCreatorId: string | null;
  overrideId: string | null;
  createdAt?: string;
  createdBy?: string;
}

export interface StudentExamPrep {
  id: string;
  userId: string;
  examId: string;
  unitIndex: number;
  isPrepared: boolean;
}

export type NotificationType =
  | 'cr_broadcast'
  | 'assignment'
  | 'announcement'
  | 'system'
  | 'custom'
  | 'critical_announcement'
  | 'ack_nudge'
  | 'assignment_reminder'
  | 'general_announcement'
  | 'new_assignment'
  | 'new_poll'
  | 'counsellor_remark'
  | 'counsellor_remark_reply';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  readAt?: string;

  // Database fields for seamless mapping
  section_id?: string;
  recipient_id?: string;
  actor_id?: string | null;
  kind?: string;
  status?: string;
  target_table?: string | null;
  target_id?: string | null;
  read_at?: string | null;
  created_at?: string;
  sent_at?: string | null;
  error_message?: string | null;
}

export interface DbNotification {
  id: string;
  title?: string | null;
  body?: string | null;
  kind?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  section_id?: string | null;
  recipient_id?: string | null;
  actor_id?: string | null;
  status?: string | null;
  target_table?: string | null;
  target_id?: string | null;
  sent_at?: string | null;
  error_message?: string | null;
}

export function mapDbNotification(db: DbNotification): AppNotification {
  return {
    id: db.id,
    title: db.title || 'Notification',
    body: db.body || '',
    type: (db.kind as NotificationType) || 'system',
    createdAt: db.created_at || new Date().toISOString(),
    read: !!db.read_at,
    readAt: db.read_at || undefined,
    section_id: db.section_id || undefined,
    recipient_id: db.recipient_id || undefined,
    actor_id: db.actor_id,
    kind: db.kind || undefined,
    status: db.status || undefined,
    target_table: db.target_table,
    target_id: db.target_id,
    read_at: db.read_at,
    created_at: db.created_at || undefined,
    sent_at: db.sent_at,
    error_message: db.error_message,
  };
}

// ── Expiry helper — 2 days after deadline ────────────────────────────────────
export const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function isExpired(isoDeadline: string | null | undefined): boolean {
  if (!isoDeadline) return false;
  return Date.now() > new Date(isoDeadline).getTime() + TWO_DAYS_MS;
}

export interface SectionInfo {
  id: string;
  name: string;
  college: string;
  inviteCode: string;
  teacherInviteCode?: string | null;
  createdBy: string | null;
  isEnrollmentLocked?: boolean;
  batch1EndRoll?: number;
}

export interface OfflineCache {
  schedule?: ScheduleMap;
  attendance?: { subjects: AttendanceSubject[]; overall: number; lastUpdated: string | null };
  announcements?: (Announcement & { isAcknowledged: boolean })[];
  assignments?: Assignment[];
  polls?: Poll[];
  section?: SectionInfo;
}

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced';

// ── Store interface ───────────────────────────────────────────────────────────
// Client-only state. Server data lives in TanStack Query.

interface AppState {
  // Offline & Sync Cache
  offlineCache: OfflineCache;
  syncStatus: SyncStatus;
  setOfflineCache: <K extends keyof OfflineCache>(key: K, data: OfflineCache[K]) => void;
  setSyncStatus: (status: SyncStatus) => void;
  // Auth (centralized — single source of truth)
  authUser: AuthUser | null;
  session: Session | null;
  isAuthLoading: boolean;
  role: 'student' | 'cr' | 'teacher';
  isFirstTime: boolean;

  // Legacy alias
  user: UserInfo | null;

  // Hub
  hub: HubInfo | null;

  // UI
  activeTab: 'home' | 'schedule' | 'polls' | 'profile' | 'cr-command' | 'attendance' | 'announcements';
  deferredPrompt: BeforeInstallPromptEvent | null;

  // Global selection for teacher console
  selectedSectionId?: string;
  selectedSubjectId?: string;
  setSelectedSectionId?: (id: string) => void;
  setSelectedSubjectId?: (id: string) => void;


  // ── Actions ──
  setUser: (user: UserInfo | null) => void;
  setAuthUser: (authUser: AuthUser | null) => void;
  setSession: (session: Session | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setRole: (role: 'student' | 'cr' | 'teacher') => void;
  setHub: (hub: HubInfo | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setFirstTime: (v: boolean) => void;
  refreshProfile: () => Promise<void>;


  // Optimistic UI states
  optimisticAcks: Set<string>;
  optimisticVotes: Record<string, string[]>;

  // Actions
  addOptimisticAck: (id: string) => void;
  removeOptimisticAck: (id: string) => void;
  setOptimisticVote: (pollId: string, optionIds: string[]) => void;
  clearOptimisticVote: (pollId: string) => void;

  clearHubState: () => void;
  signOut: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      authUser: null,
      user: null,
      session: null,
      isAuthLoading: true,
      role: 'student',
      isFirstTime: false,
      hub: null,
      activeTab: 'home',
      deferredPrompt: null,
      selectedSectionId: '',
      selectedSubjectId: '',

      // Offline & Sync Cache
      offlineCache: {},
      syncStatus: 'online',
      setOfflineCache: (key, data) => set((s) => ({
        offlineCache: { ...s.offlineCache, [key]: data }
      })),
      setSyncStatus: (syncStatus) => set({ syncStatus }),

      // Volatile Optimistic UI states (not persisted)
      optimisticAcks: new Set<string>(),
      optimisticVotes: {},

      // ── Setters ──
      setUser: (user) => set({ user }),
      setAuthUser: (authUser) => {
        if (authUser) {
          set({
            authUser,
            user: { id: authUser.id, name: authUser.name, email: authUser.email, avatarUrl: authUser.avatarUrl },
            role: authUser.role,
          });
        } else {
          set({ authUser: null, user: null });
        }
      },
      setSession: (session) => set({ session }),
      setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
      setRole: (role) => set({ role }),
      setHub: (hub) => set({ hub }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
      setFirstTime: (isFirstTime) => set({ isFirstTime }),
      setSelectedSectionId: (selectedSectionId) => set({ selectedSectionId }),
      setSelectedSubjectId: (selectedSubjectId) => set({ selectedSubjectId }),

      refreshProfile: async () => {
        if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
          return;
        }
        // Use getUser() instead of getSession() to avoid reading potentially tampered localStorage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, role, cr_rank, section_id, section_roll, university_roll, day_scholar, notifications_enabled, is_developer, sub_batch, phone, branch')
          .eq('id', user.id)
          .single();
        if (error || !data) return;

        let isCounsellorForBatch: '1' | '2' | null = null;
        if (data.role === 'teacher' && data.section_id) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('is_counsellor_for_batch')
            .eq('teacher_id', user.id)
            .eq('section_id', data.section_id)
            .not('is_counsellor_for_batch', 'is', null)
            .limit(1)
            .maybeSingle();
          if (stData) {
            isCounsellorForBatch = stData.is_counsellor_for_batch as '1' | '2';
          }
        }

        const profile: AuthUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatar_url ?? null,
          role: data.role as 'student' | 'cr' | 'teacher',
          crRank: (data as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
          sectionId: data.section_id,
          sectionRoll: data.section_roll,
          universityRoll: data.university_roll,
          dayScholar: data.day_scholar,
          notificationsEnabled: data.notifications_enabled,
          isDeveloper: data.is_developer ?? false,
          subBatch: (data as Record<string, unknown>).sub_batch as string | null ?? null,
          isCounsellorForBatch,
          phone: data.phone ?? null,
          branch: data.branch ?? null,
        };
        set({
          authUser: profile,
          user: { id: profile.id, name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl },
          role: profile.role,
        });
      },


      // ── Optimistic Actions ──
      addOptimisticAck: (id) =>
        set((s) => {
          const next = new Set(s.optimisticAcks);
          next.add(id);
          return { optimisticAcks: next };
        }),
      removeOptimisticAck: (id) =>
        set((s) => {
          const next = new Set(s.optimisticAcks);
          next.delete(id);
          return { optimisticAcks: next };
        }),
      setOptimisticVote: (pollId, optionIds) =>
        set((s) => ({
          optimisticVotes: { ...s.optimisticVotes, [pollId]: optionIds },
        })),
      clearOptimisticVote: (pollId) =>
        set((s) => {
          const next = { ...s.optimisticVotes };
          delete next[pollId];
          return { optimisticVotes: next };
        }),

      // ── Clear Hub State (keeps user logged in) ──
      clearHubState: () =>
        set((s) => ({
          hub: null,
          role: s.authUser?.role === 'teacher' ? 'teacher' : 'student',
          authUser: s.authUser
            ? {
                ...s.authUser,
                sectionId: null,
                sectionName: null,
                sectionRoll: null,
                universityRoll: null,
                counsellor: null,
              }
            : null,
          user: s.user
            ? {
                ...s.user,
                sectionId: null,
                sectionRoll: null,
                universityRoll: null,
                counsellor: null,
              }
            : null,
          selectedSectionId: '',
          selectedSubjectId: '',
          optimisticAcks: new Set<string>(),
          optimisticVotes: {},
          offlineCache: {},
        })),

      // ── Sign out ──
      signOut: () =>
        set({
          authUser: null, user: null, session: null, role: 'student',
          isAuthLoading: false,
          hub: null, isFirstTime: false,
          optimisticAcks: new Set<string>(),
          optimisticVotes: {},
          offlineCache: {},
          syncStatus: 'online',
        }),
    }),
    {
      name: 'classhub-store',
      // Don't persist volatile auth state (role is persisted to prevent CR-flickering, secured by database RLS)
      partialize: (state) => ({
        authUser: state.authUser,
        user: state.user,
        isFirstTime: state.isFirstTime,
        hub: state.hub,
        activeTab: state.activeTab,
        role: state.role,
        offlineCache: state.offlineCache,
      }),
    }
  )
);
