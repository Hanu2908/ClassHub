-- attendance_records + the digital register (attendance_sessions,
-- student_session_attendance): students own their aggregate rows, CRs run
-- sessions in their own section, teachers only for subjects they teach.
-- Latest policies: 20260606000000, 20260614160000, 20260614170000, 20260731173314.
-- Gaps the first run found (once pgTAP todo tests) are fixed in 20261011140000.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_sa1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_sa2@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_sb1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 't_ca@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 't_cb@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 't_ta@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, role, cr_rank, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SA1', 't_sa1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'SA2', 't_sa2@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'CA', 't_ca@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000a', '03'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'SB1', 't_sb1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000b', '01'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'CB', 't_cb@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000b', '02'),
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'TA', 't_ta@skit.ac.in', 'teacher', null, 'bbbbbbbb-0000-4000-8000-00000000000a', null);

insert into public.subjects (id, section_id, code, name, semester) values
  ('eeeeeeee-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000a', 'TA101', 'Subject A', 1),
  ('eeeeeeee-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-00000000000b', 'TB101', 'Subject B', 1);

insert into public.section_teachers (section_id, teacher_id, subject_id) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'eeeeeeee-0000-4000-8000-00000000000a');

insert into public.attendance_records (id, user_id, subject_id, present, absent) values
  ('ffffffff-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-00000000000a', 5, 1),
  ('ffffffff-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-00000000000a', 3, 0),
  ('ffffffff-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-00000000000b', 4, 0);

insert into public.attendance_sessions (id, section_id, subject_id, teacher_id) values
  ('99999999-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1'),
  ('99999999-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b', null);

insert into public.student_session_attendance (session_id, student_id, status) values
  ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'present');

-- ── student, section A ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*) from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own attendance record');
select is_empty(
  $$select id from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000002'$$,
  'student cannot read a classmate''s attendance');
select is_empty(
  $$select id from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'student cannot read another section''s attendance');
select is_empty(
  $$update public.attendance_records set present = 99 where id = 'ffffffff-0000-4000-8000-000000000002' returning id$$,
  'student cannot edit a classmate''s attendance');
select throws_ok(
  $$insert into public.attendance_records (user_id, subject_id)
    values ('aaaaaaaa-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-00000000000b')$$,
  '42501', null, 'student cannot create attendance rows for someone else');
select results_eq(
  $$update public.attendance_records set present = 10 where id = 'ffffffff-0000-4000-8000-000000000001' returning present$$,
  array[10], 'student updates own attendance record');
select results_eq(
  $$select count(*) from public.attendance_sessions where id = '99999999-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own section attendance sessions');
select is_empty(
  $$select id from public.attendance_sessions where id = '99999999-0000-4000-8000-000000000002'$$,
  'student cannot read another section''s attendance sessions');
select throws_ok(
  $$insert into public.attendance_sessions (section_id, subject_id)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a')$$,
  '42501', null, 'student cannot open an attendance session');
select throws_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003', 'present')$$,
  '42501', null, 'student cannot mark attendance');
select results_eq(
  $$select count(*) from public.student_session_attendance where student_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own session log');

-- ── CR, section A ────────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';

select results_eq(
  $$select count(*) from public.attendance_records where id in
    ('ffffffff-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000002')$$,
  array[2::bigint], 'CR reads own section attendance');
select is_empty(
  $$select id from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'CR cannot read another section''s attendance');
select is_empty(
  $$update public.attendance_records set present = 0 where id = 'ffffffff-0000-4000-8000-000000000002' returning id$$,
  'CR cannot edit a student''s aggregate attendance directly');
select lives_ok(
  $$insert into public.attendance_sessions (id, section_id, subject_id)
    values ('99999999-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a')$$,
  'CR opens a session in own section');
select throws_ok(
  $$insert into public.attendance_sessions (section_id, subject_id)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b')$$,
  '42501', null, 'CR cannot open a session in another section');
select is_empty(
  $$update public.attendance_sessions set lecture_count = 2 where id = '99999999-0000-4000-8000-000000000002' returning id$$,
  'CR cannot edit another section''s session');
select lives_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003', 'present')$$,
  'CR marks attendance in own section session');
select throws_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'present')$$,
  '42501', null, 'CR cannot mark attendance in another section''s session');
select throws_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002', 'present')$$,
  '42501', null, 'CR cannot mark a student of another section in own session');

-- ── teacher linked to section A / subject A via section_teachers ─────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000f1';

select results_eq(
  $$select count(*) from public.attendance_records where id in
    ('ffffffff-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000002')$$,
  array[2::bigint], 'teacher reads attendance for a subject they teach');
select is_empty(
  $$select id from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'teacher cannot read attendance for a subject they do not teach');
select lives_ok(
  $$insert into public.attendance_sessions (id, section_id, subject_id, teacher_id)
    values ('99999999-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1')$$,
  'teacher opens a session for own subject');
select throws_ok(
  $$insert into public.attendance_sessions (section_id, subject_id)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b')$$,
  '42501', null, 'teacher cannot open a session in a section they do not teach');
select lives_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'absent')$$,
  'teacher marks attendance in own session');
select throws_ok(
  $$insert into public.student_session_attendance (session_id, student_id, status)
    values ('99999999-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'absent')$$,
  '42501', null, 'teacher cannot mark attendance in another section''s session');
select is_empty(
  $$update public.attendance_records set present = 0 where id = 'ffffffff-0000-4000-8000-000000000003' returning id$$,
  'teacher cannot edit attendance for a subject they do not teach');

-- ── student, section B ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';

select is_empty(
  $$select id from public.attendance_sessions where id = '99999999-0000-4000-8000-000000000001'$$,
  'section B student cannot read section A sessions');
select is_empty(
  $$select id from public.student_session_attendance where session_id = '99999999-0000-4000-8000-000000000001'$$,
  'section B student cannot read section A session logs');

-- ── denied writes left the rows intact ───────────────────────────────────────
reset role;
select is(
  (select present from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000002'),
  4, 'classmate attendance changed only through the CR register (+1 present)');
select is(
  (select present from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000003'),
  4, 'section B attendance is unchanged');
select is(
  (select lecture_count from public.attendance_sessions where id = '99999999-0000-4000-8000-000000000002'),
  1, 'section B session is unchanged');

-- ── cross-section checks (fixed in 20261011140000) ────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c2';
select is_empty(
  $$select id from public.student_session_attendance where session_id = '99999999-0000-4000-8000-000000000001'$$,
  'CR of section B cannot read section A session logs');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select throws_ok(
  $$insert into public.section_teachers (section_id, teacher_id, subject_id)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'eeeeeeee-0000-4000-8000-00000000000b')$$,
  '23503', null, 'CR cannot link a subject from another section to their section');
select is_empty(
  $$select id from public.attendance_records where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'CR still cannot read another section''s attendance after that attempt');

select * from finish();
rollback;
