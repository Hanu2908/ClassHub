export interface ParsedSmartShare {
  title: string;
  subjectId: string | null;
  matchedSubjectName: string | null;
  dueDate: string | null;
  priority: 'general' | 'critical';
  postType: 'announcement' | 'assignment';
  body: string;
  isAutoDetected: {
    title: boolean;
    subjectId: boolean;
    dueDate: boolean;
    priority: boolean;
  };
}

export interface SubjectInfo {
  id: string;
  name: string;
  code: string;
}

const ACRONYM_ALIASES: Record<string, string[]> = {
  'database management systems': ['dbms', 'db'],
  'database management system': ['dbms', 'db'],
  'operating systems': ['os'],
  'operating system': ['os'],
  'software engineering': ['se'],
  'data structures and algorithms': ['dsa', 'ds'],
  'data structures & algorithms': ['dsa', 'ds'],
  'computer networks': ['cn'],
  'theory of computation': ['toc', 'tc'],
  'digital electronics': ['de'],
  'engineering mathematics': ['maths', 'math', 'm1', 'm2', 'm3'],
};

function getSubjectAcronyms(name: string): string[] {
  if (!name) return [];
  const lowerName = name.trim().toLowerCase();
  const aliases = ACRONYM_ALIASES[lowerName] || [];
  
  const words = name.trim().split(/\s+/);
  const derived = words.map(w => w[0]).join('').toLowerCase();
  return Array.from(new Set([derived, ...aliases])).filter(a => a.length >= 2);
}

/**
 * Global smart text parser utility for ClassHub
 * Parses raw text shared from WhatsApp / external apps to auto-extract:
 * - Clean Title
 * - Matching Section Subject (by code, name, or acronym)
 * - Due Date / Time ISO string
 * - Priority level ('general' | 'critical')
 * - Inferred Post Type ('announcement' | 'assignment')
 */
export function parseSharedText(rawText: string, subjects: SubjectInfo[] = []): ParsedSmartShare {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  const isAutoDetected = {
    title: false,
    subjectId: false,
    dueDate: false,
    priority: false,
  };

  // 1. Infer Post Type
  const assignmentKeywords = ['assignment', 'homework', 'submission', 'due date', 'submit by', 'solve q', 'exercise', 'lab report'];
  const isAssignment = assignmentKeywords.some(kw => lower.includes(kw));
  const postType: 'announcement' | 'assignment' = isAssignment ? 'assignment' : 'announcement';

  // 2. Infer Priority
  const criticalKeywords = ['urgent', 'critical', 'exam notice', 'mandatory', 'attention', 'immediate', 'alert', 'important notice'];
  const isCritical = criticalKeywords.some(kw => lower.includes(kw));
  const priority: 'general' | 'critical' = isCritical ? 'critical' : 'general';
  if (isCritical) isAutoDetected.priority = true;

  // 3. Subject Matching
  let matchedSubjectId: string | null = null;
  let matchedSubjectName: string | null = null;

  for (const subj of subjects) {
    const sName = subj.name.toLowerCase();
    const sCode = subj.code.toLowerCase();
    const acronyms = getSubjectAcronyms(subj.name);

    // Word boundary match regex for acronyms and short names to avoid partial word mismatches
    const matchesAcronym = acronyms.some(acr => new RegExp(`\\b${acr}\\b`, 'i').test(lower));
    const matchesName = sName.length >= 3 && new RegExp(`\\b${sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower);
    const matchesCode = sCode.length >= 2 && lower.includes(sCode);

    if (matchesName || matchesCode || matchesAcronym) {
      matchedSubjectId = subj.id;
      matchedSubjectName = subj.name;
      isAutoDetected.subjectId = true;
      break;
    }
  }

  // 4. Due Date Extraction
  let extractedDueDate: string | null = null;
  let targetDate: Date | null = null;

  if (lower.includes('today')) {
    targetDate = new Date();
    targetDate.setHours(23, 59, 0, 0);
  } else if (lower.includes('tomorrow')) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(23, 59, 0, 0);
  } else {
    // Match day names e.g. "due Monday 5 PM" or "by Friday"
    const dayMatch = lower.match(/(?:due|by|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIdx = daysOfWeek.indexOf(dayMatch[1].toLowerCase());
      if (targetDayIdx !== -1) {
        targetDate = new Date();
        const currentDayIdx = targetDate.getDay();
        let daysToAdd = targetDayIdx - currentDayIdx;
        if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
        targetDate.setDate(targetDate.getDate() + daysToAdd);
        targetDate.setHours(23, 59, 0, 0);
      }
    }
  }

  // Time extraction e.g. "5 pm" or "11:59 pm"
  if (targetDate) {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      targetDate.setHours(hours, minutes, 0, 0);
    }
    extractedDueDate = targetDate.toISOString();
    isAutoDetected.dueDate = true;
  }

  // 5. Title Extraction
  let extractedTitle = '';
  if (text) {
    const firstLine = text.split('\n')[0].replace(/^[\s#*>-]+/, '').trim();
    if (firstLine.length > 0) {
      extractedTitle = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
      isAutoDetected.title = true;
    }
  }

  return {
    title: extractedTitle,
    subjectId: matchedSubjectId,
    matchedSubjectName,
    dueDate: extractedDueDate,
    priority,
    postType,
    body: text,
    isAutoDetected,
  };
}
