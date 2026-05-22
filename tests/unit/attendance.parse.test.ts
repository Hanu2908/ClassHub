import { describe, expect, it } from 'vitest';
import { parseERPAttendance } from '../../src/lib/utils/attendance';

describe('parseERPAttendance edge cases', () => {
  it('parses tab-separated rows', () => {
    const rows = parseERPAttendance('1\tDBMS201\tDatabase Management Systems\tLecture\t24\t0\t1\t5\t83.33');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 
      code: 'DBMS201', 
      name: 'Database Management Systems', 
      type: 'Lecture', 
      present: 24, 
      makeup: 1, 
      absent: 5, 
      percentage: 86.21,
      total: 29, // present(24) + od(0) + absent(5) = 29 (makeup excluded)
      canSkip: 4 // (25 attended - 0.75 * 29) / 0.75 = (25 - 21.75) / 0.75 = 3.25 / 0.75 = 4.33 -> 4
    });
  });

  it('parses single-space separated rows', () => {
    const rows = parseERPAttendance('1 DBMS201 Database Management Systems Lecture 24 0 1 5 83.33');
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe('DBMS201');
    expect(rows[0].total).toBe(29);
    expect(rows[0].canSkip).toBe(4);
  });

  it('ignores invalid lines and parses valid ones', () => {
    const rows = parseERPAttendance('Not a valid row\n1 DBMS201 Database Management Systems Lecture 24 0 1 5 83.33');
    expect(rows).toHaveLength(1);
  });
});
