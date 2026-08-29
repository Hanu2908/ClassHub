-- ============================================================================
-- ClassHub Deterministic Local Development Seed Script
-- Safe for local development via Supabase CLI (`supabase db reset`)
-- Contains zero PII and zero real production credentials.
-- ============================================================================

-- 1. Demo Section (Section P2)
INSERT INTO public.sections (id, college, name, invite_code)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'SKIT Jaipur',
  'P2',
  'P2WXYZ'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Mock Auth Users
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'cr.p2@skit.ac.in',
    crypt('ClassHubDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"google","providers":["google"]}',
    '{"name":"Aarav Sharma (CR)"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student.p2@skit.ac.in',
    crypt('ClassHubDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"google","providers":["google"]}',
    '{"name":"Rohan Verma"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teacher.p2@skit.ac.in',
    crypt('ClassHubDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"google","providers":["google"]}',
    '{"name":"Dr. Sunita Gupta"}',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Public User Profiles
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  section_id,
  section_roll,
  university_roll,
  day_scholar,
  notifications_enabled
)
VALUES
  (
    '00000000-0000-4000-8000-000000000010',
    'Aarav Sharma',
    'cr.p2@skit.ac.in',
    'cr',
    '00000000-0000-4000-8000-000000000001',
    '01',
    '22ESKCS001',
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000011',
    'Rohan Verma',
    'student.p2@skit.ac.in',
    'student',
    '00000000-0000-4000-8000-000000000001',
    '02',
    '22ESKCS002',
    true,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'Dr. Sunita Gupta',
    'teacher.p2@skit.ac.in',
    'teacher',
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    true,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  section_id = EXCLUDED.section_id,
  section_roll = EXCLUDED.section_roll,
  university_roll = EXCLUDED.university_roll;

-- 4. Core Engineering Subjects
INSERT INTO public.subjects (id, section_id, code, name, semester, accent)
VALUES
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', 'CS401', 'Database Management Systems', 4, '#4A9EFF'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', 'CS402', 'Operating Systems', 4, '#34C97B'),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000001', 'CS403', 'Computer Networks', 4, '#FFB547'),
  ('00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', 'CS404', 'Data Structures & Algorithms', 4, '#A78BFA')
ON CONFLICT (id) DO NOTHING;

-- 5. Timetable Slots (Recurring Schedule)
INSERT INTO public.timetable_slots (id, section_id, subject_id, day_of_week, start_time, end_time, room, type, created_by)
VALUES
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000021', 1, '09:00:00', '10:00:00', 'LT-101', 'lecture', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000022', 1, '10:00:00', '11:00:00', 'LT-101', 'lecture', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000023', 2, '09:00:00', '10:00:00', 'LT-102', 'lecture', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000024', 3, '11:00:00', '13:00:00', 'Lab-3', 'lab', '00000000-0000-4000-8000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Attendance Records
INSERT INTO public.attendance_records (id, user_id, subject_id, present, od, makeup, absent)
VALUES
  ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', 24, 2, 0, 4),
  ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', 20, 0, 1, 5),
  ('00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000023', 18, 1, 0, 3),
  ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000024', 22, 0, 0, 2)
ON CONFLICT (id) DO NOTHING;

-- 7. Sample Announcements
INSERT INTO public.announcements (id, section_id, author_id, title, message_content, priority, is_pinned)
VALUES
  (
    '00000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Mid-Term Exam Schedule Released',
    'Please review the updated mid-term examination timetable on the notice board and verify room numbers for Section P2.',
    'critical',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'DBMS Lab Submission Deadline',
    'All students must submit their Lab Assignment 3 question sets by Friday 5:00 PM.',
    'general',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Sample Announcement Q&A Comments
INSERT INTO public.announcement_comments (id, announcement_id, author_id, content, is_verified)
VALUES
  (
    '00000000-0000-4000-8000-000000000061',
    '00000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000011',
    'Is handwritten format required or can we submit typed PDF reports?',
    false
  ),
  (
    '00000000-0000-4000-8000-000000000062',
    '00000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000010',
    'Typed PDF submissions with query execution outputs are accepted.',
    true
  )
ON CONFLICT (id) DO NOTHING;
