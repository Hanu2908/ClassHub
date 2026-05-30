import type { Branch } from './gpaData';

interface DefaultSubject {
  name:    string;
  credits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMESTER 1 — Common for ALL branches
// Source: SKIT Autonomous Scheme 2024-25, Sem I
// Credits: L+T for theory, P/2 for labs (CBCS standard)
// NOTE: 0-credit audit/soft-skills courses removed as they don't affect CGPA
// ─────────────────────────────────────────────────────────────────────────────
const SEM1_GROUP_1: DefaultSubject[] = [
  { name: 'Engineering Mathematics-I',                           credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Computational Thinking and Programming',              credits: 2   },
  { name: 'Basic Electrical & Electronics Engineering / Basic Mechanical Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'C Programming Lab',                                   credits: 1   },
  { name: 'Basic Electrical & Electronics Engineering Lab / Manufacturing Practice Workshop', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

const SEM1_GROUP_2: DefaultSubject[] = [
  { name: 'Engineering Mathematics-I',                           credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Computational Thinking and Programming',              credits: 2   },
  { name: 'Basic Civil Engineering / Basic Mechanical Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'C Programming Lab',                                   credits: 1   },
  { name: 'Basic Civil Engineering Lab / Manufacturing Practice Workshop', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

const SEM1_GROUP_3: DefaultSubject[] = [
  { name: 'Engineering Mathematics-I',                           credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Computational Thinking and Programming',              credits: 2   },
  { name: 'Basic Electrical & Electronics Engineering / Basic Civil Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'C Programming Lab',                                   credits: 1   },
  { name: 'Basic Electrical & Electronics Engineering Lab / Basic Civil Engineering Lab', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

const SEM2_GROUP_1: DefaultSubject[] = [
  { name: 'Engineering Mathematics-II',                          credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Innovation & Entrepreneurship',                       credits: 1   },
  { name: 'Problem Solving using Object Oriented Paradigm',      credits: 2   },
  { name: 'Basic Electrical & Electronics Engineering / Basic Mechanical Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'Object Oriented Programming Lab',                     credits: 1   },
  { name: 'Basic Electrical & Electronics Engineering Lab / Manufacturing Practice Workshop', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

const SEM2_GROUP_2: DefaultSubject[] = [
  { name: 'Engineering Mathematics-II',                          credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Innovation & Entrepreneurship',                       credits: 1   },
  { name: 'Problem Solving using Object Oriented Paradigm',      credits: 2   },
  { name: 'Basic Civil Engineering / Basic Mechanical Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'Object Oriented Programming Lab',                     credits: 1   },
  { name: 'Basic Civil Engineering Lab / Manufacturing Practice Workshop', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

const SEM2_GROUP_3: DefaultSubject[] = [
  { name: 'Engineering Mathematics-II',                          credits: 4   },
  { name: 'Engineering Physics / Engineering Chemistry',         credits: 4   },
  { name: 'Communication Skills / Universal Human Values',       credits: 2   },
  { name: 'Innovation & Entrepreneurship',                       credits: 1   },
  { name: 'Problem Solving using Object Oriented Paradigm',      credits: 2   },
  { name: 'Basic Electrical & Electronics Engineering / Basic Civil Engineering', credits: 2   },
  { name: 'Engineering Physics Lab / Engineering Chemistry Lab', credits: 1   },
  { name: 'Language Lab / Universal Human Values Lab',           credits: 1   },
  { name: 'Object Oriented Programming Lab',                     credits: 1   },
  { name: 'Basic Electrical & Electronics Engineering Lab / Basic Civil Engineering Lab', credits: 1   },
  { name: 'Computer Aided Engineering Graphics / Computer Aided Machine Drawing', credits: 1.5 },
  { name: 'Environmental Sciences / Constitution of India', credits: 0 },
  { name: 'Social Outreach, Discipline and Extra-Curricular Activities (SODECA)', credits: 0.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CSE — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, CSE Year II
// ─────────────────────────────────────────────────────────────────────────────
const CSE_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   }, // 1L (HSMC)
  { name: 'Statistics and Probability Theory',                   credits: 3   }, // 3L (BSC)
  { name: 'Data Structures and Algorithms',                      credits: 4   }, // 3L+1T (PCC)
  { name: 'Operating System',                                    credits: 3   }, // 3L (PCC)
  { name: 'Software Engineering and Project Management',         credits: 3   }, // 3L (PCC)
  { name: 'Digital Electronics',                                 credits: 3   }, // 3L (ESC)
  { name: 'Data Structures and Algorithms Lab',                  credits: 1.5 }, // 3P (PCC)
  { name: 'Programming in Java Lab',                             credits: 1.5 }, // 3P (PCC)
  { name: 'Software Engineering Lab',                            credits: 1.5 }, // 3P (PCC)
  { name: 'Digital Electronics Lab',                             credits: 1.5 }, // 3P (PCC)
  { name: 'Industrial Training',                                 credits: 1   }, // PSIT
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const CSE_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   }, // 1L (HSMC)
  { name: 'Discrete Mathematics and Linear Algebra',             credits: 3   }, // 3L (BSC)
  { name: 'Database Management System',                          credits: 3   }, // 3L (PCC)
  { name: 'Theory of Computation',                               credits: 3   }, // 3L (PCC)
  { name: 'Computer Networks',                                   credits: 3   }, // 3L (PCC)
  { name: 'Artificial Intelligence',                             credits: 2   }, // 2L (PCC)
  { name: 'Computer Architecture and Microprocessor',            credits: 2   }, // 2L (ESC)
  { name: 'Database Systems Lab',                                credits: 1.5 }, // 3P (PCC)
  { name: 'Network Programming Lab',                             credits: 1.5 }, // 3P (PCC)
  { name: 'Microprocessor Lab',                                  credits: 1.5 }, // 3P (PCC)
  { name: 'Data Analytics and Visualization Lab',                credits: 1.5 }, // 3P (PCC)
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// CSE-AI — S3/S4 same structure as CSE (shares course codes: CAUL301, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const CSE_AI_S3: DefaultSubject[] = CSE_S3; // Same as CSE S3 per shared course codes
const CSE_AI_S4: DefaultSubject[] = CSE_S4; // Same as CSE S4

// ─────────────────────────────────────────────────────────────────────────────
// CSE-DS (Data Science) — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, DS Year II
// ─────────────────────────────────────────────────────────────────────────────
const CSE_DS_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Statistics and Probability Theory',                   credits: 3   },
  { name: 'Data Structures and Algorithms',                      credits: 4   }, // 3L+1T
  { name: 'Foundation of Data Science',                          credits: 3   },
  { name: 'Software Engineering and Project Management',         credits: 3   },
  { name: 'Digital Electronics',                                 credits: 3   },
  { name: 'Data Structures and Algorithms Lab',                  credits: 1.5 },
  { name: 'Programming in Java Lab',                             credits: 1.5 },
  { name: 'Python for Data Science Lab',                         credits: 1.5 },
  { name: 'Digital Electronics Lab',                             credits: 1.5 },
  { name: 'Industrial Training',                                 credits: 1   },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const CSE_DS_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Discrete Mathematics and Linear Algebra',             credits: 3   },
  { name: 'Database Management System',                          credits: 3   },
  { name: 'Full Stack Development',                              credits: 2   },
  { name: 'Computer Network',                                    credits: 3   },
  { name: 'Operating System',                                    credits: 3   },
  { name: 'Computer Architecture and Microprocessor',            credits: 2   },
  { name: 'Database Systems Lab',                                credits: 1.5 },
  { name: 'Full Stack Development Lab',                          credits: 1.5 },
  { name: 'Microprocessor Lab',                                  credits: 1.5 },
  { name: 'R-Programming for Data Science',                      credits: 1.5 },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// CSE-IOT (Internet of Things) — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, IOT Year II
// ─────────────────────────────────────────────────────────────────────────────
const CSE_IOT_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Statistics and Probability Theory',                   credits: 3   },
  { name: 'Data Structures and Algorithms',                      credits: 4   }, // 3L+1T
  { name: 'Electronic System for IoT',                           credits: 3   },
  { name: 'Software Engineering and Project Management',         credits: 3   },
  { name: 'Digital Electronics',                                 credits: 3   },
  { name: 'Data Structures and Algorithms Lab',                  credits: 1.5 },
  { name: 'Programming in Java Lab',                             credits: 1.5 },
  { name: 'Electronic System for IoT Lab',                       credits: 1.5 },
  { name: 'Digital Electronics Lab',                             credits: 1.5 },
  { name: 'Industrial Training',                                 credits: 1   },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const CSE_IOT_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Discrete Mathematics and Linear Algebra',             credits: 3   },
  { name: 'Database Management System',                          credits: 3   },
  { name: 'Data Analytics for IoT',                              credits: 2   },
  { name: 'Computer Networks',                                   credits: 3   },
  { name: 'Operating System',                                    credits: 3   },
  { name: 'Computer Architecture and Microprocessor',            credits: 2   },
  { name: 'Database Systems Lab',                                credits: 1.5 },
  { name: 'Network Programming Lab',                             credits: 1.5 },
  { name: 'Microprocessor Lab',                                  credits: 1.5 },
  { name: 'Data Analytics and Visualization Lab',                credits: 1.5 },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// IT — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, IT Year II
// ─────────────────────────────────────────────────────────────────────────────
const IT_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Statistics and Probability Theory',                   credits: 3   },
  { name: 'Data Structures and Algorithms',                      credits: 4   }, // 3L+1T
  { name: 'Operating System',                                    credits: 3   },
  { name: 'Software Engineering and Project Management',         credits: 3   },
  { name: 'Digital Electronics',                                 credits: 3   },
  { name: 'Data Structures and Algorithms Lab',                  credits: 1.5 },
  { name: 'Programming in Java Lab',                             credits: 1.5 },
  { name: 'Software Engineering Lab',                            credits: 1.5 },
  { name: 'Digital Electronics Lab',                             credits: 1.5 },
  { name: 'Industrial Training',                                 credits: 1   },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const IT_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Discrete Mathematics and Linear Algebra',             credits: 3   },
  { name: 'Database Management System',                          credits: 3   },
  { name: 'Theory of Computation',                               credits: 3   },
  { name: 'Computer Networks',                                   credits: 3   },
  { name: 'Artificial Intelligence',                             credits: 2   },
  { name: 'Computer Architecture and Microprocessor',            credits: 2   },
  { name: 'Database Systems Lab',                                credits: 1.5 },
  { name: 'Network Programming Lab',                             credits: 1.5 },
  { name: 'Web Development Lab',                                 credits: 1.5 },
  { name: 'Data Analytics and Visualization Lab',                credits: 1.5 },
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// ECE — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, ECE Year II
// ─────────────────────────────────────────────────────────────────────────────
const ECE_S3: DefaultSubject[] = [
  { name: 'Linear Algebra and Numerical Analysis',               credits: 4   }, // 3L+1T (BSC)
  { name: 'Technical Communication / Managerial Economics',      credits: 1   }, // 1L (HSMC)
  { name: 'Electronic Devices and Circuits',                     credits: 3   }, // 3L (PCC)
  { name: 'Digital System Design',                               credits: 3   }, // 3L (PCC)
  { name: 'Circuit Theory',                                      credits: 4   }, // 3L+1T (PCC)
  { name: 'Data Structure and Algorithm',                        credits: 2   }, // 2L (ESC)
  { name: 'Electronics Devices Lab',                             credits: 1.5 }, // 3P (PCC)
  { name: 'Digital System Design Lab',                           credits: 1.5 }, // 3P (PCC)
  { name: 'Circuit Simulation and PCB Design Lab',               credits: 2   }, // 4P (PCC)
  { name: 'Data Structure and Algorithm Lab',                    credits: 1   }, // 2P (ESC)
  { name: 'Industry Training',                                   credits: 1   }, // PSIT
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const ECE_S4: DefaultSubject[] = [
  { name: 'Probability and Stochastic Process',                  credits: 2   }, // 2L (BSC)
  { name: 'Analog Electronics',                                  credits: 3   }, // 3L (PCC)
  { name: 'Signals and Systems',                                 credits: 3   }, // 3L (PCC)
  { name: 'Analog and Digital Communication',                    credits: 3   }, // 3L (PCC)
  { name: 'Microprocessor and Microcontroller',                  credits: 3   }, // 3L (PCC)
  { name: 'Electronics Measurement and Instrumentation',         credits: 2   }, // 2L (ESC)
  { name: 'Technical Communication / Managerial Economics',      credits: 1   }, // 1L (HSMC)
  { name: 'Analog Electronics Lab',                              credits: 1.5 }, // 3P (PCC)
  { name: 'Python Programming Lab',                              credits: 1   }, // 2P (PCC)
  { name: 'Analog and Digital Communication Lab',                credits: 1.5 }, // 3P (PCC)
  { name: 'Microprocessor and Microcontroller Lab',              credits: 1   }, // 2P (PCC)
  { name: 'Electronics Measurement and Instrumentation Lab',     credits: 1   }, // 2P (ESC)
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// EE — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, EE Year II
// ─────────────────────────────────────────────────────────────────────────────
const EE_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Advanced Engineering Mathematics-I',                  credits: 3   }, // 3L (BSC)
  { name: 'Electrical Measurement & Instrumentation',            credits: 3   }, // 3L (PCC)
  { name: 'Generation of Electrical Power',                      credits: 2   }, // 2L (ESC)
  { name: 'Circuit Analysis-I',                                  credits: 3   }, // 3L (PCC)
  { name: 'Analog Electronics',                                  credits: 2   }, // 2L (ESC)
  { name: 'Electrical Machine-I',                                credits: 3   }, // 3L (PCC)
  { name: 'Analog Electronics Lab',                              credits: 1.5 }, // 3P (PCC)
  { name: 'Electrical Machine Lab-I',                            credits: 1.5 }, // 3P (PCC)
  { name: 'Computer Programming Lab (C++)',                      credits: 1.5 }, // 3P (ESC)
  { name: 'Electrical Circuit Design Lab',                       credits: 1.5 }, // 3P (PCC)
  { name: 'Industrial Training',                                 credits: 1   }, // PSIT
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const EE_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Advanced Engineering Mathematics-III',                credits: 3   }, // 3L (BSC)
  { name: 'Circuit Analysis-II',                                 credits: 3   }, // 3L (PCC)
  { name: 'Signal and Systems',                                  credits: 2   }, // 2L (PCC)
  { name: 'Electrical Machine-II',                               credits: 3   }, // 3L (PCC)
  { name: 'Power Electronics',                                   credits: 3   }, // 3L (PCC)
  { name: 'Digital Electronics',                                 credits: 2   }, // 2L (PCC)
  { name: 'Electrical Machine Lab-II',                           credits: 1.5 }, // 3P (PCC)
  { name: 'MATLAB Programming Lab',                              credits: 1.5 }, // 3P (PCC)
  { name: 'Digital Electronics Lab',                             credits: 1.5 }, // 3P (PCC)
  { name: 'Electrical Measurement Lab',                          credits: 1.5 }, // 3P (ESC)
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// ME — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, ME Year II
// ─────────────────────────────────────────────────────────────────────────────
const ME_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Higher Engineering Mathematics',                      credits: 3   }, // 3L (BSC)
  { name: 'Engineering Mechanics',                               credits: 3   }, // 2L+1T (ESC)
  { name: 'Engineering Thermodynamics',                          credits: 3   }, // 3L (PCC)
  { name: 'Mechanics of Solids',                                 credits: 4   }, // 3L+1T (PCC)
  { name: 'Materials Science and Engineering',                   credits: 3   }, // 3L (PCC)
  { name: 'Basic Mechanical Engineering Lab',                    credits: 1.5 }, // 3P (PCC)
  { name: 'Computer Aided Design Lab',                           credits: 1.5 }, // 3P (PCC)
  { name: 'Materials Testing Lab',                               credits: 1.5 }, // 3P (PCC)
  { name: 'Programming using MATLAB',                            credits: 1.5 }, // 3P (PCC)
  { name: 'Industrial Training',                                 credits: 1   }, // PSIT
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const ME_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Data Analytics',                                      credits: 3   }, // 3L (BSC)
  { name: 'Digital Electronics',                                 credits: 2   }, // 2L (ESC)
  { name: 'Fluid Mechanics and Fluid Machines',                  credits: 4   }, // 3L+1T (PCC)
  { name: 'Manufacturing Processes',                             credits: 3   }, // 3L (PCC)
  { name: 'Theory of Machines',                                  credits: 4   }, // 3L+1T (PCC)
  { name: 'Digital Electronics Lab',                             credits: 1   }, // 2P (ESC)
  { name: 'Fluid Mechanics and Hydraulic Machines Lab',          credits: 1.5 }, // 3P (PCC)
  { name: 'Production Engineering Lab',                          credits: 2   }, // 4P (PCC)
  { name: 'Theory of Machines Lab',                              credits: 1.5 }, // 3P (PCC)
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// CE — Semester 3 & 4
// Source: SKIT Autonomous Scheme 2024-25, CE Year II
// ─────────────────────────────────────────────────────────────────────────────
const CE_S3: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Advanced Engineering Mathematics-I',                  credits: 4   }, // 3L+1T (BSC)
  { name: 'Strength of Materials',                               credits: 4   }, // 3L+1T (PCC)
  { name: 'Surveying',                                           credits: 3   }, // 3L (PCC)
  { name: 'Building Materials and Construction',                 credits: 3   }, // 3L (PCC)
  { name: 'Engineering Geology',                                 credits: 2   }, // 2L (ESC)
  { name: 'Surveying Lab',                                       credits: 1.5 }, // 3P (PCC)
  { name: 'Professional Development Lab',                        credits: 1   }, // 2P (PCC)
  { name: 'Geology Lab',                                         credits: 1   }, // 2P (ESC)
  { name: 'Building Planning and Drafting Lab-I',                credits: 1.5 }, // 3P (ESC)
  { name: 'Building Material Testing Lab',                       credits: 1   }, // 2P (PCC)
  { name: 'Industrial Training',                                 credits: 1   }, // PSIT
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 24.5 credits
];

const CE_S4: DefaultSubject[] = [
  { name: 'Managerial Economics & Financial Accounting / Technical Communication', credits: 1   },
  { name: 'Advanced Engineering Mathematics-II',                 credits: 3   }, // 3L (BSC)
  { name: 'Structural Analysis-I',                               credits: 3   }, // 3L (PCC)
  { name: 'Fluid Mechanics and Hydraulic Engineering',           credits: 4   }, // 3L+1T (PCC)
  { name: 'Concrete Technology',                                 credits: 3   }, // 3L (ESC)
  { name: 'Environmental Engineering',                           credits: 3   }, // 3L (PCC)
  { name: 'Fluid Mechanics and Hydraulic Engineering Lab',       credits: 1   }, // 2P (PCC)
  { name: 'Concrete Lab',                                        credits: 1.5 }, // 3P (ESC)
  { name: 'Building Planning and Drafting Lab-II',               credits: 1.5 }, // 3P (PCC)
  { name: 'Environmental Engineering Lab',                       credits: 1   }, // 2P (PCC)
  { name: 'Structural Engineering Lab',                          credits: 1   }, // 2P (PCC)
  { name: 'SODECA',                                              credits: 0.5 },
  // Total: 23.5 credits
];

// ─────────────────────────────────────────────────────────────────────────────
// SEMESTERS 5-8 — Placeholder (official scheme for Year 3-4 not yet available)
// These will be updated when official scheme is shared
// ─────────────────────────────────────────────────────────────────────────────
const CSE_UPPER: Record<number, DefaultSubject[]> = {
  5: [
    { name: 'Compiler Design',                  credits: 4 },
    { name: 'Web Technologies',                 credits: 3 },
    { name: 'Information Security',             credits: 3 },
    { name: 'Open Elective-I',                  credits: 3 },
    { name: 'Program Elective-I',               credits: 3 },
    { name: 'Networks Lab',                     credits: 1.5 },
    { name: 'Web Tech Lab',                     credits: 1.5 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  6: [
    { name: 'Machine Learning',                 credits: 4 },
    { name: 'Cloud Computing',                  credits: 3 },
    { name: 'Mobile Application Development',   credits: 3 },
    { name: 'Program Elective-II',              credits: 3 },
    { name: 'Open Elective-II',                 credits: 3 },
    { name: 'ML Lab',                           credits: 1.5 },
    { name: 'Minor Project',                    credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  7: [
    { name: 'Program Elective-III',             credits: 3 },
    { name: 'Program Elective-IV',              credits: 3 },
    { name: 'Open Elective-III',                credits: 3 },
    { name: 'Major Project Part-I',             credits: 4 },
    { name: 'Seminar',                          credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  8: [
    { name: 'Major Project Part-II',            credits: 10 },
    { name: 'Industrial Training / Internship', credits: 4  },
    { name: 'Program Elective-V',               credits: 3  },
    { name: 'SODECA',                           credits: 0.5 },
  ],
};

const ECE_UPPER: Record<number, DefaultSubject[]> = {
  5: [
    { name: 'Digital Signal Processing',        credits: 4 },
    { name: 'Wireless Communication',           credits: 4 },
    { name: 'Optical Fiber Communication',      credits: 3 },
    { name: 'Embedded Systems',                 credits: 3 },
    { name: 'Program Elective-I',               credits: 3 },
    { name: 'DSP Lab',                          credits: 1.5 },
    { name: 'Embedded Systems Lab',             credits: 1.5 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  6: [
    { name: 'VLSI Design',                      credits: 4 },
    { name: 'Microwave Engineering',            credits: 3 },
    { name: 'IoT & Applications',               credits: 3 },
    { name: 'Program Elective-II',              credits: 3 },
    { name: 'Open Elective-I',                  credits: 3 },
    { name: 'VLSI Lab',                         credits: 1.5 },
    { name: 'Minor Project',                    credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  7: [
    { name: '5G Technology & Applications',     credits: 3 },
    { name: 'Program Elective-III',             credits: 3 },
    { name: 'Open Elective-II',                 credits: 3 },
    { name: 'Major Project Part-I',             credits: 4 },
    { name: 'Seminar',                          credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  8: [
    { name: 'Major Project Part-II',            credits: 10 },
    { name: 'Industrial Training / Internship', credits: 4  },
    { name: 'Program Elective-IV',              credits: 3  },
    { name: 'SODECA',                           credits: 0.5 },
  ],
};

const EE_UPPER: Record<number, DefaultSubject[]> = {
  5: [
    { name: 'Control Systems',                  credits: 4 },
    { name: 'Power Systems-I',                  credits: 4 },
    { name: 'Switchgear & Protection',          credits: 3 },
    { name: 'Program Elective-I',               credits: 3 },
    { name: 'Open Elective-I',                  credits: 3 },
    { name: 'Control Systems Lab',              credits: 1.5 },
    { name: 'Power Systems Lab',                credits: 1.5 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  6: [
    { name: 'Power Systems-II',                 credits: 4 },
    { name: 'High Voltage Engineering',         credits: 3 },
    { name: 'Utilization of Electrical Energy', credits: 3 },
    { name: 'Program Elective-II',              credits: 3 },
    { name: 'Open Elective-II',                 credits: 3 },
    { name: 'HV Lab',                           credits: 1.5 },
    { name: 'Minor Project',                    credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  7: [
    { name: 'Renewable Energy Systems',         credits: 3 },
    { name: 'Program Elective-III',             credits: 3 },
    { name: 'Open Elective-III',                credits: 3 },
    { name: 'Major Project Part-I',             credits: 4 },
    { name: 'Seminar',                          credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  8: [
    { name: 'Major Project Part-II',            credits: 10 },
    { name: 'Industrial Training / Internship', credits: 4  },
    { name: 'Program Elective-IV',              credits: 3  },
    { name: 'SODECA',                           credits: 0.5 },
  ],
};

const ME_UPPER: Record<number, DefaultSubject[]> = {
  5: [
    { name: 'Heat Transfer',                    credits: 4 },
    { name: 'Machine Design',                   credits: 4 },
    { name: 'Industrial Engineering',           credits: 3 },
    { name: 'Program Elective-I',               credits: 3 },
    { name: 'Open Elective-I',                  credits: 3 },
    { name: 'Heat Transfer Lab',                credits: 1.5 },
    { name: 'Machine Design Lab',               credits: 1.5 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  6: [
    { name: 'Refrigeration & Air Conditioning', credits: 4 },
    { name: 'Metrology & Quality Control',      credits: 3 },
    { name: 'Finite Element Method',            credits: 3 },
    { name: 'Program Elective-II',              credits: 3 },
    { name: 'Open Elective-II',                 credits: 3 },
    { name: 'RAC Lab',                          credits: 1.5 },
    { name: 'Minor Project',                    credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  7: [
    { name: 'Robotics and Automation',          credits: 3 },
    { name: 'Program Elective-III',             credits: 3 },
    { name: 'Open Elective-III',                credits: 3 },
    { name: 'Major Project Part-I',             credits: 4 },
    { name: 'Seminar',                          credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  8: [
    { name: 'Major Project Part-II',            credits: 10 },
    { name: 'Industrial Training / Internship', credits: 4  },
    { name: 'Program Elective-IV',              credits: 3  },
    { name: 'SODECA',                           credits: 0.5 },
  ],
};

const CE_UPPER: Record<number, DefaultSubject[]> = {
  5: [
    { name: 'Structural Analysis-II',           credits: 4 },
    { name: 'Foundation Engineering',           credits: 3 },
    { name: 'Transportation Engineering',       credits: 3 },
    { name: 'Program Elective-I',               credits: 3 },
    { name: 'Open Elective-I',                  credits: 3 },
    { name: 'Structural Analysis Lab',          credits: 1.5 },
    { name: 'Transportation Lab',               credits: 1.5 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  6: [
    { name: 'Design of Steel Structures',       credits: 4 },
    { name: 'Quantity Surveying',               credits: 3 },
    { name: 'Water Resource Engineering',       credits: 3 },
    { name: 'Program Elective-II',              credits: 3 },
    { name: 'Open Elective-II',                 credits: 3 },
    { name: 'Hydraulics Lab',                   credits: 1.5 },
    { name: 'Minor Project',                    credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  7: [
    { name: 'Project Planning & Management',    credits: 3 },
    { name: 'Program Elective-III',             credits: 3 },
    { name: 'Open Elective-III',                credits: 3 },
    { name: 'Major Project Part-I',             credits: 4 },
    { name: 'Seminar',                          credits: 2 },
    { name: 'SODECA',                           credits: 0.5 },
  ],
  8: [
    { name: 'Major Project Part-II',            credits: 10 },
    { name: 'Industrial Training / Internship', credits: 4  },
    { name: 'Program Elective-IV',              credits: 3  },
    { name: 'SODECA',                           credits: 0.5 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECTS_DATA — full map: Branch → Semester → Subjects
// ─────────────────────────────────────────────────────────────────────────────
export const SUBJECTS_DATA: Record<Branch, Record<number, DefaultSubject[]>> = {
  'CSE': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: CSE_S3,
    4: CSE_S4,
    ...CSE_UPPER,
  },
  'CSE-AI': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: CSE_AI_S3,
    4: CSE_AI_S4,
    ...CSE_UPPER,
  },
  'CSE-DS': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: CSE_DS_S3,
    4: CSE_DS_S4,
    ...CSE_UPPER,
  },
  'CSE-IOT': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: CSE_IOT_S3,
    4: CSE_IOT_S4,
    ...CSE_UPPER,
  },
  'IT': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: IT_S3,
    4: IT_S4,
    ...CSE_UPPER,
  },
  'ECE': {
    1: SEM1_GROUP_2,
    2: SEM2_GROUP_2,
    3: ECE_S3,
    4: ECE_S4,
    ...ECE_UPPER,
  },
  'EE': {
    1: SEM1_GROUP_2,
    2: SEM2_GROUP_2,
    3: EE_S3,
    4: EE_S4,
    ...EE_UPPER,
  },
  'ME': {
    1: SEM1_GROUP_3,
    2: SEM2_GROUP_3,
    3: ME_S3,
    4: ME_S4,
    ...ME_UPPER,
  },
  'CE': {
    1: SEM1_GROUP_1,
    2: SEM2_GROUP_1,
    3: CE_S3,
    4: CE_S4,
    ...CE_UPPER,
  },
};
