import type { AssignmentSet } from '../../../store/appStore';
import { extractRollNumber } from '../../../lib/utils/rolls';

export function getSubjectAcronym(name: string) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.slice(0, 2).toUpperCase();
  }
  return words
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

export function getUserSet(classRoll: string, sets: AssignmentSet[]) {
  if (!sets || sets.length === 0) return null;
  const roll = extractRollNumber(classRoll);
  return sets.find(s => roll >= s.rollStart && roll <= s.rollEnd) ?? null;
}

export function autoGenerate(totalStudents: number, numSets: number, excludeFirstPage: boolean): AssignmentSet[] {
  const sets: AssignmentSet[] = [];
  if (numSets < 1) return sets;
  const groupSize = Math.ceil(totalStudents / numSets);
  let roll = 1, setNum = 1;
  const startPage = excludeFirstPage ? 2 : 1;
  while (roll <= totalStudents) {
    const end = Math.min(roll + groupSize - 1, totalStudents);
    const pageNum = startPage + setNum - 1;
    sets.push({
      id: `set-${setNum}-${Date.now()}`,
      label: `Set ${setNum}`,
      rollStart: roll,
      rollEnd: end,
      pageNumbers: String(pageNum),
      description: `Complete Page ${pageNum} of the attached PDF.`,
      pdfUrl: null,
    });
    roll = end + 1;
    setNum++;
  }
  return sets;
}
