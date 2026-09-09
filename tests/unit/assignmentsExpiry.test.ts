import { describe, it, expect, vi } from 'vitest';
import { isAssignmentExpired, isExpired, FIVE_DAYS_MS } from '../../src/store/appStore';

describe('Assignments 5-Day Expiry Helper', () => {
  it('identifies an assignment within 5 days of deadline as not expired', () => {
    const now = Date.now();
    const fourDaysAgo = new Date(now - (4 * 24 * 60 * 60 * 1000)).toISOString();
    
    expect(isAssignmentExpired(fourDaysAgo)).toBe(false);
  });

  it('identifies an assignment exactly at 5 days post-deadline as not expired', () => {
    const now = Date.now();
    const exactlyFiveDaysAgo = new Date(now - FIVE_DAYS_MS).toISOString();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);

    expect(isAssignmentExpired(exactlyFiveDaysAgo)).toBe(false);
    spy.mockRestore();
  });

  it('identifies an assignment past 5 days post-deadline as expired', () => {
    const sixDaysAgo = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString();
    expect(isAssignmentExpired(sixDaysAgo)).toBe(true);
  });

  it('handles null and undefined deadline gracefully', () => {
    expect(isAssignmentExpired(null)).toBe(false);
    expect(isAssignmentExpired(undefined)).toBe(false);
    expect(isAssignmentExpired('')).toBe(false);
  });

  it('preserves standard 2-day expiry for polls while providing 5-day expiry for assignments', () => {
    const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString();
    
    // Default isExpired uses TWO_DAYS_MS -> true for 3 days ago
    expect(isExpired(threeDaysAgo)).toBe(true);
    // isAssignmentExpired uses FIVE_DAYS_MS -> false for 3 days ago
    expect(isAssignmentExpired(threeDaysAgo)).toBe(false);
  });
});
