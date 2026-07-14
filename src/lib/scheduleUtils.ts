export type SubjectCategory = 'lecture' | 'lab' | 'tutorial';

export function getCategory(_code: string, type: string): SubjectCategory {
  const t = type.toLowerCase();
  if (t === 'lab' || t === 'practical' || t === 'laboratory') return 'lab';
  if (t === 'tutorial' || t === 'tut') return 'tutorial';
  return 'lecture';
}

export const CATEGORY_COLORS: Record<SubjectCategory, { color: string; bg: string; border: string }> = {
  lecture:  { color: '#60A5FA', bg: '#1B222E',  border: '#2C394F' },  // Blue
  lab:     { color: '#FFB547', bg: '#251F19',   border: '#3D3325' },   // Orange
  tutorial:{ color: '#A78BFA', bg: '#211E2D', border: '#362E4A' },  // Purple
};

export const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  lecture:  'Lecture',
  lab:      'Lab',
  tutorial: 'Tutorial',
};

// ── Quick-add time helpers ────────────────────────────────────────────────────

/** Default slot duration in minutes, keyed by slot type */
export const TYPE_DURATIONS: Record<string, number> = {
  'Lecture':   60,
  'Lab':       120,
  'Tutorial':  60,
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

