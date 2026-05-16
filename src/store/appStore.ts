import { create } from 'zustand';
import {
  mockUser, mockHub, mockSchedule, mockAnnouncements,
  mockAssignments, mockPolls, mockAttendance,
} from '../data/mockData';

// ── Client-only UI state (ADR-016: Zustand for client state ONLY) ──
// All server state will be moved to TanStack Query hooks in Phase 3.
//
// TEMPORARY: Some app pages still import old store fields (user, hub, etc.)
// We keep them here as read-only mock data so those pages don't crash.
// Phase 3 will remove these and wire pages to hooks directly.

interface AppState {
  // UI — permanent
  activeTab: 'home' | 'schedule' | 'polls' | 'profile';
  setActiveTab: (tab: AppState['activeTab']) => void;

  // ── TEMPORARY mock data (remove in Phase 3) ──
  user: typeof mockUser | null;
  hub: typeof mockHub | null;
  role: 'student' | 'cr';

  // Announcements
  acknowledgedIds: Set<string>;
  acknowledge: (id: string) => void;

  // Attendance (mock)
  attendanceSubjects: typeof mockAttendance.subjects;
  attendanceOverall: number;
  setAttendance: (code: string, field: string, delta: number) => void;

  // Polls (mock)
  pollVotes: Record<string, string>;
  vote: (pollId: string, optionId: string) => void;

  // Assignments (mock)
  assignments: typeof mockAssignments;
  submissions: Record<string, string>;
  submit: (assignmentId: string, link: string) => void;
  addAssignment: (a: (typeof mockAssignments)[0]) => void;

  // Sign out / reset
  signOut: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // UI
  activeTab: 'home',
  setActiveTab: (activeTab) => set({ activeTab }),

  // TEMPORARY mock data
  user: mockUser,
  hub: mockHub,
  role: 'student',

  // Announcements
  acknowledgedIds: new Set<string>(),
  acknowledge: (id) => set((s) => {
    const next = new Set(s.acknowledgedIds);
    next.add(id);
    return { acknowledgedIds: next };
  }),

  // Attendance
  attendanceSubjects: mockAttendance.subjects,
  attendanceOverall: mockAttendance.overallPercentage,
  setAttendance: (code, field, delta) => set((s) => {
    const subjects = s.attendanceSubjects.map((sub) => {
      if (sub.code !== code) return sub;
      const updated = { ...sub, [field]: Math.max(0, (sub as any)[field] + delta) };
      const total = updated.present + updated.absent;
      updated.percentage = total > 0 ? Math.round((updated.present / total) * 10000) / 100 : 0;
      updated.total = total;
      return updated;
    });
    const overallTotal = subjects.reduce((a, s) => a + s.total, 0);
    const overallPresent = subjects.reduce((a, s) => a + s.present, 0);
    return {
      attendanceSubjects: subjects,
      attendanceOverall: overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 10000) / 100 : 0,
    };
  }),

  // Polls
  pollVotes: {},
  vote: (pollId, optionId) => set((s) => ({
    pollVotes: { ...s.pollVotes, [pollId]: optionId },
  })),

  // Assignments
  assignments: mockAssignments,
  submissions: {},
  submit: (assignmentId, link) => set((s) => ({
    submissions: { ...s.submissions, [assignmentId]: link },
  })),
  addAssignment: (a) => set((s) => ({
    assignments: [a, ...s.assignments],
  })),

  // Reset
  signOut: () => set({ user: null, hub: null }),
  reset: () => set({
    activeTab: 'home',
    user: mockUser,
    hub: mockHub,
    role: 'student',
    acknowledgedIds: new Set(),
    pollVotes: {},
    submissions: {},
  }),
}));
