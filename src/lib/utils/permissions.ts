export function isCR(role: string | null | undefined): boolean {
  return String(role ?? '').toLowerCase() === 'cr';
}

export function canManageSection(role: string | null | undefined): boolean {
  const r = String(role ?? '').toLowerCase();
  return r === 'cr';
}

export function canSeeActionableVotes(role: string | null | undefined): boolean {
  const r = String(role ?? '').toLowerCase();
  return isCR(r) || r === 'teacher' || r === 'admin';
}
