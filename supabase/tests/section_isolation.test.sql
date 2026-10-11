-- Multi-tenancy: a member of one section never reads or writes another
-- section's members or announcements.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_s1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_s2@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_s3@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'S1', 't_s1@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'S3', 't_s3@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'S2', 't_s2@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000b', '01');

insert into public.announcements (section_id, author_id, title, message_content) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'A notice', 'for A'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-000000000002', 'B notice', 'for B');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select is_empty(
  $$select id from public.users where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  'student cannot read members of another section');
select results_eq(
  $$select count(*) from public.users where id in
    ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003')$$,
  array[2::bigint],
  'student reads members of their own section');
select is_empty(
  $$select id from public.announcements where section_id = 'bbbbbbbb-0000-4000-8000-00000000000b'$$,
  'student cannot read another section''s announcements');
select results_eq(
  $$select count(*) from public.announcements where section_id = 'bbbbbbbb-0000-4000-8000-00000000000a'$$,
  array[1::bigint],
  'student reads their own section''s announcements');
select throws_ok(
  $$insert into public.announcements (section_id, author_id, title, message_content)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-000000000001', 'x', 'x')$$,
  '42501', null, 'student cannot post into another section');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';
select is_empty(
  $$select id from public.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'isolation holds in the other direction');

select * from finish();
rollback;
