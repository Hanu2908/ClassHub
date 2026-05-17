export function extractRollNumber(raw: string | number): number {
  const s = String(raw ?? '').trim();
  const digits = s.replace(/[^0-9]/g, '');
  const n = parseInt(digits || '0', 10);
  return Number.isNaN(n) ? 0 : n;
}

export type AssignmentSet = {
  id?: string;
  label?: string;
  rollStart: number;
  rollEnd: number;
  description?: string;
};

export function getUserSet(classRoll: string | number, sets: AssignmentSet[] | undefined) {
  const roll = extractRollNumber(classRoll);
  if (!sets || sets.length === 0) return undefined;
  return sets.find(s => roll >= Number(s.rollStart) && roll <= Number(s.rollEnd));
}

export function hasOverlappingRanges(ranges: { rollStart: number; rollEnd: number }[]): boolean {
  if (!ranges || ranges.length < 2) return false;
  const sorted = ranges.slice().sort((a, b) => a.rollStart - b.rollStart);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.rollStart <= prev.rollEnd) return true; // touch or overlap
  }
  return false;
}
