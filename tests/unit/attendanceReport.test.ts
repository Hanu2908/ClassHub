import { describe, it, expect } from 'vitest';
import {
  generateWhatsAppAttendanceReport,
  generateAttendanceCSV,
  sortReportStudents,
  type ReportStudent,
  type AttendanceReportInput,
} from '../../src/lib/utils/attendanceReport';

describe('TDD Seam 1: Report Student Roll Sorting', () => {
  const mockStudents: ReportStudent[] = [
    { id: '3', name: 'Charlie', classRoll: 'P-12', status: 'absent', subBatch: '1' },
    { id: '1', name: 'Alice', classRoll: 'P-02', status: 'present', subBatch: '1' },
    { id: '2', name: 'Bob', classRoll: 'P-05', status: 'od', subBatch: '2' },
    { id: '4', name: 'David', classRoll: 'P-18', status: 'absent', subBatch: '2' },
  ];

  it('sorts students ascending by roll number with fallback to name', () => {
    const sorted = sortReportStudents(mockStudents);
    expect(sorted.map(s => s.name)).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
  });
});

describe('TDD Seam 2: WhatsApp Plain-Text Report Formatting', () => {
  it('generates structured WhatsApp report for full section', () => {
    const mockInput: AttendanceReportInput = {
      sectionName: 'Section P2',
      subjectCode: 'CS-101',
      subjectName: 'Computer Programming',
      date: '2026-07-31',
      lectureCount: 1,
      targetBatch: 'all',
      teacherName: 'Prof. Sharma',
      students: [
        { id: '1', name: 'Alice', classRoll: 'P-02', status: 'present', subBatch: '1' },
        { id: '2', name: 'Bob', classRoll: 'P-05', status: 'od', subBatch: '2' },
        { id: '3', name: 'Charlie', classRoll: 'P-12', status: 'absent', subBatch: '1' },
        { id: '4', name: 'David', classRoll: 'P-18', status: 'absent', subBatch: '2' },
      ],
    };

    const report = generateWhatsAppAttendanceReport(mockInput);

    expect(report).toContain('CLASS ATTENDANCE REPORT');
    expect(report).toContain('Section P2');
    expect(report).toContain('CS-101 — Computer Programming');
    expect(report).toContain('Prof. Sharma');
    expect(report).toContain('1 / 4 Present (25.0%)');
    expect(report).toContain('ABSENTEES (2)');
    expect(report).toContain('1. Roll P-12 — Charlie');
    expect(report).toContain('2. Roll P-18 — David');
    expect(report).toContain('ON-DUTY (OD) (1)');
    expect(report).toContain('Roll P-05 — Bob');
  });

  it('formats batch-scoped pre-save draft report correctly', () => {
    const draftInput: AttendanceReportInput = {
      sectionName: 'P2',
      subjectCode: 'EC-201',
      subjectName: 'Digital Electronics',
      date: '2026-07-31',
      lectureCount: 2,
      targetBatch: '1',
      students: [
        { id: '1', name: 'Alice', classRoll: 'P-01', status: 'present', subBatch: '1' },
        { id: '2', name: 'Charlie', classRoll: 'P-03', status: 'absent', subBatch: '1' },
      ],
    };

    const report = generateWhatsAppAttendanceReport(draftInput);

    expect(report).toContain('EC-201 — Digital Electronics');
    expect(report).toContain('Batch 1');
    expect(report).toContain('1 / 2 Present (50.0%)');
    expect(report).toContain('1. Roll P-03 — Charlie');
  });

  it('handles 100% attendance scenario gracefully', () => {
    const perfectInput: AttendanceReportInput = {
      sectionName: 'P2',
      subjectCode: 'MA-101',
      subjectName: 'Engineering Mathematics',
      date: '2026-07-31',
      lectureCount: 1,
      targetBatch: 'all',
      students: [
        { id: '1', name: 'Alice', classRoll: 'P-01', status: 'present', subBatch: '1' },
        { id: '2', name: 'Bob', classRoll: 'P-02', status: 'present', subBatch: '2' },
      ],
    };

    const report = generateWhatsAppAttendanceReport(perfectInput);

    expect(report).toContain('2 / 2 Present (100.0%)');
    expect(report).toContain('🎉 None! 100% Attendance!');
  });
});

describe('TDD Seam 3: CSV Spreadsheet Export Formatting', () => {
  it('generates valid CSV format string with header and data rows', () => {
    const mockInput: AttendanceReportInput = {
      sectionName: 'Section P2',
      subjectCode: 'CS-101',
      subjectName: 'Computer Programming',
      date: '2026-07-31',
      lectureCount: 1,
      targetBatch: 'all',
      students: [
        { id: '1', name: 'Alice', classRoll: 'P-02', status: 'present', subBatch: '1', universityRoll: '24ESKCS001' },
        { id: '3', name: 'Charlie', classRoll: 'P-12', status: 'absent', subBatch: '1', universityRoll: '24ESKCS003' },
      ],
    };

    const csv = generateAttendanceCSV(mockInput);

    expect(csv).toContain('"ClassHub Attendance Register Export"');
    expect(csv).toContain('"Subject Code","CS-101"');
    expect(csv).toContain('"Roll No","Student Name","Status","Sub-Batch"');
    expect(csv).toContain('"P-02","Alice","PRESENT","Batch 1","24ESKCS001"');
    expect(csv).toContain('"P-12","Charlie","ABSENT","Batch 1","24ESKCS003"');
  });
});
