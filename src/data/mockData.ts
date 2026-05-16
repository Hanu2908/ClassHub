// Mock data for ClassHub — all pages driven by this until backend is wired

export const mockUser = {
  id: 'u001',
  name: 'Himanshu Sharma',
  email: 'hiimanshu@skit.ac.in',
  avatarUrl: null as string | null,
  role: 'student' as 'student' | 'cr',
  classRoll: '17',
  universityRoll: '25ESKIT089',
};

export const mockHub = {
  hubCode: 'P2QHIZ',
  section: 'P2',
  hubName: 'Section P2',
  institution: 'SKIT Jaipur',
  totalStudents: 60,
};

const now = new Date();
const todayName = now.toLocaleDateString('en-US', { weekday: 'short' });

export const mockSchedule: Record<string, {
  id: string; day: string; subject: string; code: string;
  room: string; teacher: string; type: string; startTime: string; endTime: string;
}[]> = {
  Mon: [
    { id: 's1', day: 'Mon', subject: 'Engineering Chemistry', code: 'CH-101', room: 'Block A', teacher: 'Dr. Gupta', type: 'Lecture', startTime: '09:00', endTime: '10:00' },
    { id: 's2', day: 'Mon', subject: 'DBMS', code: 'CS-304', room: 'Block B', teacher: 'Dr. Verma', type: 'Lecture', startTime: '11:00', endTime: '12:00' },
    { id: 's3', day: 'Mon', subject: 'AI Fundamentals', code: 'CS-210', room: 'Block A', teacher: 'Dr. Singh', type: 'Lecture', startTime: '14:00', endTime: '15:00' },
  ],
  Tue: [
    { id: 's4', day: 'Tue', subject: 'Operating Systems', code: 'CS-306', room: 'Block B', teacher: 'Dr. Sharma', type: 'Lecture', startTime: '09:00', endTime: '10:00' },
    { id: 's5', day: 'Tue', subject: 'Chemistry Lab', code: 'CH-101L', room: 'Lab 1', teacher: 'Dr. Gupta', type: 'Lab', startTime: '11:00', endTime: '13:00' },
  ],
  Wed: [
    { id: 's6', day: 'Wed', subject: 'Operating Systems', code: 'CS-304', room: 'Block B', teacher: 'Dr. Sharma', type: 'Lecture', startTime: '09:00', endTime: '10:00' },
    { id: 's7', day: 'Wed', subject: 'Database Lab', code: 'CS-318', room: 'Lab 2', teacher: 'Dr. Verma', type: 'Lab', startTime: '11:00', endTime: '12:00' },
    { id: 's8', day: 'Wed', subject: 'AI Fundamentals', code: 'CS-210', room: 'Block A', teacher: 'Dr. Singh', type: 'Lecture', startTime: '14:00', endTime: '15:00' },
    { id: 's9', day: 'Wed', subject: 'Mentor Session', code: 'MENTOR', room: 'Online', teacher: '', type: 'Other', startTime: '16:00', endTime: '17:00' },
  ],
  Thu: [
    { id: 's10', day: 'Thu', subject: 'DBMS', code: 'CS-304', room: 'Block B-102', teacher: 'Dr. Verma', type: 'Lecture', startTime: '10:00', endTime: '11:00' },
    { id: 's10b', day: 'Thu', subject: 'Operating Systems', code: 'CS-306', room: 'Block B-105', teacher: 'Dr. Sharma', type: 'Lecture', startTime: '11:00', endTime: '12:00' },
    { id: 's11now', day: 'Thu', subject: 'AI Fundamentals', code: 'CS-210', room: 'Block A-301', teacher: 'Dr. Singh', type: 'Lecture', startTime: '13:30', endTime: '15:00' },
    { id: 's11up', day: 'Thu', subject: 'Environmental Sciences', code: 'ES-201', room: 'Block C-101', teacher: 'Dr. Patel', type: 'Lecture', startTime: '15:10', endTime: '16:10' },
  ],
  Fri: [
    { id: 's12', day: 'Fri', subject: 'Engineering Chemistry', code: 'CH-101', room: 'Block A-201', teacher: 'Dr. Gupta', type: 'Lecture', startTime: '09:00', endTime: '10:00' },
    { id: 's13', day: 'Fri', subject: 'Operating Systems', code: 'CS-306', room: 'Block B-105', teacher: 'Dr. Sharma', type: 'Lecture', startTime: '11:00', endTime: '12:00' },
    { id: 's13now', day: 'Fri', subject: 'AI Fundamentals', code: 'CS-210', room: 'Block A-301', teacher: 'Dr. Singh', type: 'Lecture', startTime: '13:30', endTime: '15:00' },
    { id: 's13up', day: 'Fri', subject: 'Environmental Sciences', code: 'ES-201', room: 'Block C-101', teacher: 'Dr. Patel', type: 'Lecture', startTime: '15:10', endTime: '16:10' },
  ],
  Sat: [
    { id: 's14', day: 'Sat', subject: 'AI Lab', code: 'CS-210L', room: 'Lab 3', teacher: 'Dr. Singh', type: 'Lab', startTime: '09:00', endTime: '11:00' },
  ],
};

// Give today's schedule something to show
const todayKey = todayName as keyof typeof mockSchedule;
if (!(todayKey in mockSchedule)) {
  (mockSchedule as any)[todayName] = mockSchedule['Wed'];
}

export const mockAnnouncements = [
  {
    id: 'a1', title: 'DBMS Assignment Deadline Changed',
    body: 'The deadline for the DBMS Assignment (Unit 3) has been moved to TODAY at 6:00 PM. Submit via the Google Classroom link shared earlier. No extensions will be granted.',
    priority: 'critical' as const,
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a2', title: 'OS Lab Report Reminder',
    body: 'Submit your OS Lab Report (Experiment 4 & 5) by tomorrow 11:59 PM. Lab manual is mandatory. Use the submission link pinned in the group.',
    priority: 'general' as const,
    deadline: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    postedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a3', title: 'College Fest Registration Open',
    body: 'Technovanza 2026 registrations are open! Register before May 20. Forms are available at the student union office and online at technovanza.skit.ac.in.',
    priority: 'general' as const,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    postedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a4', title: 'AI Project Proposal Due',
    body: 'Submit your AI/ML project proposal in IEEE format by May 24. Topics must be approved by Dr. Singh. Soft copy to be submitted on Classroom, hard copy on the due date.',
    priority: 'general' as const,
    deadline: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
];

export const mockAssignments = [
  {
    id: 'as1', title: 'DBMS Assignment',
    subject: 'DBMS', subjectCode: 'CS-304',
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    description: 'Complete Unit 3 questions from the assignment sheet. Follow the format strictly.',
    status: 'pending' as const,
    pdfUrl: 'https://example.com/dbms-master.pdf',
    hasSets: true,
    sets: [
      { id: 'set-a', label: 'Set A', rollStart: 1, rollEnd: 25, pageNumbers: '4-5', description: 'Complete Pages 4–5 of the assignment PDF.', pdfUrl: 'https://example.com/dbms-set-a.pdf' },
      { id: 'set-b', label: 'Set B', rollStart: 26, rollEnd: 50, pageNumbers: '6-7', description: 'Complete Pages 6–7 of the assignment PDF.', pdfUrl: 'https://example.com/dbms-set-b.pdf' },
      { id: 'set-c', label: 'Set C', rollStart: 51, rollEnd: 70, pageNumbers: '8-9', description: 'Complete Pages 8–9 of the assignment PDF.', pdfUrl: null },
    ],
    submittedLink: null,
  },
  {
    id: 'as2', title: 'OS Lab Report',
    subject: 'Operating Systems', subjectCode: 'CS-306',
    dueDate: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    description: 'Experiments 4 & 5. Include observations, results and viva questions.',
    status: 'pending' as const,
    pdfUrl: null,
    hasSets: false,
    sets: [],
    submittedLink: null,
  },
  {
    id: 'as3', title: 'AI Project Proposal',
    subject: 'AI Fundamentals', subjectCode: 'CS-210',
    dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'IEEE format proposal, 3–5 pages. Topic approval required.',
    status: 'submitted' as const,
    pdfUrl: null,
    hasSets: false,
    sets: [],
    submittedLink: 'https://drive.google.com/file/priyanshu-ai-proposal',
  },
];


export const mockPolls = [
  {
    id: 'p1',
    question: 'Should campus network be upgraded to Wi-Fi 6E?',
    type: 'anonymous' as const,
    closesAt: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active' as const,
    options: [
      { id: 'p1o1', text: 'Yes, upgrade it', votes: 342 },
      { id: 'p1o2', text: 'No, fine as is', votes: 161 },
    ],
    userVote: null as string | null,
  },
  {
    id: 'p2',
    question: 'Who is attending the Project Expo?',
    type: 'actionable' as const,
    closesAt: new Date(Date.now() + 1.1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active' as const,
    options: [
      { id: 'p2o1', text: "I'll be there", votes: 21 },
      { id: 'p2o2', text: "Can't make it", votes: 7 },
    ],
    userVote: null as string | null,
  },
  {
    id: 'p3',
    question: 'Best time for extra classes on Saturdays?',
    type: 'anonymous' as const,
    closesAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'closed' as const,
    options: [
      { id: 'p3o1', text: '9 AM – 11 AM', votes: 28 },
      { id: 'p3o2', text: '11 AM – 1 PM', votes: 14 },
      { id: 'p3o3', text: 'No extra classes', votes: 22 },
    ],
    userVote: 'p3o1' as string | null,
  },
];

export const mockAttendance = {
  overallPercentage: 84.2,
  lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  subjects: [
    { code: 'CH-101', name: 'Engineering Chemistry', type: 'Lecture', present: 29, absent: 3, total: 32, percentage: 90.63, canSkip: 3, needToAttend: 0 },
    { code: 'CH-101T', name: 'Engg. Chemistry (Tutorial)', type: 'Tutorial', present: 6, absent: 2, total: 8, percentage: 75.00, canSkip: 0, needToAttend: 0 },
    { code: 'CH-101L', name: 'Engg. Chemistry Lab', type: 'Lab', present: 20, absent: 6, total: 26, percentage: 76.92, canSkip: 0, needToAttend: 0 },
    { code: 'CS-304', name: 'DBMS', type: 'Lecture', present: 25, absent: 5, total: 30, percentage: 83.33, canSkip: 1, needToAttend: 0 },
    { code: 'CS-306', name: 'Operating Systems', type: 'Lecture', present: 22, absent: 4, total: 26, percentage: 84.62, canSkip: 2, needToAttend: 0 },
    { code: 'CS-318', name: 'Database Lab', type: 'Lab', present: 12, absent: 4, total: 16, percentage: 75.00, canSkip: 0, needToAttend: 0 },
    { code: 'CS-210', name: 'AI Fundamentals', type: 'Lecture', present: 18, absent: 4, total: 22, percentage: 81.82, canSkip: 1, needToAttend: 0 },
    { code: 'ES-201', name: 'Environmental Sciences', type: 'Lecture', present: 10, absent: 12, total: 22, percentage: 45.45, canSkip: 0, needToAttend: 6 },
  ],
};
