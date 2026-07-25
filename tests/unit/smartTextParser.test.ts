import { describe, it, expect } from 'vitest';
import { parseSharedText, type SubjectInfo } from '../../src/lib/utils/smartTextParser';

describe('smartTextParser', () => {
  const sampleSubjects: SubjectInfo[] = [
    { id: 'sub-1', name: 'Database Management Systems', code: 'CS-301' },
    { id: 'sub-2', name: 'Operating Systems', code: 'CS-302' },
    { id: 'sub-3', name: 'Software Engineering', code: 'CS-303' },
  ];

  it('infers assignment post type when assignment keywords are present', () => {
    const parsed = parseSharedText('DBMS Assignment 2 due Monday', sampleSubjects);
    expect(parsed.postType).toBe('assignment');
    expect(parsed.isAutoDetected.title).toBe(true);
  });

  it('infers announcement post type when generic notice text is shared', () => {
    const parsed = parseSharedText('Tomorrow class is cancelled by HOD', sampleSubjects);
    expect(parsed.postType).toBe('announcement');
  });

  it('auto-matches subject by acronym (DBMS)', () => {
    const parsed = parseSharedText('DBMS Unit 3 notes attached', sampleSubjects);
    expect(parsed.subjectId).toBe('sub-1');
    expect(parsed.matchedSubjectName).toBe('Database Management Systems');
    expect(parsed.isAutoDetected.subjectId).toBe(true);
  });

  it('auto-matches subject by full name (Operating Systems)', () => {
    const parsed = parseSharedText('Operating Systems lab submission link', sampleSubjects);
    expect(parsed.subjectId).toBe('sub-2');
  });

  it('detects critical priority when urgent keywords exist', () => {
    const parsed = parseSharedText('URGENT EXAM NOTICE: Submit by 5 PM today', sampleSubjects);
    expect(parsed.priority).toBe('critical');
    expect(parsed.isAutoDetected.priority).toBe(true);
  });

  it('extracts title cleanly from the first line', () => {
    const text = 'Important DBMS Notice\nPlease review chapter 4 before lab tomorrow.';
    const parsed = parseSharedText(text, sampleSubjects);
    expect(parsed.title).toBe('Important DBMS Notice');
  });
});
