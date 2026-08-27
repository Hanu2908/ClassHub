import { describe, it, expect } from 'vitest';
import { extractRollNumber } from '../../src/lib/utils/rolls';

// Helper simulating database batch division computation
export function calculateStudentBatch(sectionRoll: string | null | undefined, batch1EndRoll: number = 30): '1' | '2' {
  if (!sectionRoll) return '1';
  const numeric = extractRollNumber(sectionRoll);
  if (numeric <= 0) return '1';
  return numeric <= batch1EndRoll ? '1' : '2';
}

// Helper simulating CR permission checks
export function canManageSectionMember(
  caller: { id: string; role: string; sectionId: string },
  target: { id: string; role: string; sectionId: string }
): { allowed: boolean; reason?: string } {
  if (caller.role !== 'cr') {
    return { allowed: false, reason: 'Caller is not a Class Representative' };
  }
  if (caller.sectionId !== target.sectionId) {
    return { allowed: false, reason: 'Target belongs to a different section' };
  }
  if (caller.id === target.id) {
    return { allowed: false, reason: 'Cannot remove self via member management' };
  }
  if (target.role === 'cr') {
    return { allowed: false, reason: 'Cannot remove fellow CR directly' };
  }
  return { allowed: true };
}

describe('CR Hub Admin Unit Tests', () => {
  describe('Batch Division Rule Engine', () => {
    it('correctly maps students to Batch 1 when roll is at or below cutoff', () => {
      expect(calculateStudentBatch('P-01', 30)).toBe('1');
      expect(calculateStudentBatch('P-15', 30)).toBe('1');
      expect(calculateStudentBatch('P-30', 30)).toBe('1');
      expect(calculateStudentBatch('1', 30)).toBe('1');
    });

    it('correctly maps students to Batch 2 when roll is above cutoff', () => {
      expect(calculateStudentBatch('P-31', 30)).toBe('2');
      expect(calculateStudentBatch('P-45', 30)).toBe('2');
      expect(calculateStudentBatch('P-60', 30)).toBe('2');
      expect(calculateStudentBatch('55', 30)).toBe('2');
    });

    it('adapts when CR updates batch cutoff to custom boundary', () => {
      const customCutoff = 35;
      expect(calculateStudentBatch('P-30', customCutoff)).toBe('1');
      expect(calculateStudentBatch('P-35', customCutoff)).toBe('1');
      expect(calculateStudentBatch('P-36', customCutoff)).toBe('2');
    });

    it('handles invalid or empty rolls gracefully by defaulting to Batch 1', () => {
      expect(calculateStudentBatch(null, 30)).toBe('1');
      expect(calculateStudentBatch(undefined, 30)).toBe('1');
      expect(calculateStudentBatch('INVALID', 30)).toBe('1');
    });
  });

  describe('Member Management Permission Guards', () => {
    const sectionA = '11111111-1111-1111-1111-111111111111';
    const sectionB = '22222222-2222-2222-2222-222222222222';

    const crUser = { id: 'cr-1', role: 'cr', sectionId: sectionA };
    const studentUser = { id: 'student-1', role: 'student', sectionId: sectionA };
    const foreignStudent = { id: 'student-2', role: 'student', sectionId: sectionB };
    const fellowCr = { id: 'cr-2', role: 'cr', sectionId: sectionA };
    const regularStudentCaller = { id: 'student-3', role: 'student', sectionId: sectionA };

    it('allows CR to manage a standard student in the same section', () => {
      const res = canManageSectionMember(crUser, studentUser);
      expect(res.allowed).toBe(true);
    });

    it('blocks non-CR caller from managing members', () => {
      const res = canManageSectionMember(regularStudentCaller, studentUser);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('not a Class Representative');
    });

    it('blocks CR from managing students from another section', () => {
      const res = canManageSectionMember(crUser, foreignStudent);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('different section');
    });

    it('blocks CR from removing themselves directly', () => {
      const res = canManageSectionMember(crUser, crUser);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Cannot remove self');
    });

    it('blocks CR from removing fellow CR directly', () => {
      const res = canManageSectionMember(crUser, fellowCr);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Cannot remove fellow CR');
    });
  });

  describe('Announcement Pinning and Feed Sorting', () => {
    it('sorts pinned announcements before non-pinned announcements', () => {
      const announcements = [
        { id: '1', title: 'Regular Post 1', isPinned: false, createdAt: '2026-08-27T10:00:00Z' },
        { id: '2', title: 'Critical Pinned', isPinned: true, createdAt: '2026-08-26T10:00:00Z' },
        { id: '3', title: 'Regular Post 2', isPinned: false, createdAt: '2026-08-27T12:00:00Z' },
      ];

      const sorted = [...announcements].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });
  });
});
