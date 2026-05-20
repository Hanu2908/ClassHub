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
  role: 'student' | 'cr';
  sectionId: string | null;
  sectionRoll: string | null;
  universityRoll: string | null;
  dayScholar: boolean;
}

export interface HubInfo {
  hubCode: string;
  section: string;
  hubName: string;
  institution: string;
  classRoll: string;
  universityRoll: string;
}

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
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  dueDate: string;
  description: string;
  status: 'pending' | 'submitted';
  pdfUrl: string | null;
  hasSets: boolean;
  sets: AssignmentSet[];
  submittedLink: string | null;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'critical' | 'general';
  deadline: string | null;
  postedAt: string;
  attachmentUrl?: string | null;
  attachments?: Attachment[];
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
}

export type ScheduleMap = Record<string, ScheduleSlot[]>;

export type NotificationType = 'cr_broadcast' | 'assignment' | 'announcement' | 'system';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  readAt?: string;
}

// ── Expiry helper — 2 days after deadline ────────────────────────────────────
export const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function isExpired(isoDeadline: string | null | undefined): boolean {
  if (!isoDeadline) return false;
  return Date.now() > new Date(isoDeadline).getTime() + TWO_DAYS_MS;
}

// ── Store interface ───────────────────────────────────────────────────────────
// Client-only state. Server data lives in TanStack Query.

interface AppState {
  // Auth (centralized — single source of truth)
  authUser: AuthUser | null;
  session: Session | null;
  isAuthLoading: boolean;
  role: 'student' | 'cr';
  isFirstTime: boolean;

  // Legacy alias
  user: UserInfo | null;

  // Hub
  hub: HubInfo | null;

  // UI
  activeTab: 'home' | 'schedule' | 'polls' | 'profile' | 'cr-command' | 'attendance';
  deferredPrompt: BeforeInstallPromptEvent | null;

  // In-app notifications (client-only)
  notifications: AppNotification[];

  // ── Actions ──
  setUser: (user: UserInfo | null) => void;
  setAuthUser: (authUser: AuthUser | null) => void;
  setSession: (session: Session | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setRole: (role: 'student' | 'cr') => void;
  setHub: (hub: HubInfo | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setFirstTime: (v: boolean) => void;
  refreshProfile: () => Promise<void>;

  // Notifications
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;

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

      notifications: [],

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

      // Refresh profile from Supabase
      refreshProfile: async () => {
        // Use getUser() instead of getSession() to avoid reading potentially tampered localStorage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, role, section_id, section_roll, university_roll, day_scholar')
          .eq('id', user.id)
          .single();
        if (error || !data) return;
        const profile: AuthUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatar_url ?? null,
          role: data.role as 'student' | 'cr',
          sectionId: data.section_id,
          sectionRoll: data.section_roll,
          universityRoll: data.university_roll,
          dayScholar: data.day_scholar,
        };
        set({
          authUser: profile,
          user: { id: profile.id, name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl },
          role: profile.role,
        });
      },

      // ── Notifications ──
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ],
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map(n => ({ ...n, read: true, readAt: n.readAt ?? new Date().toISOString() })),
        })),
      clearNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) })),

      // ── Sign out ──
      signOut: () =>
        set({
          authUser: null, user: null, session: null, role: 'student',
          isAuthLoading: false,
          hub: null, isFirstTime: false,
          notifications: [],
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
        notifications: state.notifications,
        role: state.role,
      }),
    }
  )
);
