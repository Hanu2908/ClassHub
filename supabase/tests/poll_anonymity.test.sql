-- General polls: votes never store student_id, and nobody (classmates or
-- CRs) can read someone else's anonymous vote.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_s1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_s3@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 't_c1@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA');

insert into public.users (id, name, email, role, cr_rank, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'S1', 't_s1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'S3', 't_s3@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'C1', 't_c1@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000a', '03');

insert into public.polls (id, section_id, created_by, question_text, poll_type) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'General?', 'general'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'Actionable?', 'actionable');

insert into public.poll_options (id, poll_id, label) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Yes'),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', 'Yes');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select throws_ok(
  $$insert into public.votes (poll_id, option_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'general poll vote cannot carry student_id');
select lives_ok(
  $$insert into public.votes (poll_id, option_id, anonymous_token)
    values ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001',
      public.calculate_anonymous_token('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001'))$$,
  'student casts an anonymous general vote');
select throws_ok(
  $$select public.calculate_anonymous_token('aaaaaaaa-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000001')$$,
  'P0001', null, 'student cannot compute a classmate''s anonymous token');
select lives_ok(
  $$insert into public.votes (poll_id, option_id, student_id)
    values ('cccccccc-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  'actionable poll vote records student_id');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000003';
select is_empty(
  $$select id from public.votes where poll_id = 'cccccccc-0000-4000-8000-000000000001'$$,
  'classmate cannot see the anonymous vote');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select is_empty(
  $$select id from public.votes where poll_id = 'cccccccc-0000-4000-8000-000000000001'$$,
  'CR cannot see the anonymous vote');

reset role;
select is_empty(
  $$select id from public.votes where poll_id = 'cccccccc-0000-4000-8000-000000000001' and student_id is not null$$,
  'general poll votes store no student_id');
select results_eq(
  $$select count(*) from public.votes where poll_id = 'cccccccc-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'the anonymous vote was stored');

select * from finish();
rollback;
