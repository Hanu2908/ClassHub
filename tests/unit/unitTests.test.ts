import { describe, it, expect } from 'vitest';
import type { UnitTest } from '../../src/hooks/useUnitTests';

describe('Unit Tests Domain Logic', () => {
  const sampleTest: UnitTest = {
    id: 'ut-1',
    sectionId: 'sec-1',
    subjectId: 'subj-1',
    subject: 'Statistics and Probability Theory',
    subjectCode: 'MAUL301',
    createdBy: 'user-cr',
    testType: 'UT1',
    title: 'Unit 1: Distributions',
    formUrl: 'https://forms.google.com/test-1',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    maxMarks: 10,
    description: '10 Questions',
    createdAt: new Date().toISOString(),
    isSubmitted: false,
    marksObtained: null,
    submittedAt: null,
  };

  it('validates default max marks is 10', () => {
    expect(sampleTest.maxMarks).toBe(10);
    expect(sampleTest.testType).toBe('UT1');
  });

  it('correctly determines whether a unit test is active or past/submitted', () => {
    const isPast1 = new Date(sampleTest.dueDate).getTime() < Date.now() || sampleTest.isSubmitted;
    expect(isPast1).toBe(false);

    const submittedTest: UnitTest = { ...sampleTest, isSubmitted: true };
    const isPast2 = new Date(submittedTest.dueDate).getTime() < Date.now() || submittedTest.isSubmitted;
    expect(isPast2).toBe(true);

    const expiredTest: UnitTest = { ...sampleTest, dueDate: new Date(Date.now() - 3600000).toISOString() };
    const isPast3 = new Date(expiredTest.dueDate).getTime() < Date.now() || expiredTest.isSubmitted;
    expect(isPast3).toBe(true);
  });

  it('validates score boundaries against maxMarks', () => {
    const scoreValid = (score: number, max: number) => score >= 0 && score <= max;
    expect(scoreValid(8.5, sampleTest.maxMarks)).toBe(true);
    expect(scoreValid(10, sampleTest.maxMarks)).toBe(true);
    expect(scoreValid(11, sampleTest.maxMarks)).toBe(false);
    expect(scoreValid(-1, sampleTest.maxMarks)).toBe(false);
  });
});
