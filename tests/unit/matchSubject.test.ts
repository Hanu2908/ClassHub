import { describe, expect, it } from 'vitest';
import { matchSubject } from '../../src/lib/utils/announcements';
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
