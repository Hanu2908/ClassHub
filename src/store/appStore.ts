import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  mockAttendance, mockAssignments, mockAnnouncements,
  mockPolls, mockSchedule,
} from '../data/mockData';

// ── Exported types — backend-ready interfaces ─────────────────────────────────
// All interfaces are shaped to match what a REST/Supabase backend would return.
// When wiring real API: replace mock defaults with API fetch results.

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
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

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  dueDate: string;        // ISO
  description: string;
  status: 'pending' | 'submitted';
  pdfUrl: string | null;
  hasSets: boolean;
  sets: AssignmentSet[];
  submittedLink: string | null;
  createdAt: string;      // ISO — for backend ordering
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'critical' | 'general';
  deadline: string | null; // ISO
  postedAt: string;         // ISO
  attachmentUrl?: string | null;
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
  closesAt: string; // ISO
  status: 'active' | 'closed';
  options: PollOption[];
  createdAt: string; // ISO
}

export interface ScheduleSlot {
  id: string;
  day: string;
  subject: string;
  code: string;
  room: string;
  teacher: string;
  type: string; // 'Lecture' | 'Lab' | 'Tutorial' | 'Other'
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
}

export type ScheduleMap = Record<string, ScheduleSlot[]>;

export type NotificationType = 'cr_broadcast' | 'assignment' | 'announcement' | 'system';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  createdAt: string; // ISO
  read: boolean;
  readAt?: string; // ISO
}

// ── Expiry helper — 2 days after deadline ────────────────────────────────────
// Use these selectors in components — not stored state.
export const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function isExpired(isoDeadline: string | null | undefined): boolean {
  if (!isoDeadline) return false;
  return Date.now() > new Date(isoDeadline).getTime() + TWO_DAYS_MS;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AppState {
  // Auth
  user: UserInfo | null;
  session: any | null;
  role: 'student' | 'cr';
  isFirstTime: boolean;

  // Hub
  hub: HubInfo | null;

  // UI
  activeTab: 'home' | 'schedule' | 'polls' | 'profile';

  // Data — all writable, moved from static mock
  announcements: Announcement[];
  assignments: Assignment[];
  polls: Poll[];
  schedule: ScheduleMap;

  // Acknowledged announcement IDs
  acknowledgedIds: string[];

  // Poll votes { pollId: optionId }
  pollVotes: Record<string, string>;

  // Assignment submissions { assignmentId: link } (current user)
  submissions: Record<string, string>;

  // CR tracking: { assignmentId: [studentId1, studentId2] }
  studentSubmissions: Record<string, string[]>;

  // Attendance
  attendanceSubjects: AttendanceSubject[];
  attendanceOverall: number;

  // In-app notifications
  notifications: AppNotification[];

  // ── Actions ──
  setUser: (user: UserInfo | null) => void;
  setSession: (session: any | null) => void;
  setRole: (role: 'student' | 'cr') => void;
  setHub: (hub: HubInfo | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setFirstTime: (v: boolean) => void;

  acknowledge: (id: string) => void;
  vote: (pollId: string, optionId: string) => void;
  submit: (assignmentId: string, link: string) => void;
  toggleStudentSubmission: (assignmentId: string, studentId: string) => void;

  // CRUD — assignments
  addAssignment: (a: Assignment) => void;
  deleteAssignment: (id: string) => void;

  // CRUD — announcements
  addAnnouncement: (a: Announcement) => void;
  deleteAnnouncement: (id: string) => void;

  // CRUD — polls
  addPoll: (p: Poll) => void;
  deletePoll: (id: string) => void;

  // CRUD — schedule
  setSchedule: (schedule: ScheduleMap) => void;
  addScheduleSlot: (slot: ScheduleSlot) => void;
  updateScheduleSlot: (slot: ScheduleSlot) => void;
  deleteScheduleSlot: (id: string) => void;

  // Attendance
  setAttendance: (subjects: AttendanceSubject[]) => void;

  // Notifications
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;

  signOut: () => void;
}

// ── Helper: build initial schedule map typed as ScheduleMap ──────────────────
function buildInitialSchedule(): ScheduleMap {
  const s: ScheduleMap = {};
  for (const [day, slots] of Object.entries(mockSchedule)) {
    s[day] = slots.map(sl => ({ ...sl } as ScheduleSlot));
  }
  return s;
}

function buildInitialAssignments(): Assignment[] {
  return (mockAssignments as any[]).map(a => ({
    ...a,
    createdAt: a.createdAt ?? new Date(Date.now() - 60000).toISOString(),
  })) as Assignment[];
}

function buildInitialPolls(): Poll[] {
  return (mockPolls as any[]).map(p => ({
    ...p,
    createdAt: p.createdAt ?? new Date(Date.now() - 60000).toISOString(),
  })) as Poll[];
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      role: 'student',
      isFirstTime: false,
      hub: null,
      activeTab: 'home',

      announcements: mockAnnouncements as Announcement[],
      assignments: buildInitialAssignments(),
      polls: buildInitialPolls(),
      schedule: buildInitialSchedule(),

      acknowledgedIds: [],
      pollVotes: {},
      submissions: {},
      studentSubmissions: {},

      attendanceSubjects: mockAttendance.subjects as AttendanceSubject[],
      attendanceOverall: mockAttendance.overallPercentage,

      notifications: [],

      // ── Setters ──
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setRole: (role) => set({ role }),
      setHub: (hub) => set({ hub }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setFirstTime: (isFirstTime) => set({ isFirstTime }),

      acknowledge: (id) =>
        set((s) => ({ acknowledgedIds: [...s.acknowledgedIds, id] })),

      vote: (pollId, optionId) =>
        set((s) => ({ pollVotes: { ...s.pollVotes, [pollId]: optionId } })),

      submit: (assignmentId, link) =>
        set((s) => ({ submissions: { ...s.submissions, [assignmentId]: link } })),

      toggleStudentSubmission: (assignmentId, studentId) =>
        set((s) => {
          const current = s.studentSubmissions[assignmentId] || [];
          const next = current.includes(studentId)
            ? current.filter(id => id !== studentId)
            : [...current, studentId];
          return { studentSubmissions: { ...s.studentSubmissions, [assignmentId]: next } };
        }),

      // ── Assignments ──
      addAssignment: (a) =>
        set((s) => ({ assignments: [a, ...s.assignments] })),
      deleteAssignment: (id) =>
        set((s) => ({ assignments: s.assignments.filter(a => a.id !== id) })),

      // ── Announcements ──
      addAnnouncement: (a) =>
        set((s) => ({ announcements: [a, ...s.announcements] })),
      deleteAnnouncement: (id) =>
        set((s) => ({ announcements: s.announcements.filter(a => a.id !== id) })),

      // ── Polls ──
      addPoll: (p) =>
        set((s) => ({ polls: [p, ...s.polls] })),
      deletePoll: (id) =>
        set((s) => ({ polls: s.polls.filter(p => p.id !== id) })),

      // ── Schedule ──
      setSchedule: (schedule) => set({ schedule }),
      addScheduleSlot: (slot) =>
        set((s) => ({
          schedule: {
            ...s.schedule,
            [slot.day]: [...(s.schedule[slot.day] ?? []), slot]
              .sort((a, b) => a.startTime.localeCompare(b.startTime)),
          },
        })),
      updateScheduleSlot: (slot) =>
        set((s) => ({
          schedule: {
            ...s.schedule,
            [slot.day]: (s.schedule[slot.day] ?? [])
              .map(sl => sl.id === slot.id ? slot : sl)
              .sort((a, b) => a.startTime.localeCompare(b.startTime)),
          },
        })),
      deleteScheduleSlot: (id) =>
        set((s) => {
          const next: ScheduleMap = {};
          for (const [day, slots] of Object.entries(s.schedule)) {
            next[day] = slots.filter(sl => sl.id !== id);
          }
          return { schedule: next };
        }),

      // ── Attendance ──
      setAttendance: (subjects) => {
        const overall = subjects.length > 0
          ? subjects.reduce((acc, s) => acc + s.percentage, 0) / subjects.length
          : 0;
        set({ attendanceSubjects: subjects, attendanceOverall: overall });
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
          user: null, session: null, role: 'student',
          hub: null, isFirstTime: false,
          acknowledgedIds: [], pollVotes: {}, submissions: {}, studentSubmissions: {},
          assignments: buildInitialAssignments(),
          announcements: mockAnnouncements as Announcement[],
          polls: buildInitialPolls(),
          schedule: buildInitialSchedule(),
          attendanceSubjects: mockAttendance.subjects as AttendanceSubject[],
          attendanceOverall: mockAttendance.overallPercentage,
          notifications: [],
        }),
    }),
    { name: 'classhub-store' }
  )
);
