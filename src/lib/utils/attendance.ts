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

    const pct = parseFloat(numericCols[numericCols.length - 1]);
    const counts = numericCols.slice(0, -1).map(Number);

    // We'll preserve the raw "present" and "makeup" columns as reported by ERP
    // while using an internal `attendedTotal` (present + od + makeup) for recovery
    // calculations.
    let present: number;
    let makeup: number;
    let absent: number;
    let total: number;
    let attendedTotal: number;

    if (counts.length >= 4) {
      const [pres, od, mk, ab] = counts;
      present = pres;
      makeup = mk;
      attendedTotal = pres + od + mk;
      absent = ab;
      total = attendedTotal + absent;
    } else if (counts.length === 3) {
      const [pres, ab, tot] = counts;
      present = pres;
      makeup = 0;
      attendedTotal = pres;
      absent = ab;
      total = tot;
    } else {
      const [att, tot] = counts;
      present = att;
      makeup = 0;
      attendedTotal = att;
      total = tot;
      absent = total - attendedTotal;
    }

    const beforeType = cols.slice(0, typeColIdx);
    const startIdx = /^\d+$/.test(beforeType[0] ?? '') ? 1 : 0;
    if (beforeType.length <= startIdx) continue;

    const code = beforeType[startIdx];
    const name = beforeType.slice(startIdx + 1).join(' ').trim() || code;
    const type = cols[typeColIdx];

    const canSkip = pct >= 75 ? Math.floor((attendedTotal - 0.75 * total) / 0.75) : 0;
    const needToAttend = pct < 75 ? Math.ceil((0.75 * total - attendedTotal) / 0.25) : 0;

    subjects.push({ code, name, type, present, makeup, absent, total, percentage: pct, canSkip, needToAttend });
  }

  return subjects;
}
