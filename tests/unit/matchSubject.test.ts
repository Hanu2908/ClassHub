import { describe, expect, it } from 'vitest';
import { matchSubject, getSubjectAbbreviation } from '../../src/lib/utils/announcements';
import { type SubjectInfo } from '../../src/hooks/useSubjects';

describe('matchSubject Utility Heuristics', () => {
  const mockSubjects: SubjectInfo[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      code: 'CS-302',
      name: 'Computer Networks',
      semester: 5,
      accent: '#FF0000',
      sectionId: 'sec-1',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      code: 'EC-(A)',
      name: 'Electronic Devices (EC)',
      semester: 3,
      accent: '#00FF00',
      sectionId: 'sec-1',
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      code: 'DBMS201',
      name: 'Database Management Systems',
      semester: 4,
      accent: '#0000FF',
      sectionId: 'sec-1',
    },
  ];

  it('matches via explicit HTML comments', () => {
    const title = 'Important Notice';
    const body = 'Class today <!-- subject_id:00000000-0000-4000-8000-000000000003 -->';
    const matched = matchSubject(title, body, mockSubjects);
    expect(matched).toBeDefined();
    expect(matched?.id).toBe('00000000-0000-4000-8000-000000000003');
  });

  it('matches exact subject code', () => {
    const title = 'CS-302 Class Quiz';
    const body = 'Be prepared';
    const matched = matchSubject(title, body, mockSubjects);
    expect(matched?.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('matches exact subject code with hyphen/space variations', () => {
    // CS-302 matched by CS302 or CS 302
    expect(matchSubject('CS302 Class', '', mockSubjects)?.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(matchSubject('CS 302 Class', '', mockSubjects)?.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('matches codes containing parentheses safely without crashing', () => {
    // EC-(A) has hyphen and parenthesis
    const matched1 = matchSubject('Notice for EC-(A)', '', mockSubjects);
    expect(matched1?.id).toBe('00000000-0000-4000-8000-000000000002');

    const matched2 = matchSubject('Notice for EC(A)', '', mockSubjects);
    expect(matched2?.id).toBe('00000000-0000-4000-8000-000000000002');

    const matched3 = matchSubject('Notice for EC A', '', mockSubjects);
    expect(matched3?.id).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('matches acronyms correctly', () => {
    // Computer Networks -> CN (minimum 2 chars)
    expect(matchSubject('CN Lab notice', '', mockSubjects)?.id).toBe('00000000-0000-4000-8000-000000000001');
    
    // Database Management Systems -> DBMS
    expect(matchSubject('DBMS exam preparation', '', mockSubjects)?.id).toBe('00000000-0000-4000-8000-000000000003');
  });

  it('matches common shortnames and synonyms', () => {
    // Database -> DBMS
    expect(matchSubject('Database class rescheduled', '', mockSubjects)?.id).toBe('00000000-0000-4000-8000-000000000003');
  });

  it('returns null if no match is found', () => {
    expect(matchSubject('General Meeting', 'All students attend', mockSubjects)).toBeNull();
  });
});

describe('getSubjectAbbreviation Utility', () => {
  const s = (name: string, code: string): SubjectInfo => ({
    id: '1',
    name,
    code,
    semester: 1,
    accent: '#000',
    sectionId: 'sec-1'
  });

  it('matches standard subjects from dictionary', () => {
    expect(getSubjectAbbreviation(s('Computer Networks', 'CS-302'))).toBe('CN');
    expect(getSubjectAbbreviation(s('Database Management Systems', 'CS-401'))).toBe('DBMS');
    expect(getSubjectAbbreviation(s('Object Oriented Programming', 'CS-201'))).toBe('OOP');
    expect(getSubjectAbbreviation(s('Data Structures', 'CS-202'))).toBe('DSA');
    expect(getSubjectAbbreviation(s('Discrete Mathematics', 'MA-101'))).toBe('Discrete');
  });

  it('generates acronyms dynamically for multi-word subjects not in dictionary', () => {
    expect(getSubjectAbbreviation(s('Advanced Software Testing', 'CS-999'))).toBe('AST');
    expect(getSubjectAbbreviation(s('Mobile Application Development', 'CS-888'))).toBe('MAD');
  });

  it('returns capitalized short names for single-word subjects', () => {
    expect(getSubjectAbbreviation(s('physics', 'PHY-101'))).toBe('Physics');
    expect(getSubjectAbbreviation(s('CHEMISTRY', 'CHM-101'))).toBe('Chemistry');
  });

  it('does not fall back to subject code for unrecognized single-word subjects > 8 chars', () => {
    expect(getSubjectAbbreviation(s('microprocessors', 'ECE-305'))).toBe('Micro');
    expect(getSubjectAbbreviation(s('thermodynamics', 'ME-301'))).toBe('Thermodynamics');
  });

  it('returns empty string if subject is null/undefined', () => {
    expect(getSubjectAbbreviation(null)).toBe('');
    expect(getSubjectAbbreviation(undefined)).toBe('');
  });
});

