import { describe, it, expect } from 'vitest';
import { getRollNumber } from '../../src/hooks/useCRAttendance';

describe('CR Attendance Roll Sorting', () => {
  it('correctly parses roll numbers with different prefixes', () => {
    expect(getRollNumber('P-01')).toBe(1);
    expect(getRollNumber('P-15')).toBe(15);
    expect(getRollNumber('Roll 42')).toBe(42);
    expect(getRollNumber('102')).toBe(102);
  });

  it('handles null, undefined, or empty roll numbers gracefully', () => {
    expect(getRollNumber(null)).toBe(9999);
    expect(getRollNumber(undefined)).toBe(9999);
    expect(getRollNumber('')).toBe(9999);
  });

  it('sorts student roster correctly by class roll', () => {
    const students = [
      { name: 'Student C', classRoll: 'P-12' },
      { name: 'Student A', classRoll: 'P-02' },
      { name: 'Student B', classRoll: 'P-05' },
      { name: 'Student D', classRoll: null },
    ];

    const sorted = [...students].sort((a, b) => getRollNumber(a.classRoll) - getRollNumber(b.classRoll));

    expect(sorted.map(s => s.name)).toEqual(['Student A', 'Student B', 'Student C', 'Student D']);
  });
});
