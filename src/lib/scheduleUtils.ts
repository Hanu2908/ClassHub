export type SubjectCategory = 'technical' | 'lab' | 'non-technical' | 'other';

export function getCategory(code: string, type: string): SubjectCategory {
  if (type === 'Lab' || type === 'lab' || code.endsWith('L') || code.endsWith('P')) return 'lab';
  if (type === 'tutorial' || type === 'Tutorial' || type === 'Non-Tech Lecture') return 'non-technical';
  // Technical / Core engineering subjects
  if (/^(CS|AI|DS|EC|EE|ME|IT|SE)/i.test(code)) return 'technical';
  // Non-technical / Humanities / Management subjects
  if (/^(ES|EN|HU|MGT|BBA|MBA)/i.test(code)) return 'non-technical';
  return 'other';
}

export const CATEGORY_COLORS: Record<SubjectCategory, { color: string; bg: string; border: string }> = {
  technical:     { color: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.3)' }, // Blue
  lab:           { color: '#FFB547', bg: 'rgba(255,181,71,0.15)',   border: 'rgba(255,181,71,0.3)' },   // Orange
  'non-technical':{ color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)' }, // Purple
  other:         { color: '#2DD4BF', bg: 'rgba(45,212,191,0.15)',  border: 'rgba(45,212,191,0.3)' },  // Teal
};

export const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  technical:     'Tech Lecture',
  lab:           'Lab',
  'non-technical': 'Non-Tech Lecture',
  other:         'Other',
};

// ── Quick-add time helpers ────────────────────────────────────────────────────

/** Default slot duration in minutes, keyed by slot type */
export const TYPE_DURATIONS: Record<string, number> = {
  'Tech Lecture':      60,
  'Lab':               120,
  'Non-Tech Lecture':  60,
  'Other':             60,
};

/**
 * Calculate end time given a start time (HH:MM) and slot type.
 * Returns HH:MM string.
 */
export function calculateEndTime(startTime: string, type: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const dur = TYPE_DURATIONS[type] ?? 60;
  const totalMin = h * 60 + m + dur;
  const eh = Math.floor(totalMin / 60) % 24;
  const em = totalMin % 60;
  return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(startStr: string, endStr: string): string {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  const startSuffix = sh >= 12 ? 'PM' : 'AM';
  const endSuffix = eh >= 12 ? 'PM' : 'AM';

  const sFormatted = `${sh % 12 || 12}:${sm.toString().padStart(2, '0')}`;
  const eFormatted = `${eh % 12 || 12}:${em.toString().padStart(2, '0')}`;

  if (startSuffix === endSuffix) {
    return `${sFormatted} – ${eFormatted} ${endSuffix}`;
  }
  return `${sFormatted} ${startSuffix} – ${eFormatted} ${endSuffix}`;
}

export function getSubjectAcronym(name: string): string {
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

