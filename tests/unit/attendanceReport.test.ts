import { describe, it, expect } from 'vitest';
import {
  generateWhatsAppAttendanceReport,
  generateAttendanceCSV,
  sortReportStudents,
  type ReportStudent,
  type AttendanceReportInput,
} from '../../src/lib/utils/attendanceReport';

describe('Attendance Report Formatter Utility', () => {
  const mockStudents: ReportStudent[] = [
    { id: '3', name: 'Charlie', classRoll: 'P-12', status: 'absent', subBatch: '1' },
    { id: '1', name: 'Alice', classRoll: 'P-02', status: 'present', subBatch: '1' },
    { id: '2', name: 'Bob', classRoll: 'P-05', status: 'od', subBatch: '2' },
    { id: '4', name: 'David', classRoll: 'P-18', status: 'absent', subBatch: '2' },
  ];

  const mockInput: AttendanceReportInput = {
    sectionName: 'Section P2',
    subjectCode: 'CS-101',
    subjectName: 'Computer Programming',
    date: '2026-07-31',
    lectureCount: 1,
    targetBatch: 'all',
    teacherName: 'Prof. Sharma',
    students: mockStudents,
  };

  it('sorts students ascending by roll number', () => {
    const sorted = sortReportStudents(mockStudents);
    expect(sorted.map(s => s.name)).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
  });

  it('generates structured WhatsApp report string', () => {
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

  it('generates valid CSV format string', () => {
    const csv = generateAttendanceCSV(mockInput);

    expect(csv).toContain('"ClassHub Attendance Register Export"');
    expect(csv).toContain('"Subject Code","CS-101"');
    expect(csv).toContain('"Roll No","Student Name","Status","Sub-Batch"');
    expect(csv).toContain('"P-02","Alice","PRESENT"');
    expect(csv).toContain('"P-12","Charlie","ABSENT"');
    expect(csv).toContain('"P-05","Bob","OD"');
  });
});
