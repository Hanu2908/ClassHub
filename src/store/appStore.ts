import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockAttendance, mockAssignments } from '../data/mockData';

// ── Exported types ────────────────────────────────────────────────────────────

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
  label: string;       // "Set 1", "Set 2", etc.
  rollStart: number;
  rollEnd: number;
  pageNumbers: string; // free-text, editable — "1-3", "4", "5-7"
  description: string; // auto-built: "Complete Pages X of the attached PDF."
  pdfUrl: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  dueDate: string;
  description: string;
  status: 'pending' | 'submitted';
  pdfUrl: string | null;  // master PDF URL
  hasSets: boolean;
  sets: AssignmentSet[];
  submittedLink: string | null;
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

  // Announcements acknowledged
  acknowledgedIds: string[];

  // Poll votes  { pollId: optionId }
  pollVotes: Record<string, string>;

  // Assignment submissions { assignmentId: link }
  submissions: Record<string, string>;

  // Assignments — CR can add new ones
  assignments: Assignment[];

  // Attendance — shared between AttendancePage and DashboardPage
  attendanceSubjects: AttendanceSubject[];
  attendanceOverall: number;

  // Actions
  setUser: (user: UserInfo | null) => void;
  setSession: (session: any | null) => void;
  setRole: (role: 'student' | 'cr') => void;
  setHub: (hub: HubInfo | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setFirstTime: (v: boolean) => void;
  acknowledge: (id: string) => void;
  vote: (pollId: string, optionId: string) => void;
  submit: (assignmentId: string, link: string) => void;
  addAssignment: (a: Assignment) => void;
  setAttendance: (subjects: AttendanceSubject[]) => void;
  signOut: () => void;
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
      acknowledgedIds: [],
      pollVotes: {},
      submissions: {},
      assignments: mockAssignments as Assignment[],
      attendanceSubjects: mockAttendance.subjects as AttendanceSubject[],
      attendanceOverall: mockAttendance.overallPercentage,

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
      addAssignment: (a) =>
        set((s) => ({ assignments: [a, ...s.assignments] })),
      setAttendance: (subjects) => {
        const overall = subjects.length > 0
          ? subjects.reduce((acc, s) => acc + s.percentage, 0) / subjects.length
          : 0;
        set({ attendanceSubjects: subjects, attendanceOverall: overall });
      },
      signOut: () =>
        set({
          user: null, session: null, role: 'student',
          hub: null, isFirstTime: false,
          acknowledgedIds: [], pollVotes: {}, submissions: {},
          assignments: mockAssignments as Assignment[],
          attendanceSubjects: mockAttendance.subjects as AttendanceSubject[],
          attendanceOverall: mockAttendance.overallPercentage,
        }),
    }),
    { name: 'classhub-store' }
  )
);
