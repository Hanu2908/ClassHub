import { describe, expect, it } from 'vitest';
import {
  parseERPClassLog,
  computeAggregatesFromClassLog,
} from '../../src/lib/utils/attendance';

/**
 * Full ERP regression test using the user's real 135-entry class log.
 * Source of truth: the official ERP summary report.
 *
 * ERP Summary:
 *   Total Present: 159
 *   Total Held:    182  (present + od + absent, makeup excluded)
 *   Overall:       87.36%
 *
 * The app was incorrectly showing 159/183 = 86.9% because the MAKEUP row
 * for ITUL301 was counted as a regular absent, inflating total_held by 1.
 */

const FULL_CLASS_LOG = `
#\tSubject Code\tSubject\tSubject Type\tFaculty Name\tDate\tStarting Time\tNumber of Hours\tMarked
1\tITUL301\tData Structures and Algorithms\tMAKEUP\tLecture\tAakansha Mitawa\t2026-08-22 (Saturday)\t1:00 PM\t1\tA
2\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-08-22 (Saturday)\t12:00 PM\t1\tP
3\tNU99.5\tSoft Skills Training\tLab\tRaunak Goswami\t2026-08-22 (Saturday)\t10:15 AM\t1\tP
4\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-22 (Saturday)\t8:15 AM\t1\tP
5\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-08-21 (Friday)\t12:00 PM\t3\tA
6\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-21 (Friday)\t10:15 AM\t1\tA
7\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-21 (Friday)\t9:15 AM\t1\tA
8\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-21 (Friday)\t8:15 AM\t1\tA
9\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-08-20 (Thursday)\t12:00 PM\t3\tP
10\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-20 (Thursday)\t10:15 AM\t1\tP
11\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-20 (Thursday)\t9:15 AM\t1\tP
12\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-20 (Thursday)\t8:15 AM\t1\tP
13\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-19 (Wednesday)\t12:00 PM\t1\tP
14\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-19 (Wednesday)\t10:15 AM\t1\tP
15\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-19 (Wednesday)\t9:15 AM\t1\tP
16\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-19 (Wednesday)\t8:15 AM\t1\tP
17\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-18 (Tuesday)\t2:00 PM\t1\tA
18\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-18 (Tuesday)\t1:00 PM\t1\tA
19\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-08-18 (Tuesday)\t12:00 PM\t1\tP
20\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-08-18 (Tuesday)\t8:15 AM\t3\tP
21\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-17 (Monday)\t1:00 PM\t1\tP
22\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-17 (Monday)\t12:00 PM\t1\tP
23\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-08-17 (Monday)\t8:15 AM\t3\tP
24\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-08-14 (Friday)\t12:00 PM\t3\tA
25\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-14 (Friday)\t10:15 AM\t1\tP
26\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-14 (Friday)\t9:15 AM\t1\tA
27\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-14 (Friday)\t8:15 AM\t1\tA
28\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-08-13 (Thursday)\t12:00 PM\t3\tP
29\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-13 (Thursday)\t10:15 AM\t1\tP
30\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-13 (Thursday)\t9:15 AM\t1\tP
31\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-13 (Thursday)\t8:15 AM\t1\tP
32\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-12 (Wednesday)\t12:00 PM\t1\tA
33\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-12 (Wednesday)\t10:15 AM\t1\tP
34\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-12 (Wednesday)\t9:15 AM\t1\tP
35\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-12 (Wednesday)\t8:15 AM\t1\tP
36\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-11 (Tuesday)\t2:00 PM\t1\tP
37\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-08-11 (Tuesday)\t1:00 PM\t1\tP
38\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-11 (Tuesday)\t12:00 PM\t1\tP
39\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-08-11 (Tuesday)\t8:15 AM\t3\tP
40\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-10 (Monday)\t1:00 PM\t1\tP
41\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-10 (Monday)\t12:00 PM\t1\tP
42\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-08-10 (Monday)\t8:15 AM\t3\tP
43\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-08-08 (Saturday)\t12:00 PM\t1\tA
44\tNU99.5\tSoft Skills Training\tLab\tRaunak Goswami\t2026-08-08 (Saturday)\t10:15 AM\t1\tA
45\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-08 (Saturday)\t9:15 AM\t1\tA
46\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-08 (Saturday)\t8:15 AM\t1\tA
47\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-08-07 (Friday)\t12:00 PM\t3\tP
48\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-07 (Friday)\t10:15 AM\t1\tA
49\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-07 (Friday)\t9:15 AM\t1\tP
50\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-07 (Friday)\t8:15 AM\t1\tP
51\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-08-06 (Thursday)\t12:00 PM\t3\tP
52\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-06 (Thursday)\t10:15 AM\t1\tP
53\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-06 (Thursday)\t9:15 AM\t1\tP
54\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-06 (Thursday)\t8:15 AM\t1\tP
55\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-05 (Wednesday)\t12:00 PM\t1\tP
56\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-05 (Wednesday)\t10:15 AM\t1\tP
57\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-05 (Wednesday)\t9:15 AM\t1\tP
58\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-05 (Wednesday)\t8:15 AM\t1\tP
59\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-08-04 (Tuesday)\t2:00 PM\t1\tP
60\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-08-04 (Tuesday)\t1:00 PM\t1\tP
61\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-04 (Tuesday)\t12:00 PM\t1\tP
62\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-08-04 (Tuesday)\t8:15 AM\t3\tP
63\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-08-03 (Monday)\t1:00 PM\t1\tP
64\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-08-03 (Monday)\t12:00 PM\t1\tP
65\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-08-03 (Monday)\t8:15 AM\t3\tP
66\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-08-01 (Saturday)\t12:00 PM\t1\tA
67\tNU99.5\tSoft Skills Training\tLab\tRaunak Goswami\t2026-08-01 (Saturday)\t10:15 AM\t1\tP
68\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-08-01 (Saturday)\t9:15 AM\t1\tP
69\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-08-01 (Saturday)\t8:15 AM\t1\tP
70\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-07-31 (Friday)\t12:00 PM\t3\tP
71\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-31 (Friday)\t10:15 AM\t1\tP
72\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-31 (Friday)\t9:15 AM\t1\tP
73\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-31 (Friday)\t8:15 AM\t1\tP
74\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-07-30 (Thursday)\t12:00 PM\t3\tP
75\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-30 (Thursday)\t10:15 AM\t1\tP
76\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-30 (Thursday)\t9:15 AM\t1\tP
77\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-30 (Thursday)\t8:15 AM\t1\tP
78\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-29 (Wednesday)\t12:00 PM\t1\tP
79\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-29 (Wednesday)\t10:15 AM\t1\tP
80\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-29 (Wednesday)\t9:15 AM\t1\tP
81\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-29 (Wednesday)\t8:15 AM\t1\tP
82\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-28 (Tuesday)\t2:00 PM\t1\tP
83\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-07-28 (Tuesday)\t1:00 PM\t1\tP
84\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-28 (Tuesday)\t12:00 PM\t1\tP
85\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-07-28 (Tuesday)\t8:15 AM\t3\tP
86\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-07-27 (Monday)\t2:00 PM\t1\tP
87\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-27 (Monday)\t1:00 PM\t1\tP
88\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-27 (Monday)\t12:00 PM\t1\tP
89\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-07-27 (Monday)\t8:15 AM\t3\tP
90\tNU99.5\tSoft Skills Training\tLab\tRaunak Goswami\t2026-07-25 (Saturday)\t10:15 AM\t1\tA
91\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-25 (Saturday)\t9:15 AM\t1\tA
92\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-25 (Saturday)\t8:15 AM\t1\tA
93\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-07-24 (Friday)\t12:00 PM\t3\tP
94\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-24 (Friday)\t10:15 AM\t1\tP
95\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-24 (Friday)\t9:15 AM\t1\tP
96\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-24 (Friday)\t8:15 AM\t1\tP
97\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-07-23 (Thursday)\t12:00 PM\t3\tP
98\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-23 (Thursday)\t10:15 AM\t1\tP
99\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-23 (Thursday)\t9:15 AM\t1\tP
100\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-23 (Thursday)\t8:15 AM\t1\tP
101\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-22 (Wednesday)\t12:00 PM\t1\tP
102\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-22 (Wednesday)\t10:15 AM\t1\tP
103\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-22 (Wednesday)\t9:15 AM\t1\tP
104\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-22 (Wednesday)\t8:15 AM\t1\tP
105\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-21 (Tuesday)\t2:00 PM\t1\tP
106\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-07-21 (Tuesday)\t1:00 PM\t1\tP
107\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-21 (Tuesday)\t12:00 PM\t1\tP
108\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-07-21 (Tuesday)\t8:15 AM\t3\tP
109\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-07-20 (Monday)\t2:00 PM\t1\tP
110\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-20 (Monday)\t1:00 PM\t1\tP
111\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-20 (Monday)\t12:00 PM\t1\tP
112\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-07-20 (Monday)\t8:15 AM\t3\tP
113\tNU99.5\tSoft Skills Training\tLab\tRaunak Goswami\t2026-07-18 (Saturday)\t10:15 AM\t1\tP
114\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-18 (Saturday)\t9:15 AM\t1\tP
115\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-18 (Saturday)\t8:15 AM\t1\tP
116\tITUP322\tSoftware Engineering Lab\tLab\tSanju Choudhary\t2026-07-17 (Friday)\t12:00 PM\t3\tP
117\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-17 (Friday)\t10:15 AM\t1\tP
118\tHSUL302\tTechnical Communication\tLecture\tGeetika Patni\t2026-07-17 (Friday)\t9:15 AM\t1\tP
119\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-17 (Friday)\t8:15 AM\t1\tP
120\tITUP320\tData Structures and Algorithms Lab\tLab\tAakansha Mitawa\t2026-07-16 (Thursday)\t12:00 PM\t3\tP
121\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-16 (Thursday)\t10:15 AM\t1\tP
122\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-16 (Thursday)\t9:15 AM\t1\tP
123\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-16 (Thursday)\t8:15 AM\t1\tP
124\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-15 (Wednesday)\t12:00 PM\t1\tP
125\tMAUL301\tStatistics and Probability Theory\tLecture\tShalini Shekhawat\t2026-07-15 (Wednesday)\t10:15 AM\t1\tP
126\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-15 (Wednesday)\t9:15 AM\t1\tP
127\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-15 (Wednesday)\t8:15 AM\t1\tP
128\tITUL301\tData Structures and Algorithms\tLecture\tAakansha Mitawa\t2026-07-14 (Tuesday)\t2:00 PM\t1\tP
129\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-14 (Tuesday)\t1:00 PM\t1\tP
130\tITUL303\tSoftware Engineering and Project Management\tLecture\tAnil Chaudhary\t2026-07-14 (Tuesday)\t12:00 PM\t1\tP
131\tITUP323\tDigital Electronics Lab\tLab\tAnju Rajput\t2026-07-14 (Tuesday)\t8:15 AM\t3\tP
132\tITUT330\tIndustrial Training\tLab\tHari Mohan Singh\t2026-07-13 (Monday)\t2:00 PM\t1\tP
133\tITUL304\tDigital Electronics\tLecture\tAnju Rajput\t2026-07-13 (Monday)\t1:00 PM\t1\tP
134\tITUL302\tOperating System\tLecture\tManju Choudhary\t2026-07-13 (Monday)\t12:00 PM\t1\tP
135\tITUP321\tProgramming in Java Lab\tLab\tManoj Raman\t2026-07-13 (Monday)\t8:15 AM\t3\tP
`;

// Expected per-subject totals from the official ERP summary report
const ERP_EXPECTED: Record<string, { present: number; od: number; makeup: number; absent: number; total: number; percentage: number }> = {
  'HSUL302':  { present: 6,  od: 0, makeup: 0, absent: 0, total: 6,  percentage: 100.00 },
  'ITUL301':  { present: 21, od: 0, makeup: 0, absent: 3, total: 24, percentage: 87.50 },
  'ITUL302':  { present: 17, od: 0, makeup: 0, absent: 2, total: 19, percentage: 89.47 },
  'ITUL303':  { present: 12, od: 0, makeup: 0, absent: 4, total: 16, percentage: 75.00 },
  'ITUL304':  { present: 16, od: 0, makeup: 0, absent: 2, total: 18, percentage: 88.89 },
  'ITUP320':  { present: 18, od: 0, makeup: 0, absent: 0, total: 18, percentage: 100.00 },
  'ITUP321':  { present: 18, od: 0, makeup: 0, absent: 0, total: 18, percentage: 100.00 },
  'ITUP322':  { present: 12, od: 0, makeup: 0, absent: 6, total: 18, percentage: 66.67 },
  'ITUP323':  { present: 18, od: 0, makeup: 0, absent: 0, total: 18, percentage: 100.00 },
  'ITUT330':  { present: 4,  od: 0, makeup: 0, absent: 2, total: 6,  percentage: 66.67 },
  'MAUL301':  { present: 14, od: 0, makeup: 0, absent: 2, total: 16, percentage: 87.50 },
  'NU99.5':   { present: 3,  od: 0, makeup: 0, absent: 2, total: 5,  percentage: 60.00 },
};

describe('Full ERP regression: class-log → aggregate → overall', () => {
  it('parses all 135 class entries (including the MAKEUP row)', () => {
    const entries = parseERPClassLog(FULL_CLASS_LOG);
    expect(entries).not.toBeNull();
    expect(entries).toHaveLength(135);
  });

  it('correctly detects the MAKEUP entry in row 1', () => {
    const entries = parseERPClassLog(FULL_CLASS_LOG)!;
    const makeupEntries = entries.filter(e => e.isMakeup);
    expect(makeupEntries).toHaveLength(1);
    expect(makeupEntries[0]).toMatchObject({
      code: 'ITUL301',
      isMakeup: true,
      subjectType: 'Lecture',
      status: 'A',
    });
  });

  it('produces per-subject aggregates matching the official ERP summary', () => {
    const entries = parseERPClassLog(FULL_CLASS_LOG)!;
    const aggs = computeAggregatesFromClassLog(entries);

    for (const [code, expected] of Object.entries(ERP_EXPECTED)) {
      const agg = aggs.find(a => a.code === code);
      expect(agg, `Missing aggregate for ${code}`).toBeDefined();

      const total = agg!.present + agg!.od + agg!.absent;
      expect(agg!.present).toBe(expected.present);
      expect(agg!.absent).toBe(expected.absent);
      expect(agg!.makeup).toBe(expected.makeup);
      expect(total).toBe(expected.total);
    }
  });

  it('computes correct overall totals: 159 attended / 182 total = 87.36%', () => {
    const entries = parseERPClassLog(FULL_CLASS_LOG)!;
    const aggs = computeAggregatesFromClassLog(entries);

    let totalAttended = 0;
    let totalHeld = 0;

    for (const agg of aggs) {
      const attended = agg.present + agg.od + agg.makeup;
      const held = agg.present + agg.od + agg.absent;
      totalAttended += attended;
      totalHeld += held;
    }

    expect(totalAttended).toBe(159);
    expect(totalHeld).toBe(182);

    const overallPct = Number(((totalAttended / totalHeld) * 100).toFixed(2));
    expect(overallPct).toBe(87.36);
  });
});
