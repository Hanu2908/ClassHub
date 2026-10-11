-- acknowledgments, announcement_comments, announcement_reactions: members
-- engage only with their own section's announcements, as themselves; CRs
-- verify and moderate their own section only.
-- Latest policies: 20260523114500 (acks), 20260606000000 (comments, reactions).
-- TODO tests mark known policy gaps; they pass the suite until the policy is fixed.
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 't_sa1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 't_sa2@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 't_sb1@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 't_ca@skit.ac.in'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 't_cb@skit.ac.in');

insert into public.sections (id, name, invite_code) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'TEST-A', 'T1AAAA'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'TEST-B', 'T2BBBB');

insert into public.users (id, name, email, role, cr_rank, section_id, section_roll) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SA1', 't_sa1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '01'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'SA2', 't_sa2@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000a', '02'),
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'CA', 't_ca@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000a', '03'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'SB1', 't_sb1@skit.ac.in', 'student', null, 'bbbbbbbb-0000-4000-8000-00000000000b', '01'),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'CB', 't_cb@skit.ac.in', 'cr', 'primary', 'bbbbbbbb-0000-4000-8000-00000000000b', '02');

insert into public.announcements (id, section_id, author_id, title, message_content, priority) values
  ('cccccccc-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'A notice', 'for A', 'critical'),
  ('cccccccc-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000c2', 'B notice', 'for B', 'critical');

insert into public.acknowledgments (id, announcement_id, user_id) values
  ('dddddddd-0000-4000-8000-0000000000b1', 'cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000002');

insert into public.announcement_comments (id, announcement_id, author_id, content) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'question from SA1'),
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000003', 'question from SA2'),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000002', 'question from SB1');

insert into public.announcement_reactions (id, announcement_id, user_id, emoji) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'up'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000002', 'up');

-- ── student, section A ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

-- acknowledgments
select lives_ok(
  $$insert into public.acknowledgments (announcement_id, user_id)
    values ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  'student acknowledges an own section announcement');
select throws_ok(
  $$insert into public.acknowledgments (announcement_id, user_id)
    values ('cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'student cannot acknowledge another section''s announcement');
select throws_ok(
  $$insert into public.acknowledgments (announcement_id, user_id)
    values ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000003')$$,
  '42501', null, 'student cannot acknowledge on behalf of a classmate');
select is_empty(
  $$select id from public.acknowledgments where id = 'dddddddd-0000-4000-8000-0000000000b1'$$,
  'student cannot read another section''s acknowledgments');
select is_empty(
  $$delete from public.acknowledgments where id = 'dddddddd-0000-4000-8000-0000000000b1' returning id$$,
  'student cannot delete another section''s acknowledgment');

-- comments
select results_eq(
  $$select count(*) from public.announcement_comments where id in
    ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000003')$$,
  array[2::bigint], 'student reads own section comments');
select is_empty(
  $$select id from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'student cannot read another section''s comments');
select throws_ok(
  $$insert into public.announcement_comments (announcement_id, author_id, content)
    values ('cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, 'student cannot comment on another section''s announcement');
select throws_ok(
  $$insert into public.announcement_comments (announcement_id, author_id, content, is_verified)
    values ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'x', true)$$,
  '42501', null, 'student cannot post a pre-verified comment');
select throws_ok(
  $$insert into public.announcement_comments (announcement_id, author_id, content)
    values ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000003', 'x')$$,
  '42501', null, 'student cannot comment as a classmate');
select results_eq(
  $$update public.announcement_comments set content = 'edited by SA1'
    where id = 'dddddddd-0000-4000-8000-000000000001' returning content::text$$,
  array['edited by SA1'], 'student edits own comment inside the 15 minute window');
select is_empty(
  $$update public.announcement_comments set content = 'hacked'
    where id = 'dddddddd-0000-4000-8000-000000000003' returning id$$,
  'student cannot edit a classmate''s comment');
select throws_ok(
  $$update public.announcement_comments set is_verified = true where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot verify own comment');
select throws_ok(
  $$update public.announcement_comments set author_id = 'aaaaaaaa-0000-4000-8000-000000000003'
    where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot reassign own comment to a classmate');
select is_empty(
  $$delete from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000003' returning id$$,
  'student cannot delete a classmate''s comment');
select is_empty(
  $$delete from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'student cannot delete another section''s comment');

-- reactions
select is_empty(
  $$select id from public.announcement_reactions where id = 'eeeeeeee-0000-4000-8000-000000000002'$$,
  'student cannot read another section''s reactions');
select throws_ok(
  $$insert into public.announcement_reactions (announcement_id, user_id, emoji)
    values ('cccccccc-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000001', 'up')$$,
  '42501', null, 'student cannot react to another section''s announcement');
select throws_ok(
  $$insert into public.announcement_reactions (announcement_id, user_id, emoji)
    values ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000003', 'up')$$,
  '42501', null, 'student cannot react as a classmate');
select results_eq(
  $$update public.announcement_reactions set emoji = 'party'
    where id = 'eeeeeeee-0000-4000-8000-000000000001' returning emoji$$,
  array['party'], 'student changes own reaction');
select is_empty(
  $$update public.announcement_reactions set emoji = 'down'
    where id = 'eeeeeeee-0000-4000-8000-000000000002' returning id$$,
  'student cannot change another section''s reaction');
select is_empty(
  $$delete from public.announcement_reactions where id = 'eeeeeeee-0000-4000-8000-000000000002' returning id$$,
  'student cannot delete another section''s reaction');

-- ── CR, section A ────────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';

select results_eq(
  $$select count(*) from public.acknowledgments where announcement_id = 'cccccccc-0000-4000-8000-0000000000a1'$$,
  array[1::bigint], 'CR reads own section acknowledgments');
select is_empty(
  $$select id from public.acknowledgments where id = 'dddddddd-0000-4000-8000-0000000000b1'$$,
  'CR cannot read another section''s acknowledgments');
select results_eq(
  $$update public.announcement_comments set is_verified = true
    where id = 'dddddddd-0000-4000-8000-000000000003' returning is_verified$$,
  array[true], 'CR verifies a comment in own section');
select is_empty(
  $$update public.announcement_comments set is_verified = true
    where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'CR cannot verify another section''s comment');
select is_empty(
  $$delete from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000002' returning id$$,
  'CR cannot delete another section''s comment');

-- ── verified lockout for the author ──────────────────────────────────────────
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000003';
select is_empty(
  $$delete from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000003' returning id$$,
  'author cannot delete own comment once verified');

-- ── denied writes left the rows intact ───────────────────────────────────────
reset role;
select is(
  (select content::text || '/' || is_verified::text from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000002'),
  'question from SB1/false', 'section B comment is unchanged');
select is(
  (select content::text from public.announcement_comments where id = 'dddddddd-0000-4000-8000-000000000003'),
  'question from SA2', 'classmate comment content is unchanged');
select is(
  (select emoji from public.announcement_reactions where id = 'eeeeeeee-0000-4000-8000-000000000002'),
  'up', 'section B reaction is unchanged');
select results_eq(
  $$select count(*) from public.acknowledgments where id = 'dddddddd-0000-4000-8000-0000000000b1'$$,
  array[1::bigint], 'section B acknowledgment still exists');

-- ── known policy gaps ────────────────────────────────────────────────────────
-- authenticated_update_comments WITH CHECK compares columns with themselves
-- (id = id, announcement_id = announcement_id, content = content, ...), which
-- is always true, so it pins nothing.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select todo('gap: comment UPDATE WITH CHECK does not pin announcement_id', 1);
select throws_ok(
  $$update public.announcement_comments set announcement_id = 'cccccccc-0000-4000-8000-0000000000b1'
    where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  '42501', null, 'author cannot move own comment onto another section''s announcement');
select todo('gap: comment UPDATE WITH CHECK does not pin created_at, so the 15 minute window can be extended', 1);
select throws_ok(
  $$update public.announcement_comments set created_at = now() + interval '1 year'
    where id = 'dddddddd-0000-4000-8000-000000000001'$$,
  '42501', null, 'author cannot move created_at forward');
select todo('gap: reaction UPDATE WITH CHECK only pins user_id', 1);
select throws_ok(
  $$update public.announcement_reactions set announcement_id = 'cccccccc-0000-4000-8000-0000000000b1'
    where id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot move own reaction onto another section''s announcement');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select todo('gap: comment UPDATE WITH CHECK (content = content) lets a CR rewrite student comments', 1);
select throws_ok(
  $$update public.announcement_comments set content = 'rewritten by CR'
    where id = 'dddddddd-0000-4000-8000-000000000003'$$,
  '42501', null, 'CR cannot rewrite a student''s comment');

select * from finish();
rollback;
