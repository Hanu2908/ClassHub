-- public.users: students may edit only their own profile fields, never
-- role, section, developer flag, CR rank or roll numbers.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_s1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_s3@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'S1', 't_s1@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'S3', 't_s3@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '02');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select throws_ok(
  $$update public.users set is_developer = true where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot make themselves a developer');
select throws_ok(
  $$update public.users set role = 'cr' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot change their role');
select throws_ok(
  $$update public.users set section_id = 'bbbbbbbb-0000-4000-8000-00000000000b' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot move to another section');
select throws_ok(
  $$update public.users set cr_rank = 'co' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot set cr_rank');
select throws_ok(
  $$update public.users set section_roll = '09' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot change their roll number');
select throws_ok(
  $$insert into public.users (id, name, email) values (gen_random_uuid(), 'X', 't_x@skit.ac.in')$$,
  '42501', null, 'student cannot insert user rows directly');

select results_eq(
  $$update public.users set phone = '9876543210', day_scholar = false
    where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning phone$$,
  array['9876543210'],
  'student updates their own allowed fields');
select is_empty(
  $$update public.users set phone = '9123456789'
    where id = 'aaaaaaaa-0000-4000-8000-000000000003' returning id$$,
  'student cannot edit a classmate profile');

set local role anon;
select throws_ok(
  $$update public.users set phone = '9123456789'$$,
  '42501', null, 'anon cannot update users');

reset role;
select is(
  (select is_developer from public.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  false, 'developer flag is unchanged');
select is(
  (select section_roll from public.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '01', 'roll number is unchanged');
select is(
  (select phone from public.users where id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  null, 'classmate phone is untouched');

select * from finish();
rollback;
