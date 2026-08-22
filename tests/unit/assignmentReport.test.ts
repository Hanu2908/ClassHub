import { describe, expect, it } from 'vitest';
import {
  generatePendingAssignmentReport,
  sortPendingStudents,
  type PendingAssignmentReportInput,
} from '../../src/lib/utils/assignmentReport';

describe('assignmentReport utilities (TDD)', () => {
  const sampleStudents = [
    { id: '1', name: 'Deepak Verma', classRoll: 'P-19' },
    { id: '2', name: 'Ankit Sharma', classRoll: 'P-04' },
    { id: '3', name: 'Bhavya Gupta', classRoll: 'P-12' },
    { id: '4', name: 'Zoya Khan', classRoll: null },
  ];

  it('sorts pending students ascending by roll number with unrolled students at end', () => {
    const sorted = sortPendingStudents(sampleStudents);
    expect(sorted[0].classRoll).toBe('P-04');
    expect(sorted[1].classRoll).toBe('P-12');
    expect(sorted[2].classRoll).toBe('P-19');
    expect(sorted[3].name).toBe('Zoya Khan');
  });

  it('generates a clean, simplified pending report with subject, deadline warning, and student list', () => {
    const input: PendingAssignmentReportInput = {
      sectionName: 'P2',
      subjectCode: 'ITUL301',
      subjectName: 'Data Structures and Algorithms',
      assignmentTitle: 'Assignment 2: Binary Trees',
      dueDate: '2026-08-25T23:59:00',
      totalStudents: 60,
      submittedCount: 45,
      pendingStudents: sampleStudents,
    };

    const report = generatePendingAssignmentReport(input);

    // Verify key sections exist in the simplified format
    expect(report).toContain('*PENDING ASSIGNMENT REMINDER*');
    expect(report).toContain('*Subject:* ITUL301 — Data Structures and Algorithms');
    expect(report).toContain('*Assignment:* Assignment 2: Binary Trees');
    expect(report).toContain('*Deadline:*');
    expect(report).toContain('*Pending Students (4 / 60):*');
    expect(report).toContain('1. Roll P-04 — Ankit Sharma');
    expect(report).toContain('2. Roll P-12 — Bhavya Gupta');
    expect(report).toContain('3. Roll P-19 — Deepak Verma');
    expect(report).toContain('4. Student #4 — Zoya Khan');
    expect(report).toContain('Submit your assignment ASAP!');
    expect(report).toContain('— Sent via ClassHub');
  });

  it('handles empty pending list gracefully with celebration message', () => {
    const input: PendingAssignmentReportInput = {
      sectionName: 'P2',
      subjectCode: 'ITUL301',
      subjectName: 'DSA',
      assignmentTitle: 'Assignment 1',
      dueDate: '2026-08-25T23:59:00',
      totalStudents: 60,
      submittedCount: 60,
      pendingStudents: [],
    };

    const report = generatePendingAssignmentReport(input);
    expect(report).toContain('ALL ASSIGNMENTS SUBMITTED');
    expect(report).toContain('All 60 students have submitted!');
  });
});
