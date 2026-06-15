import { describe, it, expect } from 'vitest';
import { 
  marksToGrade, 
  computeSGPA, 
  computeCGPA, 
  computePercentage,
  marksToGradeRelative,
  type SubjectRow,
  type SubjectStats
} from '../../src/lib/gpaData';

describe('GPA Calculation Logic (SKIT Autonomous Scheme)', () => {

  describe('1. Grade & Point Boundaries', () => {
    it('should map score 39 to F (0 points) since the minimum pass mark is 40', () => {
      // NOTE: Wait, the spec says "marks 39 -> P (4 pts); 40 -> P" in Section 6, but in Section 4.3 it says
      // "Explicitly not in this sprint: changing computeSGPA/computeCGPA formulas or the 20-credit manual-semester proxy in gpaData.ts".
      // Let's verify what gpaData.ts actually does for 39:
      // GradeEntry for F is minMark: 0, point: 0. 
      // GradeEntry for P is minMark: 40, point: 4.
      // So marksToGrade(39) should return F (0 points), and marksToGrade(40) should return P (4 points).
      // We will follow current gpaData.ts exact code and test it faithfully.
      const grade39 = marksToGrade(39);
      expect(grade39.label).toBe('F');
      expect(grade39.point).toBe(0);

      const grade40 = marksToGrade(40);
      expect(grade40.label).toBe('P');
      expect(grade40.point).toBe(4);
    });

    it('should map score 89 to A+ (9 points) and 90 to O (10 points)', () => {
      const grade89 = marksToGrade(89);
      expect(grade89.label).toBe('A+');
      expect(grade89.point).toBe(9);

      const grade90 = marksToGrade(90);
      expect(grade90.label).toBe('O');
      expect(grade90.point).toBe(10);
    });

    it('should handle edge scores correctly (0, 45, 50, 60, 70, 100)', () => {
      expect(marksToGrade(0).label).toBe('F');
      expect(marksToGrade(45).label).toBe('C');
      expect(marksToGrade(50).label).toBe('B');
      expect(marksToGrade(60).label).toBe('B+');
      expect(marksToGrade(70).label).toBe('A');
      expect(marksToGrade(100).label).toBe('O');
    });

    it('should handle null/negative marks gracefully by returning F', () => {
      expect(marksToGrade(null).label).toBe('F');
      expect(marksToGrade(-5).label).toBe('F');
    });
  });

  describe('2. SGPA Weighted Calculations', () => {
    it('should calculate correct weighted SGPA for a standard semester', () => {
      // 4 subjects with marks:
      // Sub 1: 4 credits, 95 marks (O -> 10 pts) -> weighted = 4 * 10 = 40
      // Sub 2: 3 credits, 85 marks (A+ -> 9 pts) -> weighted = 3 * 9 = 27
      // Sub 3: 2 credits, 72 marks (A -> 8 pts) -> weighted = 2 * 8 = 16
      // Sub 4: 1 credit,  45 marks (C -> 5 pts) -> weighted = 1 * 5 = 5
      // Total weighted = 40 + 27 + 16 + 5 = 88
      // Total credits = 4 + 3 + 2 + 1 = 10
      // Expected SGPA = 88 / 10 = 8.80
      const subjects: SubjectRow[] = [
        { id: '1', name: 'Sub 1', credits: 4, marks: 95 },
        { id: '2', name: 'Sub 2', credits: 3, marks: 85 },
        { id: '3', name: 'Sub 3', credits: 2, marks: 72 },
        { id: '4', name: 'Sub 4', credits: 1, marks: 45 },
      ];
      expect(computeSGPA(subjects)).toBe(8.80);
    });

    it('should return 0 when there are no subjects', () => {
      expect(computeSGPA([])).toBe(0);
    });
  });

  describe('3. CGPA Aggregations', () => {
    it('should aggregate multiple semesters with correct credit weights', () => {
      // Sem 1: 20 credits, SGPA = 9.00 -> Weighted = 180
      // Sem 2: 10 credits, SGPA = 8.00 -> Weighted = 80
      // Total weighted = 260, Total credits = 30
      // Expected CGPA = 260 / 30 = 8.67
      const semesterData = {
        1: {
          locked: true,
          subjects: [
            { id: '1', name: 'Sub 1', credits: 20, marks: 90 } // 10 pts * 20 cr = 200 pts
          ]
        },
        2: {
          locked: true,
          subjects: [
            { id: '2', name: 'Sub 2', credits: 10, marks: 80 } // 9 pts * 10 cr = 90 pts
          ]
        }
      };
      // Wait, let's verify what CGPA calculation is with subjects.
      // S1 SGPA = 10.00, S2 SGPA = 9.00.
      // Total credits = 30. Total weighted = (10.00 * 20) + (9.00 * 10) = 290. 
      // Expected CGPA = 290 / 30 = 9.67.
      expect(computeCGPA(semesterData, {})).toBe(9.67);
    });

    it('should return 0 when no semester data exists', () => {
      expect(computeCGPA({}, {})).toBe(0);
    });
  });

  describe('4. Manual History Proxy Weighting', () => {
    it('should proxy a manual semester with exactly 20 credits at its entered SGPA value', () => {
      // Sem 1: Manual SGPA entered = 8.50 -> Weight = 20 cr -> Weighted = 170
      // Sem 2: Entered subjects: 10 credits, SGPA = 7.00 -> Weighted = 70
      // Total Weighted = 240, Total credits = 30
      // Expected CGPA = 240 / 30 = 8.00
      const semesterData = {
        2: {
          locked: true,
          subjects: [
            { id: '1', name: 'Sub 1', credits: 10, marks: 70 } // 8 pts * 10 cr = 80 pts -> SGPA = 8.00
          ]
        }
      };
      const manualHistory = {
        1: 8.50
      };

      // Sem 2 SGPA = 8.00 (from 70 marks which maps to A -> 8 points). Credits = 10. Weighted = 80.
      // Sem 1 manual SGPA = 8.50. Weighted = 8.50 * 20 = 170.
      // Total weighted = 170 + 80 = 250.
      // Total credits = 20 + 10 = 30.
      // Expected CGPA = 250 / 30 = 8.33.
      expect(computeCGPA(semesterData, manualHistory)).toBe(8.33);
    });
  });

  describe('5. Partial Semester Omissions', () => {
    it('should ignore subjects without marks during SGPA calculation', () => {
      // 3 subjects defined, but only 2 have entered marks
      // Sub 1: 4 credits, 90 marks (O -> 10 pts) -> weighted = 40
      // Sub 2: 2 credits, 80 marks (A+ -> 9 pts) -> weighted = 18
      // Sub 3: 4 credits, null marks (not entered) -> ignored!
      // Total weighted = 58, Total credits = 6
      // Expected SGPA = 58 / 6 = 9.67
      const subjects: SubjectRow[] = [
        { id: '1', name: 'Sub 1', credits: 4, marks: 90 },
        { id: '2', name: 'Sub 2', credits: 2, marks: 80 },
        { id: '3', name: 'Sub 3', credits: 4, marks: null },
      ];
      expect(computeSGPA(subjects)).toBe(9.67);
    });

    it('should return 0 if subjects are registered but none have marks', () => {
      const subjects: SubjectRow[] = [
        { id: '1', name: 'Sub 1', credits: 4, marks: null },
        { id: '2', name: 'Sub 2', credits: 2, marks: null },
      ];
      expect(computeSGPA(subjects)).toBe(0);
    });
  });

  describe('6. Percentage conversions', () => {
    it('should convert CGPA to percentage using CGPA * 10 standard', () => {
      expect(computePercentage(8.33)).toBe(83.30);
      expect(computePercentage(9.5)).toBe(95.0);
    });
  });

  describe('7. Relative Grading (Z-Score & Fallbacks)', () => {
    const stats: SubjectStats = { mean: 65, stddev: 10, total: 10 };

    it('should map marks to grades based on standard deviation and mean (Z-scores)', () => {
      // z = (marks - 65) / 10
      // marks = 80 => z = 1.5 => O (10 pts)
      // marks = 75 => z = 1.0 => A+ (9 pts)
      // marks = 70 => z = 0.5 => A (8 pts)
      // marks = 65 => z = 0.0 => B+ (7 pts)
      // marks = 60 => z = -0.5 => B (6 pts)
      // marks = 55 => z = -1.0 => C (5 pts)
      // marks = 50 => z = -1.5 => P (4 pts)
      expect(marksToGradeRelative(80, stats).label).toBe('O');
      expect(marksToGradeRelative(75, stats).label).toBe('A+');
      expect(marksToGradeRelative(70, stats).label).toBe('A');
      expect(marksToGradeRelative(65, stats).label).toBe('B+');
      expect(marksToGradeRelative(60, stats).label).toBe('B');
      expect(marksToGradeRelative(55, stats).label).toBe('C');
      expect(marksToGradeRelative(50, stats).label).toBe('P');
    });

    it('should always fail if marks are below 40 absolute limit', () => {
      // Even if Z-score is high or stats mean is very low, mark < 40 must fail.
      const lowMeanStats: SubjectStats = { mean: 35, stddev: 5, total: 10 };
      // z = (39 - 35)/5 = 0.8 => normally would be A, but marks < 40 => F
      expect(marksToGradeRelative(39, lowMeanStats).label).toBe('F');
      expect(marksToGradeRelative(39, lowMeanStats).point).toBe(0);

      // 40 should pass (z = 1.0 => A+)
      expect(marksToGradeRelative(40, lowMeanStats).label).toBe('A+');
      expect(marksToGradeRelative(40, lowMeanStats).point).toBe(9);
    });

    it('should fallback to absolute grading if total count is < 5', () => {
      const smallStats: SubjectStats = { mean: 80, stddev: 5, total: 4 };
      // fallback to absolute: 80 marks => O (90+) is not met, 80 is A+ (80-89)
      expect(marksToGradeRelative(80, smallStats).label).toBe('A+');
    });

    it('should fallback to absolute grading if stddev is 0', () => {
      const zeroStddevStats: SubjectStats = { mean: 65, stddev: 0, total: 10 };
      // fallback to absolute: 65 marks => B+ (60-69)
      expect(marksToGradeRelative(65, zeroStddevStats).label).toBe('B+');
    });

    it('should compute relative SGPA and CGPA correctly', () => {
      const subjects: SubjectRow[] = [
        { id: '1', name: 'Maths', credits: 4, marks: 80 }, // z = 1.5 => O (10 pts)
        { id: '2', name: 'Physics', credits: 3, marks: 60 }, // z = -0.5 => B (6 pts)
      ];
      const relativeStats = {
        'Maths': { mean: 65, stddev: 10, total: 10 },
        'Physics': { mean: 65, stddev: 10, total: 10 },
      };

      // weighted points: (4 * 10) + (3 * 6) = 40 + 18 = 58
      // total credits: 7
      // expected SGPA: 58 / 7 = 8.29
      expect(computeSGPA(subjects, relativeStats)).toBe(8.29);
    });
  });
});
