-- counsellor_notes: a counsellor manages only the remarks they wrote, a student
-- reads and replies to only their own notes and cannot rewrite the remark.
-- Latest policies: 20260615000000 (plus trigger check_student_counsellor_notes_update).
-- Gaps the first run found (once pgTAP todo tests) are fixed in 20261011140000.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_sa1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_sa2@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_sb1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 't_ca@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 't_ta@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 't_tb@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, role, cr_rank, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SA1', 't_sa1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'SA2', 't_sa2@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'CA', 't_ca@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000a', '03'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'SB1', 't_sb1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000b', '01'),
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'TA', 't_ta@skit.ac.in', 'teacher', null, 'bbbbbbbb-0000-4000-8000-00000000000a', null),
  ('aaaaaaaa-0000-4000-8000-0000000000f2', 'TB', 't_tb@skit.ac.in', 'teacher', null, 'bbbbbbbb-0000-4000-8000-00000000000b', null);

insert into public.section_teachers (section_id, teacher_id, is_counsellor_for_batch) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1', '1'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000f2', '1');

insert into public.counsellor_notes (id, counsellor_id, student_id, note_text) values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-000000000001', 'remark for SA1'),
  ('dddddddd-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'remark for CA'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-000000000002', 'remark for SB1');

-- ── student, section A ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*) from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own counsellor note');
select is_empty(
  $$select id from public.counsellor_notes where id in
    ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-0000000000c1')$$,
  'student cannot read other students'' notes');
select results_eq(
  $$update public.counsellor_notes set student_response = 'will do'
    where id = 'dddddddd-0000-4000-8000-000000000001' returning student_response$$,
  array['will do'], 'student replies to own note');
select throws_ok(
  $$update public.counsellor_notes set note_text = 'rewritten' where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  'P0001', null, 'student cannot rewrite the counsellor''s remark');
select is_empty(
  $$update public.counsellor_notes set student_response = 'x'
    where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'student cannot reply on another student''s note');

-- ── teacher (counsellor) for section A ───────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000f1';

select results_eq(
  $$select count(*) from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'counsellor reads notes they wrote');
select is_empty(
  $$select id from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'counsellor cannot read another counsellor''s notes');
select lives_ok(
  $$insert into public.counsellor_notes (counsellor_id, student_id, note_text)
    values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-000000000003', 'remark for SA2')$$,
  'counsellor writes a note for a student in their section');
select throws_ok(
  $$insert into public.counsellor_notes (counsellor_id, student_id, note_text)
    values ('aaaaaaaa-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-000000000003', 'x')$$,
  '42501', null, 'counsellor cannot write a note under another counsellor''s name');
select is_empty(
  $$update public.counsellor_notes set note_text = 'hacked' where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'counsellor cannot edit another counsellor''s note');
select is_empty(
  $$delete from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'counsellor cannot delete another counsellor''s note');

-- ── student, section B ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';
select is_empty(
  $$select id from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  'section B student cannot read section A notes');

-- ── denied writes left the rows intact ───────────────────────────────────────
reset role;
select is(
  (select note_text from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000002'),
  'remark for SB1', 'section B note is unchanged');
select is(
  (select note_text from public.counsellor_notes where id = 'dddddddd-0000-4000-8000-000000000001'),
  'remark for SA1', 'section A remark text is unchanged after the student''s attempt');

-- ── cross-section checks (fixed in 20261011140000) ────────────────────────────
-- Writing a remark requires a counsellor link (section_teachers) to the
-- student's section, not just counsellor_id = auth.uid().
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.counsellor_notes (counsellor_id, student_id, note_text)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 'fake remark')$$,
  '42501', null, 'student cannot write a counsellor note for a student of another section');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000f1';
select throws_ok(
  $$insert into public.counsellor_notes (counsellor_id, student_id, note_text)
    values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-000000000002', 'x')$$,
  '42501', null, 'counsellor cannot write a note for a student in a section they do not teach');

-- The column lock applies to whoever is the note's student, CR or not.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select throws_ok(
  $$update public.counsellor_notes set note_text = 'rewritten by CR' where id = 'dddddddd-0000-4000-8000-0000000000c1'$$,
  'P0001', null, 'CR cannot rewrite a counsellor remark written about them');

select * from finish();
rollback;
