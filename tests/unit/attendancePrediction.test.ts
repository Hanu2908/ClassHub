import { describe, expect, it } from 'vitest';
import {
  isHolidayOrSunday,
  linkAttendanceToSchedule,
  getSubjectScheduleFrequency,
  predictOverallRecoveryDate,
  predictSubjectRecoveryDate,
  getSmartSkipAdvice,
  type LinkedSubject,
} from '../../src/lib/utils/attendancePrediction';
import type { AttendanceSubject, ScheduleMap } from '../../src/store/appStore';

describe('attendancePrediction — Holiday & Calendar Checks', () => {
  it('identifies Sunday as non-college day', () => {
    // 2026-08-23 is a Sunday
    const sunday = new Date(2026, 7, 23);
    expect(isHolidayOrSunday(sunday)).toBe(true);
  });

  it('identifies regular weekday as a college day', () => {
    // 2026-08-24 is a Monday (not a holiday in curriculumData)
    const monday = new Date(2026, 7, 24);
    expect(isHolidayOrSunday(monday)).toBe(false);
  });

  it('identifies gazetted academic holidays', () => {
    // Independence Day: 2026-08-15
    const independenceDay = new Date(2026, 7, 15);
    expect(isHolidayOrSunday(independenceDay)).toBe(true);

    // Janmashtami / Holiday: 2026-08-28
    const augHoliday = new Date(2026, 7, 28);
    expect(isHolidayOrSunday(augHoliday)).toBe(true);
  });

  it('identifies dates during academic breaks (e.g. Diwali break in November)', () => {
    // Diwali break 2026-11-08 to 2026-11-14
    const breakDay = new Date(2026, 10, 10);
    expect(isHolidayOrSunday(breakDay)).toBe(true);
  });
});

describe('attendancePrediction — Timetable Linkage', () => {
  const sampleSubjects: AttendanceSubject[] = [
    {
      code: 'ITUL301',
      name: 'Data Structures and Algorithms',
      type: 'Lecture',
      present: 21,
      absent: 3,
      total: 24,
      percentage: 87.5,
      canSkip: 4,
      needToAttend: 0,
    },
    {
      code: 'ITUP320',
      name: 'DSA Lab',
      type: 'Lab',
      present: 18,
      absent: 0,
      total: 18,
      percentage: 100,
      canSkip: 6,
      needToAttend: 0,
    },
  ];

  const sampleSchedule: ScheduleMap = {
    Mon: [
      { id: '1', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
    ],
    Tue: [
      { id: '2', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
    ],
    Wed: [
      { id: '3', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
    ],
    Thu: [
      { id: '4', code: 'ITUP320', name: 'DSA Lab', teacher: 'AM', room: 'Lab 1', startTime: '12:00', endTime: '14:30', subjectType: 'Lab' },
      { id: '5', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '10:15', endTime: '11:15', subjectType: 'Lecture' },
    ],
    Fri: [
      { id: '6', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
    ],
    Sat: [],
  };

  it('links attendance subjects to timetable slots case-insensitively', () => {
    const linked = linkAttendanceToSchedule(sampleSubjects, sampleSchedule);
    expect(linked).toHaveLength(2);

    const dsa = linked.find(s => s.code === 'ITUL301')!;
    expect(dsa.weeklySlotCount).toBe(5);
    expect(dsa.scheduledDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(dsa.slots).toHaveLength(5);

    const dsaLab = linked.find(s => s.code === 'ITUP320')!;
    expect(dsaLab.weeklySlotCount).toBe(1);
    expect(dsaLab.scheduledDays).toEqual(['Thu']);
  });

  it('computes subject schedule frequency per day', () => {
    const freq = getSubjectScheduleFrequency('ITUL301', sampleSchedule);
    expect(freq).toEqual({
      Mon: 1,
      Tue: 1,
      Wed: 1,
      Thu: 1,
      Fri: 1,
    });
  });
});

describe('attendancePrediction — Overall Recovery Date Prediction', () => {
  it('returns immediately with isAlreadyAbove = true if overall attendance is >= 75%', () => {
    const result = predictOverallRecoveryDate(80, 100, { Mon: 5, Tue: 5, Wed: 5, Thu: 5, Fri: 5, Sat: 5 });
    expect(result.isAlreadyAbove).toBe(true);
    expect(result.predictedDate).toBeNull();
    expect(result.predictedDays).toBe(0);
    expect(result.message).toContain('already above 75%');
  });

  it('calculates recovery date when attendance is below 75%', () => {
    // 60 attended out of 100 (60%) -> needs ceil((0.75 * 100 - 60) / 0.25) = ceil(15 / 0.25) = 60 classes
    // At 5 classes/day (Mon-Sat), that takes 12 college days.
    const overrides = { Mon: 5, Tue: 5, Wed: 5, Thu: 5, Fri: 5, Sat: 5 };
    const result = predictOverallRecoveryDate(60, 100, overrides);

    expect(result.isAlreadyAbove).toBe(false);
    expect(result.predictedDate).not.toBeNull();
    expect(result.predictedDays).toBeGreaterThanOrEqual(12);
  });

  it('handles empty/zero timetable overrides gracefully without infinite loop', () => {
    const zeroOverrides = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const result = predictOverallRecoveryDate(50, 100, zeroOverrides);

    expect(result.isAlreadyAbove).toBe(false);
    expect(result.predictedDate).toBeNull();
    expect(result.message).toContain('Timetable slots are blank');
  });
});

describe('attendancePrediction — Per-Subject Recovery Prediction', () => {
  it('returns base info with predictedDate = null if subject is already >= 75%', () => {
    const subject: LinkedSubject = {
      code: 'ITUL301',
      name: 'DSA',
      type: 'Lecture',
      present: 21,
      absent: 3,
      total: 24,
      percentage: 87.5,
      canSkip: 4,
      needToAttend: 0,
      weeklySlotCount: 5,
      scheduledDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      slots: [
        { day: 'Mon', startTime: '08:15', endTime: '09:15' },
      ],
    };

    const pred = predictSubjectRecoveryDate(subject);
    expect(pred.predictedDate).toBeNull();
    expect(pred.neededClasses).toBe(0);
  });

  it('predicts recovery date for a single subject below 75% based on its scheduled slots', () => {
    // 10 attended out of 20 = 50%.
    // Needed to reach 75%: ceil((0.75 * 20 - 10) / 0.25) = ceil(5 / 0.25) = 20 classes
    // If subject meets Mon, Wed, Fri (3 slots/week), it will take ~7 weeks of classes.
    const lowSubject: LinkedSubject = {
      code: 'ITUL303',
      name: 'Software Engineering',
      type: 'Lecture',
      present: 10,
      absent: 10,
      total: 20,
      percentage: 50.0,
      canSkip: 0,
      needToAttend: 20,
      weeklySlotCount: 3,
      scheduledDays: ['Mon', 'Wed', 'Fri'],
      slots: [
        { day: 'Mon', startTime: '08:15', endTime: '09:15' },
        { day: 'Wed', startTime: '09:15', endTime: '10:15' },
        { day: 'Fri', startTime: '08:15', endTime: '09:15' },
      ],
    };

    const pred = predictSubjectRecoveryDate(lowSubject);
    expect(pred.predictedDate).not.toBeNull();
    expect(pred.neededClasses).toBe(20);
    expect(pred.predictedDays).toBeGreaterThanOrEqual(40);
  });
});

describe('attendancePrediction — Smart Skip Advisor', () => {
  const subjects: AttendanceSubject[] = [
    {
      code: 'HSUL302',
      name: 'Technical Communication',
      type: 'Lecture',
      present: 6,
      absent: 0,
      total: 6,
      percentage: 100.0,
      canSkip: 2, // (6 - 0.75*6)/0.75 = (6 - 4.5)/0.75 = 2
      needToAttend: 0,
    },
    {
      code: 'ITUL301',
      name: 'DSA',
      type: 'Lecture',
      present: 21,
      absent: 3,
      total: 24,
      percentage: 87.5,
      canSkip: 4, // (21 - 0.75*24)/0.75 = (21 - 18)/0.75 = 4
      needToAttend: 0,
    },
    {
      code: 'ITUL303',
      name: 'SEPM',
      type: 'Lecture',
      present: 12,
      absent: 4,
      total: 16,
      percentage: 75.0,
      canSkip: 0,
      needToAttend: 0,
    },
    {
      code: 'ITUP322',
      name: 'SE Lab',
      type: 'Lab',
      present: 12,
      absent: 6,
      total: 18,
      percentage: 66.67,
      canSkip: 0,
      needToAttend: 6,
    },
  ];

  const schedule: ScheduleMap = {
    Mon: [
      { id: '1', code: 'ITUL301', name: 'DSA', teacher: 'AM', room: '101', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
      { id: '2', code: 'HSUL302', name: 'TC', teacher: 'GP', room: '102', startTime: '12:00', endTime: '13:00', subjectType: 'Lecture' },
    ],
    Tue: [
      { id: '3', code: 'ITUL303', name: 'SEPM', teacher: 'AC', room: '103', startTime: '08:15', endTime: '09:15', subjectType: 'Lecture' },
    ],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
  };

  it('produces advice with mathematically verified projectedPctAfterSkip >= 75%', () => {
    const advice = getSmartSkipAdvice(subjects, schedule);
    expect(advice).toHaveLength(4);

    // Subject with canSkip = 4: DSA (21/24 = 87.5%)
    // After 4 skips: 21 / (24 + 4) = 21 / 28 = 75.00%
    const dsaAdvice = advice.find(a => a.code === 'ITUL301')!;
    expect(dsaAdvice.canSkip).toBe(4);
    expect(dsaAdvice.projectedPctAfterSkip).toBe(75);
    expect(dsaAdvice.riskLevel).toBe('safe'); // >= 85%

    // Subject with canSkip = 2: TC (6/6 = 100%)
    // After 2 skips: 6 / (6 + 2) = 6 / 8 = 75.00%
    const tcAdvice = advice.find(a => a.code === 'HSUL302')!;
    expect(tcAdvice.canSkip).toBe(2);
    expect(tcAdvice.projectedPctAfterSkip).toBe(75);
    expect(tcAdvice.riskLevel).toBe('safe');

    // Subject at 75% boundary (SEPM 12/16): canSkip = 0, warning/critical
    const sepmAdvice = advice.find(a => a.code === 'ITUL303')!;
    expect(sepmAdvice.canSkip).toBe(0);
    expect(sepmAdvice.riskLevel).toBe('critical');

    // Subject below 75% (SE Lab 12/18 = 66.67%): canSkip = 0, critical
    const seLabAdvice = advice.find(a => a.code === 'ITUP322')!;
    expect(seLabAdvice.canSkip).toBe(0);
    expect(seLabAdvice.riskLevel).toBe('critical');
  });

  it('sorts advice with safest (highest canSkip) subjects first', () => {
    const advice = getSmartSkipAdvice(subjects, schedule);
    expect(advice[0].code).toBe('ITUL301'); // canSkip = 4
    expect(advice[1].code).toBe('HSUL302'); // canSkip = 2
  });
});
