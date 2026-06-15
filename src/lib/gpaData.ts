// ── SKIT Jaipur Autonomous — Marks to Grade Mapping (CBCS) ───────────────────
// Source: SKIT Jaipur Autonomous Scheme 2024-25 (official scheme tables)
export interface GradeEntry {
  label:   string;  // O, A+, A, B+, B, C, P, F
  minMark: number;  // minimum marks (inclusive) to earn this grade
  point:   number;  // grade point
  color:   string;  // display color
  desc:    string;  // description
}

export const GRADE_SCALE: GradeEntry[] = [
  { label: 'O',  minMark: 90, point: 10, color: '#4ADE80', desc: 'Outstanding'  },
  { label: 'A+', minMark: 80, point:  9, color: '#818CF8', desc: 'Excellent'    },
  { label: 'A',  minMark: 70, point:  8, color: '#60A5FA', desc: 'Very Good'    },
  { label: 'B+', minMark: 60, point:  7, color: '#67E8F9', desc: 'Good'         },
  { label: 'B', minMark: 50, point: 6, color: '#34C6D3', desc: 'Above Average' },
  { label: 'C',  minMark: 45, point:  5, color: '#FCD34D', desc: 'Average'      },
  { label: 'P',  minMark: 40, point:  4, color: '#F97316', desc: 'Pass'         },
  { label: 'F',  minMark:  0, point:  0, color: '#F87171', desc: 'Fail'         },
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

export interface SubjectStats {
  mean: number;
  stddev: number;
  total: number;
}

/** Returns the relative grade entry based on class stats (Z-score mapping). Fallbacks to absolute if stats is insufficient. */
export function marksToGradeRelative(
  marks: number | null,
  stats?: SubjectStats
): GradeEntry {
  const fallback = marksToGrade(marks);
  if (marks === null || !stats || stats.total < 5) {
    return fallback;
  }

  // Enforce absolute fail limit: must score >= 40 to pass
  if (marks < 40) {
    return GRADE_SCALE[GRADE_SCALE.length - 1]; // F
  }

  const { mean, stddev } = stats;
  if (stddev === 0) return fallback;

  const z = (marks - mean) / stddev;

  // Standard RTU/SKIT Relative Grading Z-Score mapping:
  // z >= 1.5   => O (10 pts)
  // z >= 1.0   => A+ (9 pts)
  // z >= 0.5   => A (8 pts)
  // z >= 0.0   => B+ (7 pts)
  // z >= -0.5  => B (6 pts)
  // z >= -1.0  => C (5 pts)
  // z < -1.0   => P (4 pts) (marks >= 40 is guaranteed here)
  if (z >= 1.5)  return GRADE_SCALE[0]; // O
  if (z >= 1.0)  return GRADE_SCALE[1]; // A+
  if (z >= 0.5)  return GRADE_SCALE[2]; // A
  if (z >= 0.0)  return GRADE_SCALE[3]; // B+
  if (z >= -0.5) return GRADE_SCALE[4]; // B
  if (z >= -1.0) return GRADE_SCALE[5]; // C
  return GRADE_SCALE[6]; // P
}

// ── Subject row type ──────────────────────────────────────────────────────────
export interface SubjectRow {
  id:      string;
  name:    string;
  credits: number;    // 0.5–6
  marks:   number | null;  // 0–100 total marks, null = not entered
}

// ── Computation helpers ───────────────────────────────────────────────────────
export function computeSGPA(
  subjects: SubjectRow[],
  relativeStats?: Record<string, SubjectStats>
): number {
  const entered = subjects.filter(s => s.marks !== null && s.credits > 0);
  if (entered.length === 0) return 0;
  const totalWeighted = entered.reduce((acc, s) => {
    const stats = relativeStats?.[s.name];
    const gp = stats ? marksToGradeRelative(s.marks, stats).point : marksToPoint(s.marks);
    return acc + s.credits * gp;
  }, 0);
  const totalCredits  = entered.reduce((acc, s) => acc + s.credits, 0);
  return totalCredits > 0 ? parseFloat((totalWeighted / totalCredits).toFixed(2)) : 0;
}

export function computeCGPA(
  semesterData: { [sem: number]: { subjects: SubjectRow[]; locked: boolean } },
  manualHistory: { [sem: number]: number },
  allSemestersRelativeStats?: Record<number, Record<string, SubjectStats>>
): number {
  let totalWeighted = 0;
  let totalCredits  = 0;

  for (let sem = 1; sem <= 8; sem++) {
    const entered = (semesterData[sem]?.subjects ?? []).filter(s => s.marks !== null && s.credits > 0);

    if (entered.length > 0) {
      const stats = allSemestersRelativeStats?.[sem];
      const semWeighted = entered.reduce((acc, s) => {
        const subStats = stats?.[s.name];
        const gp = subStats ? marksToGradeRelative(s.marks, subStats).point : marksToPoint(s.marks);
        return acc + s.credits * gp;
      }, 0);
      const semCredits = entered.reduce((acc, s) => acc + s.credits, 0);
      totalWeighted += semWeighted;
      totalCredits  += semCredits;
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
  grid:    'rgba(255,255,255,0.045)',
  text:    '#6B7280',
  tooltip: {
    bg:     '#161824',
    border: 'rgba(255,255,255,0.1)',
    text:   '#E5E7EB',
  },
};

// ── Branch type ───────────────────────────────────────────────────────────────
export type Branch = 'CSE' | 'CSE-AI' | 'CSE-DS' | 'CSE-IOT' | 'IT' | 'ECE' | 'EE' | 'ME' | 'CE';

export { SUBJECTS_DATA } from './curriculumData';

export const BRANCHES: Branch[] = ['CSE', 'CSE-AI', 'CSE-DS', 'CSE-IOT', 'IT', 'ECE', 'EE', 'ME', 'CE'];
