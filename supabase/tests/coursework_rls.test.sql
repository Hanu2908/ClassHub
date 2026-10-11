-- assignments + submissions: students see and submit only within their
-- section, CRs manage their own section, teachers manage only their own
-- assignments in sections they teach (section_teachers).
-- Latest policies: 20260606000000, 20260614160000, 20260828010000.
-- TODO tests mark known policy gaps; they pass the suite until the policy is fixed.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

insert into public.assignments (id, section_id, subject_id, created_by, title, due_date) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'A assignment', now() + interval '7 days'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'B assignment', now() + interval '7 days'),
  ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'Teacher assignment', now() + interval '7 days');

insert into public.submissions (id, assignment_id, student_id, status, submission_link, submitted_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'submitted', 'https://example.com/a1', now()),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'pending', null, null);

-- ── student, section A ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*) from public.assignments where id in
    ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003')$$,
  array[2::bigint], 'student reads own section assignments');
select is_empty(
  $$select id from public.assignments where id = 'cccccccc-0000-4000-8000-000000000002'$$,
  'student cannot read another section''s assignment');
select throws_ok(
  $$insert into public.assignments (section_id, subject_id, created_by, title, due_date)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'x', now())$$,
  '42501', null, 'student cannot create an assignment');
select is_empty(
  $$update public.assignments set title = 'hacked' where id = 'cccccccc-0000-4000-8000-000000000001' returning id$$,
  'student cannot edit an assignment');
select is_empty(
  $$delete from public.assignments where id = 'cccccccc-0000-4000-8000-000000000001' returning id$$,
  'student cannot delete an assignment');
select results_eq(
  $$select count(*) from public.submissions where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own submission');
select is_empty(
  $$select id from public.submissions where id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'student cannot read another section''s submission');
select throws_ok(
  $$insert into public.submissions (assignment_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'student cannot submit to another section''s assignment');
select throws_ok(
  $$insert into public.submissions (assignment_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003')$$,
  '42501', null, 'student cannot submit on behalf of a classmate');
select lives_ok(
  $$insert into public.submissions (id, assignment_id, student_id)
    values ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  'student submits to own section assignment');
select is_empty(
  $$update public.submissions set nudge_sent = true where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'student cannot update another section''s submission');

-- ── CR, section A ────────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';

select results_eq(
  $$select count(*) from public.submissions where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'CR reads own section submissions');
select is_empty(
  $$select id from public.submissions where id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'CR cannot read another section''s submissions');
select lives_ok(
  $$insert into public.assignments (section_id, subject_id, created_by, title, due_date)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'new', now() + interval '1 day')$$,
  'CR creates an assignment in own section');
select throws_ok(
  $$insert into public.assignments (section_id, subject_id, created_by, title, due_date)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'x', now())$$,
  '42501', null, 'CR cannot create an assignment in another section');
select is_empty(
  $$update public.assignments set title = 'hacked' where id = 'cccccccc-0000-4000-8000-000000000002' returning id$$,
  'CR cannot edit another section''s assignment');
select throws_ok(
  $$update public.assignments set section_id = 'bbbbbbbb-0000-4000-8000-00000000000b' where id = 'cccccccc-0000-4000-8000-000000000001'$$,
  '42501', null, 'CR cannot move an assignment into another section');
select is_empty(
  $$delete from public.assignments where id = 'cccccccc-0000-4000-8000-000000000002' returning id$$,
  'CR cannot delete another section''s assignment');
select results_eq(
  $$update public.submissions set cr_verified = true where id = 'dddddddd-0000-4000-8000-000000000001' returning cr_verified$$,
  array[true], 'CR verifies a submission in own section');
select is_empty(
  $$update public.submissions set cr_verified = true where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'CR cannot verify another section''s submission');
select throws_ok(
  $$insert into public.submissions (assignment_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002')$$,
  '42501', null, 'CR cannot create submission rows in another section');

-- ── teacher linked to section A via section_teachers ─────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000f1';

select results_eq(
  $$select count(*) from public.assignments where id = 'cccccccc-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'teacher reads assignments in a section they teach');
select is_empty(
  $$select id from public.assignments where id = 'cccccccc-0000-4000-8000-000000000002'$$,
  'teacher cannot read assignments in a section they do not teach');
select lives_ok(
  $$insert into public.assignments (section_id, subject_id, created_by, title, due_date)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'teacher new', now() + interval '1 day')$$,
  'teacher creates an assignment in a section they teach');
select throws_ok(
  $$insert into public.assignments (section_id, subject_id, created_by, title, due_date)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'eeeeeeee-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'x', now())$$,
  '42501', null, 'teacher cannot create an assignment in a section they do not teach');
select is_empty(
  $$update public.assignments set title = 'hacked' where id = 'cccccccc-0000-4000-8000-000000000001' returning id$$,
  'teacher cannot edit the CR''s assignment');
select results_eq(
  $$select count(*) from public.submissions where assignment_id = 'cccccccc-0000-4000-8000-000000000003'$$,
  array[1::bigint], 'teacher reads submissions for own assignment');
select is_empty(
  $$select id from public.submissions where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  'teacher cannot read submissions for assignments they did not create');

-- ── denied writes left the rows intact ───────────────────────────────────────
reset role;
select is(
  (select title || '/' || section_id::text from public.assignments where id = 'cccccccc-0000-4000-8000-000000000001'),
  'A assignment/bbbbbbbb-0000-4000-8000-00000000000a', 'section A assignment is unchanged');
select is(
  (select title from public.assignments where id = 'cccccccc-0000-4000-8000-000000000002'),
  'B assignment', 'section B assignment still exists and is unchanged');
select is(
  (select cr_verified or nudge_sent from public.submissions where id = 'dddddddd-0000-4000-8000-000000000002'),
  false, 'section B submission is untouched');

-- ── known policy gaps ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select todo('gap: submissions UPDATE WITH CHECK only pins student_id, not the assignment section', 1);
select throws_ok(
  $$update public.submissions set assignment_id = 'cccccccc-0000-4000-8000-000000000002'
    where id = 'dddddddd-0000-4000-8000-000000000003'$$,
  '42501', null, 'student cannot move own submission onto another section''s assignment');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select todo('gap: CR placeholder INSERT does not check that student_id is in the CR''s section', 1);
select throws_ok(
  $$insert into public.submissions (assignment_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002')$$,
  '42501', null, 'CR cannot create a submission row for a student of another section');

select * from finish();
rollback;
