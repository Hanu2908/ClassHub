// ── SKIT Jaipur Autonomous — Marks to Grade Mapping (CBCS) ───────────────────
// Source: Standard autonomous university grading under RTU CBCS
export interface GradeEntry {
  label:   string;  // O, A+, A, B+, B, C, P, F
  minMark: number;  // minimum marks (inclusive) to earn this grade
  point:   number;  // grade point
  color:   string;  // display color
  desc:    string;  // description
}

export const GRADE_SCALE: GradeEntry[] = [
  { label: 'O',  minMark: 90, point: 10, color: '#10B981', desc: 'Outstanding'  },
  { label: 'A+', minMark: 80, point:  9, color: '#8B5CF6', desc: 'Excellent'    },
  { label: 'A',  minMark: 70, point:  8, color: '#6366F1', desc: 'Very Good'    },
  { label: 'B+', minMark: 60, point:  7, color: '#0EA5E9', desc: 'Good'         },
  { label: 'B',  minMark: 50, point:  6, color: '#14B8A6', desc: 'Above Average'},
  { label: 'C',  minMark: 45, point:  5, color: '#F59E0B', desc: 'Average'      },
  { label: 'P',  minMark: 40, point:  4, color: '#FB923C', desc: 'Pass'         },
  { label: 'F',  minMark:  0, point:  0, color: '#EF4444', desc: 'Fail'         },
];

/** Returns the grade entry for a given marks (0–100). */
export function marksToGrade(marks: number | null): GradeEntry {
  if (marks === null || marks < 0) return GRADE_SCALE[GRADE_SCALE.length - 1]; // F
  const clamped = Math.min(100, Math.max(0, marks));
  return GRADE_SCALE.find(g => clamped >= g.minMark) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/** Grade point from marks. */
export function marksToPoint(marks: number | null): number {
  return marksToGrade(marks).point;
}

/** Color for a marks value. */
export function marksToColor(marks: number | null): string {
  return marksToGrade(marks).color;
}

// ── Subject row type ──────────────────────────────────────────────────────────
export interface SubjectRow {
  id:      string;
  name:    string;
  credits: number;    // 1–6
  marks:   number | null;  // 0–100 total marks, null = not entered
}

// ── Computation helpers ───────────────────────────────────────────────────────
export function computeSGPA(subjects: SubjectRow[]): number {
  const entered = subjects.filter(s => s.marks !== null && s.credits > 0);
  if (entered.length === 0) return 0;
  const totalWeighted = entered.reduce((acc, s) => acc + s.credits * marksToPoint(s.marks), 0);
  const totalCredits  = entered.reduce((acc, s) => acc + s.credits, 0);
  return totalCredits > 0 ? parseFloat((totalWeighted / totalCredits).toFixed(2)) : 0;
}

export function computeCGPA(
  semesterData: { [sem: number]: { subjects: SubjectRow[]; locked: boolean } },
  manualHistory: { [sem: number]: number }
): number {
  let totalWeighted = 0;
  let totalCredits  = 0;

  for (let sem = 1; sem <= 8; sem++) {
    const entered = (semesterData[sem]?.subjects ?? []).filter(s => s.marks !== null && s.credits > 0);

    if (entered.length > 0) {
      const sgpa    = computeSGPA(entered);
      const credits = entered.reduce((acc, s) => acc + s.credits, 0);
      totalWeighted += sgpa * credits;
      totalCredits  += credits;
    } else if (manualHistory[sem] !== undefined) {
      const credits = 20; // proxy weight for a semester entered manually
      totalWeighted += manualHistory[sem] * credits;
      totalCredits  += credits;
    }
  }

  return totalCredits > 0 ? parseFloat((totalWeighted / totalCredits).toFixed(2)) : 0;
}

export function computePercentage(cgpa: number): number {
  // SKIT autonomous standard: CGPA × 10
  return parseFloat((cgpa * 10).toFixed(2));
}

export function getTotalCredits(subjects: SubjectRow[]): number {
  return subjects.filter(s => s.marks !== null).reduce((acc, s) => acc + s.credits, 0);
}

// ── Chart theme ───────────────────────────────────────────────────────────────
export const chartTheme = {
  grid:    'rgba(255,255,255,0.05)',
  text:    '#8B93A8',
  tooltip: {
    bg:     '#1A1D27',
    border: 'rgba(255,255,255,0.08)',
    text:   '#F0F2F8',
  },
};

// ── Default subjects — SKIT Autonomous CSE S1 (from actual marksheet) ─────────
export type Branch = 'CSE' | 'CSE-AI' | 'IT' | 'ECE' | 'EE' | 'ME' | 'CE';

interface DefaultSubject {
  name:    string;
  credits: number;
}

// CSE S1 — based on actual SKIT Jaipur autonomous marksheet provided
const CSE_SUBJECTS: Record<number, DefaultSubject[]> = {
  1: [
    { name: 'Engineering Mathematics-I',                     credits: 4 },
    { name: 'Computational Thinking & Programming',          credits: 4 },
    { name: 'Engineering Physics',                           credits: 3 },
    { name: 'Communication Skills',                          credits: 2 },
    { name: 'Basic Electrical & Electronics Engineering',    credits: 4 },
    { name: 'Essence of Indian Traditional Knowledge',       credits: 1 },
    { name: 'C Programming Lab',                             credits: 2 },
    { name: 'Computer Aided Engineering Graphics',           credits: 2 },
    { name: 'Engineering Physics Lab',                       credits: 1 },
    { name: 'Language Lab',                                  credits: 1 },
    { name: 'Basic Electrical & Electronics Lab',            credits: 1 },
    { name: 'SODECA: Sports I',                              credits: 1 },
  ],
  2: [
    { name: 'Engineering Mathematics-II',                    credits: 4 },
    { name: 'Data Structures',                               credits: 4 },
    { name: 'Chemistry',                                     credits: 3 },
    { name: 'Environmental Studies',                         credits: 2 },
    { name: 'Digital Electronics',                           credits: 3 },
    { name: 'Python Programming',                            credits: 3 },
    { name: 'Data Structures Lab',                           credits: 2 },
    { name: 'Chemistry Lab',                                 credits: 1 },
    { name: 'Python Lab',                                    credits: 1 },
    { name: 'SODECA: Sports II',                             credits: 1 },
  ],
  3: [
    { name: 'Engineering Mathematics-III',                   credits: 4 },
    { name: 'Object Oriented Programming (Java)',            credits: 4 },
    { name: 'Computer Organization & Architecture',          credits: 3 },
    { name: 'Discrete Mathematics',                          credits: 3 },
    { name: 'Operating Systems',                             credits: 3 },
    { name: 'OOP Lab (Java)',                                credits: 2 },
    { name: 'OS Lab',                                        credits: 2 },
    { name: 'SODECA: Sports III',                            credits: 1 },
  ],
  4: [
    { name: 'Theory of Computation',                         credits: 4 },
    { name: 'Design & Analysis of Algorithms',               credits: 4 },
    { name: 'Database Management Systems',                   credits: 4 },
    { name: 'Microprocessors & Interfaces',                  credits: 3 },
    { name: 'Software Engineering',                          credits: 3 },
    { name: 'DBMS Lab',                                      credits: 2 },
    { name: 'Microprocessors Lab',                           credits: 2 },
  ],
  5: [
    { name: 'Compiler Design',                               credits: 4 },
    { name: 'Computer Networks',                             credits: 4 },
    { name: 'Web Technologies',                              credits: 3 },
    { name: 'Artificial Intelligence',                       credits: 3 },
    { name: 'Information Security',                          credits: 3 },
    { name: 'Networks Lab',                                  credits: 2 },
    { name: 'Web Tech Lab',                                  credits: 2 },
  ],
  6: [
    { name: 'Machine Learning',                              credits: 4 },
    { name: 'Cloud Computing',                               credits: 3 },
    { name: 'Mobile Application Development',               credits: 3 },
    { name: 'Big Data Analytics',                            credits: 3 },
    { name: 'Elective-I',                                    credits: 3 },
    { name: 'ML Lab',                                        credits: 2 },
    { name: 'Minor Project',                                 credits: 2 },
  ],
  7: [
    { name: 'Deep Learning',                                 credits: 4 },
    { name: 'Internet of Things',                            credits: 3 },
    { name: 'Distributed Systems',                           credits: 3 },
    { name: 'Elective-II',                                   credits: 3 },
    { name: 'Elective-III',                                  credits: 3 },
    { name: 'Major Project Part-I',                          credits: 4 },
  ],
  8: [
    { name: 'Major Project Part-II',                         credits: 10 },
    { name: 'Industrial Training',                           credits:  4 },
    { name: 'Seminar',                                       credits:  2 },
    { name: 'Elective-IV',                                   credits:  3 },
  ],
};

const CSE_AI_SUBJECTS: Record<number, DefaultSubject[]> = {
  ...CSE_SUBJECTS,
  3: [
    { name: 'Engineering Mathematics-III',    credits: 4 },
    { name: 'Data Structures',                credits: 4 },
    { name: 'Python Programming',             credits: 3 },
    { name: 'Probability & Statistics',       credits: 3 },
    { name: 'AI Fundamentals',                credits: 3 },
    { name: 'Python Lab',                     credits: 2 },
    { name: 'AI Lab',                         credits: 2 },
  ],
  5: [
    { name: 'Machine Learning',               credits: 4 },
    { name: 'Computer Vision',                credits: 4 },
    { name: 'Natural Language Processing',    credits: 3 },
    { name: 'Deep Learning',                  credits: 4 },
    { name: 'AI Ethics',                      credits: 2 },
    { name: 'ML Lab',                         credits: 2 },
  ],
};

const IT_SUBJECTS: Record<number, DefaultSubject[]> = {
  ...CSE_SUBJECTS,
  5: [
    { name: 'Information Security',           credits: 4 },
    { name: 'Web Development',                credits: 4 },
    { name: 'Network Administration',         credits: 3 },
    { name: 'Database Administration',        credits: 3 },
    { name: 'IT Project Management',          credits: 3 },
    { name: 'Networks Lab',                   credits: 2 },
  ],
};

const ECE_SUBJECTS: Record<number, DefaultSubject[]> = {
  1: CSE_SUBJECTS[1],
  2: CSE_SUBJECTS[2],
  3: [
    { name: 'Engineering Mathematics-III',    credits: 4 },
    { name: 'Signals & Systems',              credits: 4 },
    { name: 'Network Analysis',               credits: 3 },
    { name: 'Electronic Devices',             credits: 3 },
    { name: 'Analog Electronics',             credits: 3 },
    { name: 'Digital Electronics',            credits: 3 },
    { name: 'Electronics Lab',                credits: 2 },
  ],
  4: [
    { name: 'Communication Systems',          credits: 4 },
    { name: 'Microprocessors',                credits: 4 },
    { name: 'Electromagnetic Theory',         credits: 3 },
    { name: 'Control Systems',                credits: 3 },
    { name: 'VLSI Design',                    credits: 3 },
    { name: 'VLSI Lab',                       credits: 2 },
  ],
  5: [
    { name: 'Digital Signal Processing',      credits: 4 },
    { name: 'Wireless Communication',         credits: 4 },
    { name: 'Optical Fiber Communication',    credits: 3 },
    { name: 'Embedded Systems',               credits: 3 },
    { name: 'Microwave Engineering',          credits: 3 },
    { name: 'DSP Lab',                        credits: 2 },
  ],
  6: [
    { name: 'Mobile Communication',           credits: 4 },
    { name: 'IoT & Applications',             credits: 3 },
    { name: 'Elective-I',                     credits: 3 },
    { name: 'Signal Processing Lab',          credits: 2 },
    { name: 'Minor Project',                  credits: 2 },
  ],
  7: [
    { name: '5G Technology',                  credits: 3 },
    { name: 'Image Processing',               credits: 3 },
    { name: 'Elective-II',                    credits: 3 },
    { name: 'Major Project Part-I',           credits: 4 },
  ],
  8: CSE_SUBJECTS[8],
};

const GENERIC_UPPER: Record<number, DefaultSubject[]> = {
  3: [
    { name: 'Engineering Mathematics-III',    credits: 4 },
    { name: 'Core Subject-I',                 credits: 4 },
    { name: 'Core Subject-II',                credits: 3 },
    { name: 'Core Subject-III',               credits: 3 },
    { name: 'Core Lab-I',                     credits: 2 },
    { name: 'Core Lab-II',                    credits: 2 },
  ],
  4: [
    { name: 'Core Subject-IV',                credits: 4 },
    { name: 'Core Subject-V',                 credits: 4 },
    { name: 'Core Subject-VI',                credits: 3 },
    { name: 'Core Lab-III',                   credits: 2 },
    { name: 'Elective-I',                     credits: 3 },
  ],
  5: [
    { name: 'Core Subject-VII',               credits: 4 },
    { name: 'Core Subject-VIII',              credits: 4 },
    { name: 'Core Subject-IX',                credits: 3 },
    { name: 'Elective-II',                    credits: 3 },
    { name: 'Minor Project',                  credits: 2 },
  ],
  6: [
    { name: 'Core Subject-X',                 credits: 4 },
    { name: 'Core Subject-XI',                credits: 3 },
    { name: 'Elective-III',                   credits: 3 },
    { name: 'Core Lab-IV',                    credits: 2 },
    { name: 'Major Project Part-I',           credits: 3 },
  ],
  7: [
    { name: 'Advanced Topic-I',               credits: 4 },
    { name: 'Elective-IV',                    credits: 3 },
    { name: 'Elective-V',                     credits: 3 },
    { name: 'Major Project Part-II',          credits: 4 },
  ],
  8: CSE_SUBJECTS[8],
};

export const SUBJECTS_DATA: Record<Branch, Record<number, DefaultSubject[]>> = {
  'CSE':    CSE_SUBJECTS,
  'CSE-AI': CSE_AI_SUBJECTS,
  'IT':     IT_SUBJECTS,
  'ECE':    ECE_SUBJECTS,
  'EE':     { 1: CSE_SUBJECTS[1], 2: CSE_SUBJECTS[2], ...GENERIC_UPPER },
  'ME':     { 1: CSE_SUBJECTS[1], 2: CSE_SUBJECTS[2], ...GENERIC_UPPER },
  'CE':     { 1: CSE_SUBJECTS[1], 2: CSE_SUBJECTS[2], ...GENERIC_UPPER },
};

export const BRANCHES: Branch[] = ['CSE', 'CSE-AI', 'IT', 'ECE', 'EE', 'ME', 'CE'];
