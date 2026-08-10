export type AttendanceCalc = {
  percentage: number;
  needToAttend: number;
  canSkip: number;
};

export function calculateAttendance(total: number, attended: number): AttendanceCalc {
  const safeTotal = total <= 0 ? 0 : total;
  const pct = safeTotal === 0 ? 0 : (attended / safeTotal) * 100;
  const needToAttend = pct < 75 ? Math.ceil((0.75 * safeTotal - attended) / 0.25) : 0;
  const canSkip = pct >= 75 ? Math.floor((attended - 0.75 * safeTotal) / 0.75) : 0;
  return { percentage: Number(pct.toFixed(2)), needToAttend, canSkip };
}

export type ParsedSubject = {
  code: string;
  name: string;
  type: string;
  present: number;
  od?: number;
  makeup?: number;
  absent: number;
  total: number;
  percentage: number;
  canSkip: number;
  needToAttend: number;
};

export function parseERPAttendance(rawText: string): ParsedSubject[] {
  if (!rawText) return [];
  const lines = rawText.trim().split(/\r?\n/);
  const subjects: ParsedSubject[] = [];
  const TYPES = new Set(['Lecture', 'Tutorial', 'Lab', 'Practical', 'Laboratory', 'Tut']);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ERP tables are commonly copied as TSV (tab-separated) or as space-separated
    // rows. Split by tab first to preserve spaces inside subject names; otherwise
    // split on any whitespace and reconstruct fields below.
    const cols = trimmed.includes('\t')
      ? trimmed.split('\t').map(c => c.trim()).filter(Boolean)
      : trimmed.split(/\s+/).map(c => c.trim()).filter(Boolean);

    const typeColIdx = cols.findIndex(c => TYPES.has(c));
    if (typeColIdx < 0) continue;

    const numericCols = cols.slice(typeColIdx + 1);
    if (numericCols.length < 2) continue;
    if (numericCols.some(c => isNaN(Number(c)))) continue;

    const counts = numericCols.slice(0, -1).map(Number);

    // We'll preserve the raw "present" and "makeup" columns as reported by ERP
    // while using an internal `attendedTotal` (present + od + makeup) for recovery
    // calculations.
    let present: number;
    let od: number = 0;
    let makeup: number = 0;
    let absent: number;
    let total: number;
    let attendedTotal: number;

    if (counts.length >= 4) {
      const [pres, o, mk, ab] = counts;
      present = pres;
      od = o;
      makeup = mk;
      absent = ab;
      attendedTotal = pres + o + mk;
      total = pres + o + ab; // ERP formula: Present + OD + Absent (makeup excluded from total held)
    } else if (counts.length === 3) {
      const [pres, ab, tot] = counts;
      present = pres;
      absent = ab;
      total = tot;
      attendedTotal = pres;
    } else {
      const [att, tot] = counts;
      present = att;
      total = tot;
      absent = total - present;
      attendedTotal = att;
    }

    const pct = total > 0 ? Number(((attendedTotal / total) * 100).toFixed(2)) : 0;

    const beforeType = cols.slice(0, typeColIdx);
    const startIdx = /^\d+$/.test(beforeType[0] ?? '') ? 1 : 0;
    if (beforeType.length <= startIdx) continue;

    const code = beforeType[startIdx];
    const name = beforeType.slice(startIdx + 1).join(' ').trim() || code;
    const type = cols[typeColIdx];

    const canSkip = pct >= 75 ? Math.floor((attendedTotal - 0.75 * total) / 0.75) : 0;
    const needToAttend = pct < 75 ? Math.ceil((0.75 * total - attendedTotal) / 0.25) : 0;

    subjects.push({ code, name, type, present, od, makeup, absent, total, percentage: pct, canSkip, needToAttend });
  }

  return subjects;
}

export type ParsedERPSubject = {
  code: string;
  name: string;
  semester?: number;
};

export function parseERPSubjects(rawText: string): ParsedERPSubject[] {
  if (!rawText) return [];

  const lines = rawText.trim().split(/\r?\n/);
  const subjects: ParsedERPSubject[] = [];
  const TYPES = new Set(['LECTURE', 'TUTORIAL', 'LAB', 'PRACTICAL', 'LABORATORY', 'TUT', 'L', 'T', 'P', 'PR']);

  // Wider regex: 4-15 chars, allows dots and parentheses (e.g. NU99.5, ITUL301(Tut.))
  const CODE_RE = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9-.()]{4,15}$/;

  function isTypeOrIndex(str: string): boolean {
    if (!str) return true;
    const upper = str.toUpperCase().trim();
    return /^\d+$/.test(upper) || TYPES.has(upper);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isTSV = trimmed.includes('\t');
    const cols = isTSV
      ? trimmed.split('\t').map(c => c.trim()).filter(Boolean)
      : trimmed.split(/\s+/).map(c => c.trim()).filter(Boolean);

    const codeIdx = cols.findIndex(c => CODE_RE.test(c));
    if (codeIdx === -1) continue;

    const code = cols[codeIdx].toUpperCase();
    const startIdx = /^\d+$/.test(cols[0] ?? '') ? 1 : 0;

    let name = '';
    let semester: number | undefined;

    if (isTSV) {
      // For TSV: check if column before code is a real name (not index/type)
      const prevCol = cols[codeIdx - 1];
      const nextCol = cols[codeIdx + 1];

      if (prevCol && !isTypeOrIndex(prevCol)) {
        name = prevCol;
      } else if (nextCol && !isTypeOrIndex(nextCol)) {
        name = nextCol;
      }

      // Search remaining columns for semester number
      for (let i = codeIdx + 1; i < cols.length; i++) {
        const num = parseInt(cols[i], 10);
        if (!isNaN(num) && num >= 1 && num <= 8 && /^\d+$/.test(cols[i])) {
          semester = num;
          break;
        }
      }
    } else {
      // For space-separated: find type column from end to avoid matching "Lab" in subject name
      let typeIdx = -1;
      for (let i = cols.length - 1; i >= 0; i--) {
        if (TYPES.has(cols[i].toUpperCase())) {
          typeIdx = i;
          break;
        }
      }

      if (codeIdx > startIdx) {
        // Name is before code (common: # Name Code Type)
        name = cols.slice(startIdx, codeIdx).join(' ');
      } else {
        // Name is after code
        const endIdx = (typeIdx > codeIdx) ? typeIdx : cols.length;
        name = cols.slice(codeIdx + 1, endIdx).join(' ');
      }

      // Search for semester in trailing columns
      for (let i = Math.max(codeIdx + 1, typeIdx + 1); i < cols.length; i++) {
        const num = parseInt(cols[i], 10);
        if (!isNaN(num) && num >= 1 && num <= 8 && /^\d+$/.test(cols[i])) {
          semester = num;
          break;
        }
      }
    }

    if (name) {
      subjects.push({ code, name, semester });
    }
  }

  // If we found subjects, return them
  if (subjects.length > 0) {
    return subjects;
  }

  // Fallback: Try parsing using the attendance table parser
  const attendanceSubjects = parseERPAttendance(rawText);
  return attendanceSubjects.map(s => ({
    code: s.code,
    name: s.name,
  }));
}


// ── Class-Level ERP Parser ───────────────────────────────────────────────────

export type ClassLogEntry = {
  code: string;
  name: string;
  subjectType: 'Lecture' | 'Lab' | 'Tutorial';
  date: string;       // "2026-08-10"
  dayOfWeek: string;  // "Mon", "Tue", etc.
  startTime: string;  // "12:00 PM"
  numHours: number;   // 1 or 3
  status: 'P' | 'A';
};

/** Date pattern: YYYY-MM-DD optionally followed by (DayName) */
const DATE_RE = /(\d{4}-\d{2}-\d{2})\s*\((\w+)\)/;
/** Time pattern: H:MM AM/PM or HH:MM AM/PM */
const TIME_RE = /^(\d{1,2}:\d{2}\s*[AaPp][Mm])$/;
const CLASS_TYPES = new Set(['Lecture', 'Tutorial', 'Lab', 'Practical', 'Laboratory', 'Tut']);
const DAY_ABBR: Record<string, string> = {
  'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
  'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun',
  'Mon': 'Mon', 'Tue': 'Tue', 'Wed': 'Wed', 'Thu': 'Thu',
  'Fri': 'Fri', 'Sat': 'Sat', 'Sun': 'Sun',
};
const SUBJECT_CODE_RE = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9\-.()]{4,15}$/;

/**
 * Parses the class-level ERP attendance report (individual class entries with
 * dates, times, P/A markers).
 *
 * Returns null if the text doesn't match class-level format (allows caller to
 * fall back to aggregate parser). Returns empty array if format matches but
 * no valid rows found.
 *
 * Expected format (TSV or space-separated):
 * # SubjectCode SubjectName SubjectType FacultyName Date StartingTime NumHours Marked
 */
export function parseERPClassLog(rawText: string): ClassLogEntry[] | null {
  if (!rawText) return null;
  const lines = rawText.trim().split(/\r?\n/);
  const entries: ClassLogEntry[] = [];
  let hasDateMatch = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this line has a date — key signal for class-level format
    const dateMatch = DATE_RE.exec(trimmed);
    if (dateMatch) hasDateMatch = true;
    if (!dateMatch) continue;

    const dateStr = dateMatch[1];  // "2026-08-10"
    const dayName = dateMatch[2];  // "Monday"
    const dayAbbr = DAY_ABBR[dayName] ?? dayName.slice(0, 3);

    // Split into columns (TSV preferred to preserve spaces in names)
    const isTSV = trimmed.includes('\t');
    const cols = isTSV
      ? trimmed.split('\t').map(c => c.trim()).filter(Boolean)
      : trimmed.split(/\s+/).map(c => c.trim()).filter(Boolean);

    // Find the subject type column
    const typeColIdx = cols.findIndex(c => CLASS_TYPES.has(c));
    if (typeColIdx < 0) continue;

    // Find the status column (P or A, typically last column)
    const statusCol = cols[cols.length - 1]?.toUpperCase();
    if (statusCol !== 'P' && statusCol !== 'A') continue;
    const status = statusCol as 'P' | 'A';

    // Find numHours (integer, usually second to last or near end)
    // Walk backwards from end to find it, skipping status and date columns
    let numHours = 1;
    for (let i = cols.length - 2; i >= 0; i--) {
      const val = parseInt(cols[i], 10);
      if (!isNaN(val) && val >= 1 && val <= 6 && /^\d+$/.test(cols[i])) {
        numHours = val;
        break;
      }
    }

    // Find starting time (H:MM AM/PM pattern)
    let startTime = '';
    for (const col of cols) {
      // Handle time that might be split across two columns ("12:00" "PM")
      if (TIME_RE.test(col)) {
        startTime = col;
        break;
      }
    }
    if (!startTime) {
      // Try combining adjacent columns for split time like "12:00" + "PM"
      for (let i = 0; i < cols.length - 1; i++) {
        const combined = cols[i] + ' ' + cols[i + 1];
        if (TIME_RE.test(combined)) {
          startTime = combined;
          break;
        }
      }
    }

    // Extract subject code and name (before the type column)
    const beforeType = cols.slice(0, typeColIdx);
    const startIdx = /^\d+$/.test(beforeType[0] ?? '') ? 1 : 0;
    if (beforeType.length <= startIdx) continue;

    // Find subject code
    let codeIdx = -1;
    for (let i = startIdx; i < beforeType.length; i++) {
      if (SUBJECT_CODE_RE.test(beforeType[i])) {
        codeIdx = i;
        break;
      }
    }
    if (codeIdx < 0) continue;

    const code = beforeType[codeIdx].toUpperCase();
    const name = beforeType.slice(codeIdx + 1).join(' ').trim() || code;

    const subjectType = normalizeSubjectType(cols[typeColIdx]);

    entries.push({
      code,
      name,
      subjectType,
      date: dateStr,
      dayOfWeek: dayAbbr,
      startTime: startTime || 'Unknown',
      numHours,
      status,
    });
  }

  // If we never saw a date pattern, this isn't class-level format
  if (!hasDateMatch) return null;

  return entries;
}

function normalizeSubjectType(raw: string): 'Lecture' | 'Lab' | 'Tutorial' {
  const lower = raw.toLowerCase();
  if (lower === 'lecture') return 'Lecture';
  if (['lab', 'practical', 'laboratory'].includes(lower)) return 'Lab';
  if (['tutorial', 'tut'].includes(lower)) return 'Tutorial';
  return 'Lecture';
}

// ── Aggregate Computation from Class Log ─────────────────────────────────────

export type ClassLogAggregate = {
  code: string;
  name: string;
  present: number;
  absent: number;
  od: number;
  makeup: number;
};

/**
 * Computes per-subject aggregate attendance totals from class-level entries.
 * Groups by subject code and counts P vs A entries, weighting by numHours.
 */
export function computeAggregatesFromClassLog(
  entries: ClassLogEntry[]
): ClassLogAggregate[] {
  const map = new Map<string, ClassLogAggregate>();

  for (const entry of entries) {
    let agg = map.get(entry.code);
    if (!agg) {
      agg = { code: entry.code, name: entry.name, present: 0, absent: 0, od: 0, makeup: 0 };
      map.set(entry.code, agg);
    }

    if (entry.status === 'P') {
      agg.present += entry.numHours;
    } else {
      agg.absent += entry.numHours;
    }
  }

  return Array.from(map.values());
}

// ── Insights Computation from Class Log ──────────────────────────────────────

export type DayOfWeekRate = {
  attended: number;
  total: number;
  rate: number;
};

export type AttendanceInsights = {
  version: number;
  dateRange: { from: string; to: string };
  lastPasteAt: string;
  totalClasses: number;
  dayOfWeekRates: Record<string, DayOfWeekRate>;
  currentStreak: number;
  longestStreak: number;
  lastAbsentDate: string | null;
  recentAbsences: string[];
};

/**
 * Computes per-subject attendance insights from class-level entries.
 * All computation is pure — no side effects, no DB calls.
 *
 * Returns a Map of subject code → insights payload (ready to store as JSONB).
 */
export function computeInsightsFromClassLog(
  entries: ClassLogEntry[]
): Map<string, AttendanceInsights> {
  // Group entries by subject code
  const bySubject = new Map<string, ClassLogEntry[]>();
  for (const entry of entries) {
    const list = bySubject.get(entry.code) ?? [];
    list.push(entry);
    bySubject.set(entry.code, list);
  }

  const result = new Map<string, AttendanceInsights>();
  const now = new Date().toISOString();

  for (const [code, subjectEntries] of bySubject) {
    // Sort by date ascending, then by time for streak computation
    const sorted = [...subjectEntries].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });

    // Date range
    const dates = sorted.map(e => e.date);
    const from = dates[0];
    const to = dates[dates.length - 1];

    // Day-of-week rates
    const dayRates: Record<string, { attended: number; total: number }> = {};
    for (const entry of sorted) {
      const day = entry.dayOfWeek;
      if (!dayRates[day]) dayRates[day] = { attended: 0, total: 0 };
      dayRates[day].total += entry.numHours;
      if (entry.status === 'P') {
        dayRates[day].attended += entry.numHours;
      }
    }
    const dayOfWeekRates: Record<string, DayOfWeekRate> = {};
    for (const [day, counts] of Object.entries(dayRates)) {
      dayOfWeekRates[day] = {
        attended: counts.attended,
        total: counts.total,
        rate: counts.total > 0 ? Number((counts.attended / counts.total).toFixed(2)) : 0,
      };
    }

    // Streak computation (newest to oldest for current streak)
    const reverseSorted = [...sorted].reverse();
    let currentStreak = 0;
    for (const entry of reverseSorted) {
      if (entry.status === 'P') {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak (walk forward)
    let longestStreak = 0;
    let runningStreak = 0;
    for (const entry of sorted) {
      if (entry.status === 'P') {
        runningStreak++;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    // Absence data
    const absences = sorted.filter(e => e.status === 'A').map(e => e.date);
    const uniqueAbsences = [...new Set(absences)].sort().reverse();
    const lastAbsentDate = uniqueAbsences.length > 0 ? uniqueAbsences[0] : null;
    const recentAbsences = uniqueAbsences.slice(0, 5);

    result.set(code, {
      version: 1,
      dateRange: { from, to },
      lastPasteAt: now,
      totalClasses: sorted.length,
      dayOfWeekRates,
      currentStreak,
      longestStreak,
      lastAbsentDate,
      recentAbsences,
    });
  }

  return result;
}

/**
 * Computes overall (cross-subject) day-of-week attendance rates from insights.
 * Used by the recovery prediction engine for realistic estimates.
 */
export function getOverallDayOfWeekRates(
  insightsMap: Map<string, AttendanceInsights>
): Record<string, number> {
  const totals: Record<string, { attended: number; total: number }> = {};

  for (const insights of insightsMap.values()) {
    for (const [day, rate] of Object.entries(insights.dayOfWeekRates)) {
      if (!totals[day]) totals[day] = { attended: 0, total: 0 };
      totals[day].attended += rate.attended;
      totals[day].total += rate.total;
    }
  }

  const rates: Record<string, number> = {};
  for (const [day, counts] of Object.entries(totals)) {
    rates[day] = counts.total > 0 ? Number((counts.attended / counts.total).toFixed(2)) : 1.0;
  }

  return rates;
}
