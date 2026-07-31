import { describe, it, expect } from 'vitest';
import { getRollNumber, type RosterStudent, type CRAttendanceMarking } from '../../src/hooks/useCRAttendance';

// ── Pure helper functions representing the Seams ─────────────────────────────

export function filterRosterByBatch(
  roster: RosterStudent[],
  targetBatch: 'all' | '1' | '2'
): RosterStudent[] {
  if (targetBatch === 'all') return roster;
  return roster.filter(s => !s.subBatch || s.subBatch === targetBatch);
}

export function computeAttendanceCounts(
  targetStudents: RosterStudent[],
  markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'>
) {
  let present = 0;
  let absent = 0;
  let od = 0;
  let makeup = 0;

  targetStudents.forEach(s => {
    const st = markings[s.id] || 'present';
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else if (st === 'od') od++;
    else if (st === 'makeup') makeup++;
  });

  return { present, absent, od, makeup, total: targetStudents.length };
}

export function applyBatchAction(
  targetStudents: RosterStudent[],
  currentMarkings: Record<string, 'present' | 'absent' | 'od' | 'makeup'>,
  action: 'mark_all_present' | 'clear_absentees'
): Record<string, 'present' | 'absent' | 'od' | 'makeup'> {
  const updated = { ...currentMarkings };
  if (action === 'mark_all_present') {
    targetStudents.forEach(s => {
      updated[s.id] = 'present';
    });
  } else if (action === 'clear_absentees') {
    targetStudents.forEach(s => {
      if (updated[s.id] === 'absent') {
        updated[s.id] = 'present';
      }
    });
  }
  return updated;
}

export function buildCRAttendancePayload(params: {
  sessionId: string;
  sectionId: string;
  subjectId: string;
  date: string;
  lectureCount: number;
  targetBatch: 'all' | '1' | '2';
  targetStudents: RosterStudent[];
  markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'>;
}) {
  const markingsArray: CRAttendanceMarking[] = params.targetStudents.map(s => ({
    studentId: s.id,
    status: params.markings[s.id] || 'present',
  }));

  return {
    sessionId: params.sessionId,
    sectionId: params.sectionId,
    subjectId: params.subjectId,
    date: params.date,
    lectureCount: params.lectureCount,
    targetBatch: params.targetBatch === 'all' ? null : params.targetBatch,
    markings: markingsArray,
  };
}

// ── Tests Suite for Confirmed Seams ──────────────────────────────────────────

describe('Seam 1: Roll Number Parsing & Roster Sorting', () => {
  it('parses numeric roll values accurately from prefixed strings', () => {
    expect(getRollNumber('P-01')).toBe(1);
    expect(getRollNumber('P-24')).toBe(24);
    expect(getRollNumber('CS-101')).toBe(101);
  });

  it('handles null, undefined, and non-numeric inputs', () => {
    expect(getRollNumber(null)).toBe(9999);
    expect(getRollNumber(undefined)).toBe(9999);
    expect(getRollNumber('')).toBe(9999);
  });

  it('sorts roster ascending by roll number with fallback to name', () => {
    const mockRoster: RosterStudent[] = [
      { id: '3', name: 'Charlie', classRoll: 'P-12', universityRoll: null, subBatch: '1', avatarUrl: null },
      { id: '1', name: 'Alice', classRoll: 'P-02', universityRoll: null, subBatch: '1', avatarUrl: null },
      { id: '2', name: 'Bob', classRoll: 'P-05', universityRoll: null, subBatch: '2', avatarUrl: null },
    ];

    const sorted = [...mockRoster].sort((a, b) => getRollNumber(a.classRoll) - getRollNumber(b.classRoll));
    expect(sorted.map(s => s.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});

describe('Seam 2: Batch Scoping & Roster Filtering', () => {
  const mockRoster: RosterStudent[] = [
    { id: '1', name: 'Alice', classRoll: 'P-01', universityRoll: null, subBatch: '1', avatarUrl: null },
    { id: '2', name: 'Bob', classRoll: 'P-02', universityRoll: null, subBatch: '2', avatarUrl: null },
    { id: '3', name: 'Charlie', classRoll: 'P-03', universityRoll: null, subBatch: '1', avatarUrl: null },
  ];

  it('filters roster by Batch 1 correctly', () => {
    const batch1 = filterRosterByBatch(mockRoster, '1');
    expect(batch1.length).toBe(2);
    expect(batch1.map(s => s.name)).toEqual(['Alice', 'Charlie']);
  });

  it('filters roster by Batch 2 correctly', () => {
    const batch2 = filterRosterByBatch(mockRoster, '2');
    expect(batch2.length).toBe(1);
    expect(batch2[0].name).toBe('Bob');
  });

  it('returns all students when targetBatch is all', () => {
    const all = filterRosterByBatch(mockRoster, 'all');
    expect(all.length).toBe(3);
  });
});

describe('Seam 3: Attendance Summary Counter & Batch Actions', () => {
  const mockRoster: RosterStudent[] = [
    { id: '1', name: 'Alice', classRoll: 'P-01', universityRoll: null, subBatch: '1', avatarUrl: null },
    { id: '2', name: 'Bob', classRoll: 'P-02', universityRoll: null, subBatch: '1', avatarUrl: null },
    { id: '3', name: 'Charlie', classRoll: 'P-03', universityRoll: null, subBatch: '1', avatarUrl: null },
  ];

  it('computes attendance counters accurately', () => {
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {
      '1': 'present',
      '2': 'absent',
      '3': 'od',
    };

    const counts = computeAttendanceCounts(mockRoster, markings);
    expect(counts).toEqual({ present: 1, absent: 1, od: 1, makeup: 0, total: 3 });
  });

  it('applies mark_all_present action correctly', () => {
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {
      '1': 'absent',
      '2': 'absent',
      '3': 'od',
    };

    const updated = applyBatchAction(mockRoster, markings, 'mark_all_present');
    expect(updated['1']).toBe('present');
    expect(updated['2']).toBe('present');
    expect(updated['3']).toBe('present');
  });

  it('applies clear_absentees action while preserving OD status', () => {
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {
      '1': 'present',
      '2': 'absent',
      '3': 'od',
    };

    const updated = applyBatchAction(mockRoster, markings, 'clear_absentees');
    expect(updated['1']).toBe('present');
    expect(updated['2']).toBe('present');
    expect(updated['3']).toBe('od');
  });
});

describe('Seam 4: Session Payload Construction', () => {
  it('constructs valid LogCRAttendanceInput payload', () => {
    const mockRoster: RosterStudent[] = [
      { id: 's1', name: 'Alice', classRoll: 'P-01', universityRoll: null, subBatch: '1', avatarUrl: null },
      { id: 's2', name: 'Bob', classRoll: 'P-02', universityRoll: null, subBatch: '1', avatarUrl: null },
    ];

    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {
      's1': 'present',
      's2': 'absent',
    };

    const payload = buildCRAttendancePayload({
      sessionId: 'test-session-id',
      sectionId: 'sec-123',
      subjectId: 'sub-456',
      date: '2026-07-31',
      lectureCount: 2,
      targetBatch: '1',
      targetStudents: mockRoster,
      markings,
    });

    expect(payload).toEqual({
      sessionId: 'test-session-id',
      sectionId: 'sec-123',
      subjectId: 'sub-456',
      date: '2026-07-31',
      lectureCount: 2,
      targetBatch: '1',
      markings: [
        { studentId: 's1', status: 'present' },
        { studentId: 's2', status: 'absent' },
      ],
    });
  });
});
