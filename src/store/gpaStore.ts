import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SUBJECTS_DATA, computeSGPA, computeCGPA, computePercentage, getTotalCredits } from '../lib/gpaData';
import type { Branch, SubjectRow } from '../lib/gpaData';

// ── State shape ───────────────────────────────────────────────────────────────
interface SemesterData {
  subjects: SubjectRow[];
  locked:   boolean;
}

interface GPAState {
  activeBranch:   Branch;
  activeSemester: number;
  semesters:      { [sem: number]: SemesterData };
  manualHistory:  { [sem: number]: number }; // user-entered previous sem CGPA

  // Actions
  setActiveBranch:   (branch: Branch) => void;
  setActiveSemester: (sem: number) => void;
  addSubject:        (sem: number) => void;
  updateSubject:     (sem: number, id: string, updates: Partial<SubjectRow>) => void;
  removeSubject:     (sem: number, id: string) => void;
  resetSemester:     (sem: number) => void;
  lockSemester:      (sem: number, locked: boolean) => void;
  setManualHistory:  (sem: number, cgpa: number | null) => void;

  // Computed selectors
  getSGPA:              (sem: number) => number;
  getCGPA:              () => number;
  getPercentage:        () => number;
  getAllSemesterSGPAs:   () => { sem: number; sgpa: number; cgpa: number }[];
  getTotalActiveCredits:(sem: number) => number;
}

function makeDefaultSemester(branch: Branch, sem: number): SemesterData {
  const defaults = SUBJECTS_DATA[branch]?.[sem] ?? [];
  return {
    locked: false,
    subjects: defaults.map((d, i) => ({
      id:      `${sem}-${i}-${Date.now()}`,
      name:    d.name,
      credits: d.credits,
      marks:   null,
    })),
  };
}

export const useGPAStore = create<GPAState>()(
  persist(
    (set, get) => ({
      activeBranch:   'CSE',
      activeSemester: 1,
      semesters: {
        1: makeDefaultSemester('CSE', 1),
      },
      manualHistory: {},

      setActiveBranch: (branch) => {
        const existing = get().semesters;
        const next: { [s: number]: SemesterData } = {};
        for (let s = 1; s <= 8; s++) {
          next[s] = existing[s] ?? makeDefaultSemester(branch, s);
        }
        set({ activeBranch: branch, semesters: next });
      },

      setActiveSemester: (sem) => {
        if (!get().semesters[sem]) {
          const branch = get().activeBranch;
          set((state) => ({
            activeSemester: sem,
            semesters: {
              ...state.semesters,
              [sem]: makeDefaultSemester(branch, sem),
            },
          }));
        } else {
          set({ activeSemester: sem });
        }
      },

      addSubject: (sem) => {
        const id = `${sem}-custom-${Date.now()}`;
        set((state) => ({
          semesters: {
            ...state.semesters,
            [sem]: {
              ...(state.semesters[sem] ?? { locked: false, subjects: [] }),
              subjects: [
                ...(state.semesters[sem]?.subjects ?? []),
                { id, name: '', credits: 4, marks: null },
              ],
            },
          },
        }));
      },

      updateSubject: (sem, id, updates) => {
        set((state) => {
          const semData = state.semesters[sem];
          if (!semData) return {};
          return {
            semesters: {
              ...state.semesters,
              [sem]: {
                ...semData,
                subjects: semData.subjects.map((s) =>
                  s.id === id ? { ...s, ...updates } : s
                ),
              },
            },
          };
        });
      },

      removeSubject: (sem, id) => {
        set((state) => {
          const semData = state.semesters[sem];
          if (!semData) return {};
          return {
            semesters: {
              ...state.semesters,
              [sem]: {
                ...semData,
                subjects: semData.subjects.filter((s) => s.id !== id),
              },
            },
          };
        });
      },

      resetSemester: (sem) => {
        set((state) => ({
          semesters: {
            ...state.semesters,
            [sem]: makeDefaultSemester(get().activeBranch, sem),
          },
        }));
      },

      lockSemester: (sem, locked) => {
        set((state) => ({
          semesters: {
            ...state.semesters,
            [sem]: {
              ...(state.semesters[sem] ?? makeDefaultSemester(get().activeBranch, sem)),
              locked,
            },
          },
        }));
      },

      setManualHistory: (sem, cgpa) => {
        set((state) => {
          const next = { ...state.manualHistory };
          if (cgpa === null) delete next[sem];
          else next[sem] = cgpa;
          return { manualHistory: next };
        });
      },

      getSGPA: (sem) => computeSGPA(get().semesters[sem]?.subjects ?? []),

      getCGPA: () => computeCGPA(get().semesters, get().manualHistory),

      getPercentage: () => computePercentage(get().getCGPA()),

      getAllSemesterSGPAs: () => {
        const { semesters, manualHistory } = get();
        const result: { sem: number; sgpa: number; cgpa: number }[] = [];
        let runningWeighted = 0;
        let runningCredits  = 0;

        for (let sem = 1; sem <= 8; sem++) {
          const subjects = semesters[sem]?.subjects ?? [];
          const entered  = subjects.filter(s => s.marks !== null && s.credits > 0);
          const hasManual = manualHistory[sem] !== undefined;

          if (entered.length > 0) {
            const sgpa    = computeSGPA(entered);
            const credits = entered.reduce((acc, s) => acc + s.credits, 0);
            runningWeighted += sgpa * credits;
            runningCredits  += credits;
            result.push({
              sem, sgpa,
              cgpa: parseFloat((runningWeighted / runningCredits).toFixed(2)),
            });
          } else if (hasManual) {
            const credits = 20;
            runningWeighted += manualHistory[sem] * credits;
            runningCredits  += credits;
            result.push({
              sem,
              sgpa: manualHistory[sem],
              cgpa: parseFloat((runningWeighted / runningCredits).toFixed(2)),
            });
          }
        }
        return result;
      },

      getTotalActiveCredits: (sem) =>
        getTotalCredits(get().semesters[sem]?.subjects ?? []),
    }),
    {
      name: 'classhub-gpa-v2', // bumped version since SubjectRow shape changed
      partialize: (state) => ({
        activeBranch:   state.activeBranch,
        activeSemester: state.activeSemester,
        semesters:      state.semesters,
        manualHistory:  state.manualHistory,
      }),
    }
  )
);
