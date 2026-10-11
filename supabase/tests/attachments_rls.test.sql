-- attachments: section members read their section's files; only that
-- section's CR uploads (as themselves) and deletes; nobody edits metadata.
-- Ported from tests/integration/attachments_rls.test.sql.
-- Latest policies: 202605200004, 20260606000000.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_sa1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_sb1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 't_ca@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 't_cb@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, role, cr_rank, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SA1', 't_sa1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'CA', 't_ca@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'SB1', 't_sb1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000b', '01'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'CB', 't_cb@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000b', '02');

insert into public.announcements (id, section_id, author_id, title, message_content) values
  ('cccccccc-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'A notice', 'for A'),
  ('cccccccc-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'B notice', 'for B');

-- ── CR, section A ────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';

select lives_ok(
  $$insert into public.attachments (id, section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    values ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-0000000000a1',
      'notes.pdf', 'application/pdf', 102400, 'bbbbbbbb-0000-4000-8000-00000000000a/announcement/a1/notes.pdf', 'aaaaaaaa-0000-4000-8000-0000000000c1')$$,
  'CR uploads an attachment to own section');
select throws_ok(
  $$insert into public.attachments (section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    values ('bbbbbbbb-0000-4000-8000-00000000000b', 'cccccccc-0000-4000-8000-0000000000b1',
      'x.pdf', 'application/pdf', 1024, 'bbbbbbbb-0000-4000-8000-00000000000b/announcement/b1/x.pdf', 'aaaaaaaa-0000-4000-8000-0000000000c1')$$,
  '42501', null, 'CR cannot upload into another section');
select throws_ok(
  $$insert into public.attachments (section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-0000000000a1',
      'y.pdf', 'application/pdf', 1024, 'bbbbbbbb-0000-4000-8000-00000000000a/announcement/a1/y.pdf', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'CR cannot upload as another user');
select is_empty(
  $$update public.attachments set filename = 'renamed.pdf' where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'nobody can edit attachment metadata, not even the CR');

-- ── student, section A ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*) from public.attachments where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  array[1::bigint], 'student reads own section attachment');
select throws_ok(
  $$insert into public.attachments (section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-0000000000a1',
      'z.pdf', 'application/pdf', 1024, 'bbbbbbbb-0000-4000-8000-00000000000a/announcement/a1/z.pdf', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'student cannot upload attachments');
select is_empty(
  $$delete from public.attachments where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'student cannot delete attachments');

-- ── student, section B ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';

select is_empty(
  $$select id from public.attachments where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  'student cannot read another section''s attachments');
select throws_ok(
  $$insert into public.attachments (section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-0000000000a1',
      'hack.pdf', 'application/pdf', 1024, 'bbbbbbbb-0000-4000-8000-00000000000a/announcement/a1/hack.pdf', 'aaaaaaaa-0000-4000-8000-000000000002')$$,
  '42501', null, 'student cannot upload into another section');

-- ── CR, section B ────────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c2';
select is_empty(
  $$delete from public.attachments where id = 'dddddddd-0000-4000-8000-000000000001' returning id$$,
  'CR cannot delete another section''s attachments');

-- ── denied writes left the row intact ────────────────────────────────────────
reset role;
select is(
  (select filename from public.attachments where id = 'dddddddd-0000-4000-8000-000000000001'),
  'notes.pdf', 'section A attachment still exists with its original name');

select * from finish();
rollback;
