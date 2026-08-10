import { describe, expect, it } from 'vitest';
import {
  parseERPClassLog,
  computeAggregatesFromClassLog,
  computeInsightsFromClassLog,
  getOverallDayOfWeekRates,
} from '../../src/lib/utils/attendance';

const SAMPLE_CLASS_LOG = `
#	Subject Code	Subject	Subject Type	Faculty Name	Date	Starting Time	Number of Hours	Marked
1	ITUL302	Operating System	Lecture	Manju Choudhary	2026-08-10 (Monday)	12:00 PM	1	P
2	ITUP321	Programming in Java Lab	Lab	Manoj Raman	2026-08-10 (Monday)	8:15 AM	3	P
3	ITUT330	Industrial Training	Lab	Hari Mohan Singh	2026-08-08 (Saturday)	12:00 PM	1	A
4	NU99.5	Soft Skills Training	Lab	Raunak Goswami	2026-08-08 (Saturday)	10:15 AM	1	A
5	MAUL301	Statistics and Probability Theory	Lecture	Shalini Shekhawat	2026-08-08 (Saturday)	9:15 AM	1	A
6	ITUL303	Software Engineering and Project Management	Lecture	Anil Chaudhary	2026-08-08 (Saturday)	8:15 AM	1	A
`;

describe('parseERPClassLog & insights', () => {
  it('parses individual class log entries', () => {
    const entries = parseERPClassLog(SAMPLE_CLASS_LOG);
    expect(entries).not.toBeNull();
    expect(entries).toHaveLength(6);
    expect(entries![0]).toMatchObject({
      code: 'ITUL302',
      name: 'Operating System',
      subjectType: 'Lecture',
      date: '2026-08-10',
      dayOfWeek: 'Mon',
      startTime: '12:00 PM',
      numHours: 1,
      status: 'P',
    });
    expect(entries![1]).toMatchObject({
      code: 'ITUP321',
      numHours: 3,
      status: 'P',
    });
  });

  it('returns null for non-class-log text (fallback trigger)', () => {
    const nullResult = parseERPClassLog('1 ITUL302 Operating System Lecture 13 0 0 0 100.00');
    expect(nullResult).toBeNull();
  });

  it('computes accurate aggregates from class log entries (accounting for lab hours)', () => {
    const entries = parseERPClassLog(SAMPLE_CLASS_LOG)!;
    const aggs = computeAggregatesFromClassLog(entries);
    const javaLab = aggs.find(a => a.code === 'ITUP321');
    expect(javaLab).toBeDefined();
    expect(javaLab!.present).toBe(3); // 3-hour lab
    expect(javaLab!.absent).toBe(0);

    const softSkills = aggs.find(a => a.code === 'NU99.5');
    expect(softSkills!.absent).toBe(1);
  });

  it('computes insights (day-of-week rates, streaks, absences)', () => {
    const entries = parseERPClassLog(SAMPLE_CLASS_LOG)!;
    const insightsMap = computeInsightsFromClassLog(entries);
    const osInsights = insightsMap.get('ITUL302')!;

    expect(osInsights).toBeDefined();
    expect(osInsights.totalClasses).toBe(1);
    expect(osInsights.currentStreak).toBe(1);
    expect(osInsights.dayOfWeekRates['Mon']).toEqual({ attended: 1, total: 1, rate: 1.0 });

    const overallRates = getOverallDayOfWeekRates(insightsMap);
    expect(overallRates['Mon']).toBe(1.0);
    expect(overallRates['Sat']).toBe(0); // All Saturday classes in sample were absent
  });
});
