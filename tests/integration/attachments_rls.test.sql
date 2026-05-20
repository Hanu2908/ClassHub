-- ============================================================================
-- Attachments RLS Integration Test
-- ============================================================================
-- This SQL script tests Row-Level Security policies for the attachments table
-- and the private 'attachments' storage bucket.
--
-- Prerequisites:
--   1. Run against a disposable test database with all migrations applied.
--   2. Requires pgTAP extension for structured assertions.
--   3. Never run against production data.
--
-- Usage:
--   psql postgresql://user:pass@localhost:5432/testdb -f tests/integration/attachments_rls.test.sql
-- ============================================================================

BEGIN;

-- ── Setup: Create test sections and users ────────────────────────────────────

-- Section A
INSERT INTO public.sections (id, name, invite_code, college, created_by)
VALUES ('sec-aaa-111', 'Test Section A', 'AAAA01', 'SKIT', NULL)
ON CONFLICT (id) DO NOTHING;

-- Section B
INSERT INTO public.sections (id, name, invite_code, college, created_by)
VALUES ('sec-bbb-222', 'Test Section B', 'BBBB01', 'SKIT', NULL)
ON CONFLICT (id) DO NOTHING;

-- User Alpha (CR, Section A)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES (
  'usr-alpha-cr-aaa',
  'alpha@skit.ac.in',
  crypt('testpass', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Alpha CR"}',
  NOW(), NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, section_id, section_roll, university_roll)
VALUES ('usr-alpha-cr-aaa', 'alpha@skit.ac.in', 'Alpha CR', 'cr', 'sec-aaa-111', '01', '25ESKCX001')
ON CONFLICT (id) DO NOTHING;

-- User Beta (Student, Section A)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES (
  'usr-beta-stu-aaa',
  'beta@skit.ac.in',
  crypt('testpass', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Beta Student"}',
  NOW(), NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, section_id, section_roll, university_roll)
VALUES ('usr-beta-stu-aaa', 'beta@skit.ac.in', 'Beta Student', 'student', 'sec-aaa-111', '02', '25ESKCX002')
ON CONFLICT (id) DO NOTHING;

-- User Gamma (Student, Section B — cross-section isolation test)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES (
  'usr-gamma-stu-bbb',
  'gamma@skit.ac.in',
  crypt('testpass', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Gamma Student"}',
  NOW(), NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, section_id, section_roll, university_roll)
VALUES ('usr-gamma-stu-bbb', 'gamma@skit.ac.in', 'Gamma Student', 'student', 'sec-bbb-222', '01', '25ESKCX003')
ON CONFLICT (id) DO NOTHING;

-- Create a test announcement in Section A
INSERT INTO public.announcements (id, title, message_content, priority, section_id, author_id)
VALUES ('ann-test-001', 'Test Announcement', 'Test body', 'general', 'sec-aaa-111', 'usr-alpha-cr-aaa')
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: CR can insert attachment for own section ─────────────────────────

-- Simulate as Alpha (CR, Section A)
SET LOCAL request.jwt.claims = '{"sub": "usr-alpha-cr-aaa", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

INSERT INTO public.attachments (id, section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
VALUES ('att-test-001', 'sec-aaa-111', 'ann-test-001', 'notes.pdf', 'application/pdf', 102400, 'sec-aaa-111/announcement/ann-test-001/notes.pdf', 'usr-alpha-cr-aaa');

-- Verify insertion succeeded
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM public.attachments WHERE id = 'att-test-001') = 1,
    'TEST 1 FAILED: CR should be able to insert attachment for own section';
  RAISE NOTICE 'TEST 1 PASSED: CR can insert attachment for own section';
END $$;

-- ── Test 2: Student in same section CAN read the attachment ──────────────────

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub": "usr-beta-stu-aaa", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  _count int;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.attachments WHERE id = 'att-test-001';
  ASSERT _count = 1,
    'TEST 2 FAILED: Student in same section should be able to read attachment';
  RAISE NOTICE 'TEST 2 PASSED: Student in same section can read attachment';
END $$;

-- ── Test 3: Student in different section CANNOT read the attachment ───────────

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub": "usr-gamma-stu-bbb", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  _count int;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.attachments WHERE id = 'att-test-001';
  ASSERT _count = 0,
    'TEST 3 FAILED: Student from another section should NOT see attachment from section A';
  RAISE NOTICE 'TEST 3 PASSED: Cross-section isolation verified — user cannot read other section attachments';
END $$;

-- ── Test 4: Student from Section B CANNOT insert attachment into Section A ───

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub": "usr-gamma-stu-bbb", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.attachments (id, section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    VALUES ('att-test-hack', 'sec-aaa-111', 'ann-test-001', 'hack.pdf', 'application/pdf', 1024, 'hack/path', 'usr-gamma-stu-bbb');
    RAISE EXCEPTION 'TEST 4 FAILED: Should not be able to insert attachment into another section';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 4 PASSED: Cross-section insert blocked by RLS';
  END;
END $$;

-- ── Test 5: Uploader identity is verified (cannot impersonate another user) ──

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub": "usr-beta-stu-aaa", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    -- Student Beta tries to upload as Alpha (CR)
    INSERT INTO public.attachments (id, section_id, announcement_id, filename, file_type, file_size, storage_path, uploaded_by)
    VALUES ('att-test-impersonate', 'sec-aaa-111', 'ann-test-001', 'fake.pdf', 'application/pdf', 1024, 'fake/path', 'usr-alpha-cr-aaa');
    RAISE EXCEPTION 'TEST 5 FAILED: Should not be able to impersonate another user for uploaded_by';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 5 PASSED: Upload impersonation blocked — uploaded_by must match auth.uid()';
  END;
END $$;

-- ── Cleanup ──────────────────────────────────────────────────────────────────

ROLLBACK;

-- Summary
DO $$ BEGIN RAISE NOTICE '
============================================================
  Attachments RLS Integration Tests Complete
  All tests use ROLLBACK — no permanent data was written.
============================================================';
END $$;
