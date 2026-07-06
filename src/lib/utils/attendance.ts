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


