/**
 * attendancePrediction.ts
 *
 * Pure TypeScript prediction engine for connecting schedule timetable
 * data with attendance records. No React dependencies.
 *
 * Provides: per-subject recovery predictions, overall recovery date,
 * smart skip advisor, and schedule-attendance data linkage.
 */

import { ACADEMIC_HOLIDAYS, ACADEMIC_BREAKS } from '../curriculumData';
import type { AttendanceSubject, ScheduleMap, ScheduleSlot } from '../../store/appStore';

// ── Types ────────────────────────────────────────────────────────────────────

export type SubjectPrediction = {
  code: string;
  name: string;
  currentPct: number;
  present: number;
  total: number;
  neededClasses: number;
  predictedDate: string | null;
  predictedDays: number | null;
  weeklyFrequency: number;
  scheduledDays: string[];
};

export type SkipAdvice = {
  code: string;
  name: string;
  currentPct: number;
  canSkip: number;
  projectedPctAfterSkip: number;
  riskLevel: 'safe' | 'warning' | 'critical';
  nextScheduledDay: string;
  nextScheduledTime: string;
};

export type OverallPrediction = {
  predictedDate: string | null;
  predictedDays: number | null;
  isAlreadyAbove: boolean;
  message: string;
};

export type LinkedSubject = AttendanceSubject & {
  weeklySlotCount: number;
  scheduledDays: string[];
  /** Slot details for each scheduled occurrence */
  slots: Array<{ day: string; startTime: string; endTime: string }>;
};

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ── Holiday / Break Calendar ─────────────────────────────────────────────────

/**
 * Checks if a given date is a Sunday, academic holiday, or falls within
 * an academic break period. Uses centralized holiday data from curriculumData.
 */
export function isHolidayOrSunday(date: Date): boolean {
  if (date.getDay() === 0) return true;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  if (ACADEMIC_HOLIDAYS.includes(dateStr)) return true;

  for (const b of ACADEMIC_BREAKS) {
    const breakStart = new Date(yyyy, b.startMonth, b.startDay);
    const breakEnd = new Date(yyyy, b.endMonth, b.endDay);
    if (date >= breakStart && date <= breakEnd) return true;
  }

  return false;
}

// ── Data Linkage ─────────────────────────────────────────────────────────────

/**
 * Links attendance records to timetable slots.
 *
 * Strategy: subject_id match first (canonical), code match fallback.
 * Returns attendance subjects enriched with weekly schedule information.
 */
export function linkAttendanceToSchedule(
  subjects: AttendanceSubject[],
  scheduleMap: ScheduleMap
): LinkedSubject[] {
  // Build a flat list of all schedule slots with their day
  const allSlots: Array<ScheduleSlot & { dayName: string }> = [];
  for (const day of SCHEDULE_DAYS) {
    const slots = scheduleMap[day] ?? [];
    for (const slot of slots) {
      allSlots.push({ ...slot, dayName: day });
    }
  }

  return subjects.map(sub => {
    // Match by code (case-insensitive, trimmed)
    const subCodeLower = sub.code.toLowerCase().trim();
    const matchingSlots = allSlots.filter(slot => {
      // Primary: code match
      if (slot.code.toLowerCase().trim() === subCodeLower) return true;
      return false;
    });

    const scheduledDays = [...new Set(matchingSlots.map(s => s.dayName))];
    const slotDetails = matchingSlots.map(s => ({
      day: s.dayName,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    return {
      ...sub,
      weeklySlotCount: matchingSlots.length,
      scheduledDays,
      slots: slotDetails,
    };
  });
}

// ── Subject Schedule Frequency ───────────────────────────────────────────────

/**
 * Returns per-day frequency for a specific subject code within the schedule.
 */
export function getSubjectScheduleFrequency(
  subjectCode: string,
  scheduleMap: ScheduleMap
): Record<string, number> {
  const codeLower = subjectCode.toLowerCase().trim();
  const freq: Record<string, number> = {};

  for (const day of SCHEDULE_DAYS) {
    const slots = scheduleMap[day] ?? [];
    const count = slots.filter(s => s.code.toLowerCase().trim() === codeLower).length;
    if (count > 0) freq[day] = count;
  }

  return freq;
}

// ── Overall Recovery Prediction ──────────────────────────────────────────────

const DAY_ABBR_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Predicts the date when overall attendance will reach 75%.
 *
 * Walks the calendar day-by-day from today, skipping holidays/Sundays,
 * subtracting classes-per-day from the "needed" count. Uses schedule slot
 * counts if available, falls back to manual overrides.
 *
 * When `dayOfWeekRates` is provided (from class-level ERP insights),
 * multiplies each day's expected classes by the student's actual attendance
 * rate for that day. This gives a realistic prediction instead of assuming
 * the student will attend every future class.
 */
export function predictOverallRecoveryDate(
  overallAttended: number,
  overallTotal: number,
  scheduleOverrides: Record<string, number>,
  dayOfWeekRates?: Record<string, number>
): OverallPrediction {
  const currentPct = overallTotal > 0 ? (overallAttended / overallTotal) * 100 : 0;

  if (currentPct >= 75) {
    return {
      predictedDate: null,
      predictedDays: 0,
      isAlreadyAbove: true,
      message: "Relax! You are already above 75%. Enjoy your life! 😎",
    };
  }

  let needed = Math.ceil((0.75 * overallTotal - overallAttended) / 0.25);
  let daysPassed = 0;
  const cursor = new Date();

  const dailySlots = [
    0, // Sun
    scheduleOverrides.Mon || 0,
    scheduleOverrides.Tue || 0,
    scheduleOverrides.Wed || 0,
    scheduleOverrides.Thu || 0,
    scheduleOverrides.Fri || 0,
    scheduleOverrides.Sat || 0,
  ];

  while (needed > 0) {
    cursor.setDate(cursor.getDate() + 1);
    daysPassed++;
    if (isHolidayOrSunday(cursor)) continue;

    const classesToday = dailySlots[cursor.getDay()] || 0;
    // When dayOfWeekRates is available, use the student's actual attendance
    // rate for this day. Otherwise assume 100% (existing behavior).
    const dayName = DAY_ABBR_MAP[cursor.getDay()];
    const attendRate = dayOfWeekRates?.[dayName] ?? 1.0;
    needed -= Math.round(classesToday * attendRate);

    if (daysPassed > 365) {
      return {
        predictedDate: null,
        predictedDays: null,
        isAlreadyAbove: false,
        message: "Timetable slots are blank or 75% target is too far.",
      };
    }
  }

  const dateString = cursor.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return {
    predictedDate: dateString,
    predictedDays: daysPassed,
    isAlreadyAbove: false,
    message: dateString,
  };
}

// ── Per-Subject Recovery Prediction ──────────────────────────────────────────

/**
 * For a single subject below 75%, walks the calendar counting only that
 * subject's scheduled slots, and returns when 75% would be reached.
 */
export function predictSubjectRecoveryDate(
  subject: LinkedSubject
): SubjectPrediction {
  const base: SubjectPrediction = {
    code: subject.code,
    name: subject.name,
    currentPct: subject.percentage,
    present: subject.present,
    total: subject.total,
    neededClasses: subject.needToAttend,
    predictedDate: null,
    predictedDays: null,
    weeklyFrequency: subject.weeklySlotCount,
    scheduledDays: subject.scheduledDays,
  };

  // Already above 75%
  if (subject.percentage >= 75) {
    return base;
  }

  // No scheduled slots — can't predict
  if (subject.weeklySlotCount === 0) {
    return base;
  }

  // Build per-day slot count for this subject
  const daySlotCount: Record<string, number> = {};
  for (const slot of subject.slots) {
    daySlotCount[slot.day] = (daySlotCount[slot.day] || 0) + 1;
  }

  let needed = subject.needToAttend;
  let daysPassed = 0;
  const cursor = new Date();

  while (needed > 0) {
    cursor.setDate(cursor.getDate() + 1);
    daysPassed++;
    if (isHolidayOrSunday(cursor)) continue;

    const dayName = DAY_NAMES[cursor.getDay()];
    const slotsToday = daySlotCount[dayName] || 0;
    needed -= slotsToday;

    if (daysPassed > 365) {
      return base;
    }
  }

  const dateString = cursor.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return {
    ...base,
    predictedDate: dateString,
    predictedDays: daysPassed,
  };
}

// ── Smart Skip Advisor ───────────────────────────────────────────────────────

/**
 * Returns all subjects ranked by "skip safety" — how many classes
 * of each subject you can safely skip while staying ≥75%.
 *
 * Sorted: most skippable first (safest subjects at top).
 */
export function getSmartSkipAdvice(
  subjects: AttendanceSubject[],
  scheduleMap: ScheduleMap
): SkipAdvice[] {
  const linked = linkAttendanceToSchedule(subjects, scheduleMap);

  const advice: SkipAdvice[] = linked
    .filter(sub => sub.total > 0) // skip subjects with no attendance data
    .map(sub => {
      const canSkip = sub.canSkip;

      // Projected percentage if you skip exactly `canSkip` classes
      const projectedTotal = sub.total + canSkip;
      const projectedPct = projectedTotal > 0
        ? (sub.present / projectedTotal) * 100
        : 0;

      // Risk assessment
      let riskLevel: SkipAdvice['riskLevel'];
      if (sub.percentage >= 85) {
        riskLevel = 'safe';
      } else if (sub.percentage >= 75) {
        riskLevel = canSkip > 2 ? 'warning' : 'critical';
      } else {
        riskLevel = 'critical';
      }

      // Find next scheduled occurrence
      const todayDayIndex = new Date().getDay();
      let nextDay = '';
      let nextTime = '';

      // Look ahead from today through the week
      for (let offset = 0; offset < 7; offset++) {
        const checkDayIndex = (todayDayIndex + offset) % 7;
        const dayName = DAY_NAMES[checkDayIndex];
        const slotsForDay = (scheduleMap[dayName] ?? [])
          .filter(s => s.code.toLowerCase().trim() === sub.code.toLowerCase().trim())
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (slotsForDay.length > 0) {
          // If today, only count slots that haven't started yet
          if (offset === 0) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const futureSlots = slotsForDay.filter(s => {
              const [h, m] = s.startTime.split(':').map(Number);
              return h * 60 + m > nowMinutes;
            });
            if (futureSlots.length > 0) {
              nextDay = dayName;
              nextTime = futureSlots[0].startTime;
              break;
            }
          } else {
            nextDay = dayName;
            nextTime = slotsForDay[0].startTime;
            break;
          }
        }
      }

      return {
        code: sub.code,
        name: sub.name,
        currentPct: sub.percentage,
        canSkip: Math.max(0, canSkip),
        projectedPctAfterSkip: Number(projectedPct.toFixed(2)),
        riskLevel,
        nextScheduledDay: nextDay,
        nextScheduledTime: nextTime,
      };
    });

  // Sort: most skippable (safest) first, then by percentage descending
  advice.sort((a, b) => {
    if (a.canSkip !== b.canSkip) return b.canSkip - a.canSkip;
    return b.currentPct - a.currentPct;
  });

  return advice;
}
