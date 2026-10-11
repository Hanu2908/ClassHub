-- feedback_reports: users file and read only their own reports; only
-- developers (users.is_developer) read across sections and change status.
-- Latest policies: 20260606000000.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_sa1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_sb1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 't_dev@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, section_id, section_roll, is_developer) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SA1', 't_sa1@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '01', false),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'SB1', 't_sb1@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000b', '01', false),
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 'DEV', 't_dev@skit.ac.in', 'bbbbbbbb-0000-4000-8000-00000000000a', '02', true);

insert into public.feedback_reports (id, user_id, type, title, description, device_info) values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'bug', 'A bug', 'from SA1', '{}'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'bug', 'B bug', 'from SB1', '{}');

-- ── student, section A ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*) from public.feedback_reports where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own report');
select is_empty(
  $$select id from public.feedback_reports where id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'student cannot read another user''s report');
select lives_ok(
  $$insert into public.feedback_reports (user_id, type, title, description, device_info)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'feedback', 't', 'd', '{}')$$,
  'student files own report');
select throws_ok(
  $$insert into public.feedback_reports (user_id, type, title, description, device_info)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'feedback', 't', 'd', '{}')$$,
  '42501', null, 'student cannot file a report as someone else');
select is_empty(
  $$update public.feedback_reports set status = 'resolved' where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'student cannot change the status of own report');
select is_empty(
  $$delete from public.feedback_reports where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'student cannot delete own report');

-- ── student, section B ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';
select is_empty(
  $$select id from public.feedback_reports where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  'section B student cannot read section A reports');
select is_empty(
  $$update public.feedback_reports set status = 'closed' where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'section B student cannot change section A reports');

-- ── developer ────────────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000d1';
select results_eq(
  $$select count(*) from public.feedback_reports where id in
    ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002')$$,
  array[2::bigint], 'developer reads reports from every section');
select results_eq(
  $$update public.feedback_reports set status = 'resolved'
    where id = 'dddddddd-0000-4000-8000-000000000002' returning status$$,
  array['resolved'], 'developer updates report status');

-- ── denied writes left the rows intact ───────────────────────────────────────
reset role;
select is(
  (select status from public.feedback_reports where id = 'dddddddd-0000-4000-8000-000000000001'),
  'pending', 'section A report status is unchanged');

select * from finish();
rollback;
