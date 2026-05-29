-- Migration: 20260529180000_multi_cr_identity
-- ADR-018: Multi-CR Identity + Transfer System
-- Two-tier CR model: primary (1 per section) + co (max 2), max 3 CRs total.
-- All CR management goes through SECURITY DEFINER RPCs, never direct writes.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Drop the single-CR constraint from migration 202605200002
-- ═══════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS users_section_single_cr_idx;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Add cr_rank column to users table
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cr_rank text;

-- cr_rank must be 'primary' or 'co' only
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS cr_rank_valid_values;
ALTER TABLE public.users
  ADD CONSTRAINT cr_rank_valid_values CHECK (cr_rank IS NULL OR cr_rank IN ('primary', 'co'));

-- cr_rank only makes sense when role = 'cr'
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS cr_rank_requires_cr_role;
ALTER TABLE public.users
  ADD CONSTRAINT cr_rank_requires_cr_role CHECK (cr_rank IS NULL OR role = 'cr');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Backfill: existing CRs become primary
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.users
SET cr_rank = 'primary'
WHERE role = 'cr' AND cr_rank IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Unique index: exactly 1 primary CR per section
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS one_primary_cr_per_section
  ON public.users (section_id)
  WHERE role = 'cr' AND cr_rank = 'primary';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Trigger: max 3 CRs per section
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_cr_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check when a user is being made a CR
  IF new.role = 'cr' THEN
    IF (
      SELECT count(*) FROM public.users
      WHERE section_id = new.section_id
        AND role = 'cr'
        AND id != new.id
    ) >= 3 THEN
      RAISE EXCEPTION 'Section cannot have more than 3 CRs';
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cr_limit ON public.users;
CREATE TRIGGER enforce_cr_limit
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.check_cr_limit();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. cr_transfer_log — Full audit trail for every CR change
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cr_transfer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id),
  actor_id uuid NOT NULL REFERENCES public.users(id),
  target_id uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL CHECK (action IN (
    'promoted_to_primary',
    'promoted_to_co',
    'demoted_to_student',
    'resigned'
  )),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_transfer_log_section_idx
  ON public.cr_transfer_log (section_id, created_at DESC);

ALTER TABLE public.cr_transfer_log ENABLE ROW LEVEL SECURITY;

-- RLS: CRs can read their section's audit log
DROP POLICY IF EXISTS "cr_read_transfer_log" ON public.cr_transfer_log;
CREATE POLICY "cr_read_transfer_log"
  ON public.cr_transfer_log
  FOR SELECT
  TO authenticated
  USING (
    section_id = public.current_user_section_id()
    AND public.current_user_role() = 'cr'
  );

-- No direct INSERT/UPDATE/DELETE — only RPCs write to this table

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Helper: is_primary_cr_for_section()
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_primary_cr_for_section(target_section uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role = 'cr'
      AND cr_rank = 'primary'
      AND section_id = target_section
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RPC: transfer_primary_cr
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transfer_primary_cr(
  new_primary_id uuid,
  old_cr_action text DEFAULT 'become_student'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_section uuid;
  target_section uuid;
  target_role text;
BEGIN
  caller_id := (SELECT auth.uid());

  -- Validate caller is primary CR
  SELECT section_id INTO caller_section
  FROM public.users
  WHERE id = caller_id AND role = 'cr' AND cr_rank = 'primary';

  IF caller_section IS NULL THEN
    RAISE EXCEPTION 'Only the primary CR can transfer the primary role';
  END IF;

  -- Validate old_cr_action
  IF old_cr_action NOT IN ('become_student', 'become_co_cr') THEN
    RAISE EXCEPTION 'old_cr_action must be become_student or become_co_cr';
  END IF;

  -- Cannot transfer to yourself
  IF new_primary_id = caller_id THEN
    RAISE EXCEPTION 'Cannot transfer primary to yourself';
  END IF;

  -- Validate target is in the same section
  SELECT section_id, role INTO target_section, target_role
  FROM public.users
  WHERE id = new_primary_id;

  IF target_section IS NULL OR target_section != caller_section THEN
    RAISE EXCEPTION 'Target user must be in the same section';
  END IF;

  -- Check co-CR limit if the old primary wants to become co-CR
  IF old_cr_action = 'become_co_cr' THEN
    -- After transfer: target becomes primary, caller becomes co.
    -- Count how many CRs there will be (excluding caller who stays CR, and target who becomes CR)
    IF (
      SELECT count(*) FROM public.users
      WHERE section_id = caller_section
        AND role = 'cr'
        AND id NOT IN (caller_id, new_primary_id)
    ) >= 2 THEN
      -- caller + target + 2 others = 4, exceeds max 3
      RAISE EXCEPTION 'Section would exceed 3 CRs. Demote a co-CR first.';
    END IF;
  END IF;

  -- Atomic swap: demote old primary
  IF old_cr_action = 'become_student' THEN
    UPDATE public.users
    SET role = 'student', cr_rank = NULL
    WHERE id = caller_id;
  ELSE
    UPDATE public.users
    SET cr_rank = 'co'
    WHERE id = caller_id;
  END IF;

  -- Promote new primary
  UPDATE public.users
  SET role = 'cr', cr_rank = 'primary'
  WHERE id = new_primary_id;

  -- Audit log
  INSERT INTO public.cr_transfer_log (section_id, actor_id, target_id, action, note)
  VALUES (caller_section, caller_id, new_primary_id, 'promoted_to_primary',
    'Primary transferred from ' || caller_id || '. Old primary action: ' || old_cr_action);

  IF old_cr_action = 'become_student' THEN
    INSERT INTO public.cr_transfer_log (section_id, actor_id, target_id, action, note)
    VALUES (caller_section, caller_id, caller_id, 'demoted_to_student', 'Stepped down during primary transfer');
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. RPC: promote_to_co_cr
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.promote_to_co_cr(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_section uuid;
  target_section uuid;
  target_role text;
  co_count integer;
BEGIN
  caller_id := (SELECT auth.uid());

  -- Validate caller is primary CR
  SELECT section_id INTO caller_section
  FROM public.users
  WHERE id = caller_id AND role = 'cr' AND cr_rank = 'primary';

  IF caller_section IS NULL THEN
    RAISE EXCEPTION 'Only the primary CR can promote co-CRs';
  END IF;

  -- Cannot promote yourself
  IF target_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot promote yourself to co-CR';
  END IF;

  -- Validate target is in the same section and is a student
  SELECT section_id, role INTO target_section, target_role
  FROM public.users
  WHERE id = target_user_id;

  IF target_section IS NULL OR target_section != caller_section THEN
    RAISE EXCEPTION 'Target user must be in the same section';
  END IF;

  IF target_role = 'cr' THEN
    RAISE EXCEPTION 'User is already a CR';
  END IF;

  -- Check co-CR limit (max 2 co-CRs)
  SELECT count(*) INTO co_count
  FROM public.users
  WHERE section_id = caller_section
    AND role = 'cr'
    AND cr_rank = 'co';

  IF co_count >= 2 THEN
    RAISE EXCEPTION 'Section already has the maximum 2 co-CRs';
  END IF;

  -- Promote
  UPDATE public.users
  SET role = 'cr', cr_rank = 'co'
  WHERE id = target_user_id;

  -- Audit log
  INSERT INTO public.cr_transfer_log (section_id, actor_id, target_id, action, note)
  VALUES (caller_section, caller_id, target_user_id, 'promoted_to_co', NULL);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. RPC: demote_co_cr
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.demote_co_cr(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_section uuid;
  target_section uuid;
  target_rank text;
BEGIN
  caller_id := (SELECT auth.uid());

  -- Validate caller is primary CR
  SELECT section_id INTO caller_section
  FROM public.users
  WHERE id = caller_id AND role = 'cr' AND cr_rank = 'primary';

  IF caller_section IS NULL THEN
    RAISE EXCEPTION 'Only the primary CR can demote co-CRs';
  END IF;

  -- Cannot demote yourself
  IF target_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot demote yourself. Use resign_as_cr() instead.';
  END IF;

  -- Validate target is a co-CR in the same section
  SELECT section_id, cr_rank INTO target_section, target_rank
  FROM public.users
  WHERE id = target_user_id AND role = 'cr';

  IF target_section IS NULL OR target_section != caller_section THEN
    RAISE EXCEPTION 'Target must be a CR in the same section';
  END IF;

  IF target_rank != 'co' THEN
    RAISE EXCEPTION 'Can only demote co-CRs. Use transfer_primary_cr for the primary.';
  END IF;

  -- Demote
  UPDATE public.users
  SET role = 'student', cr_rank = NULL
  WHERE id = target_user_id;

  -- Audit log
  INSERT INTO public.cr_transfer_log (section_id, actor_id, target_id, action, note)
  VALUES (caller_section, caller_id, target_user_id, 'demoted_to_student', NULL);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. RPC: resign_as_cr
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resign_as_cr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_section uuid;
  caller_rank text;
BEGIN
  caller_id := (SELECT auth.uid());

  -- Validate caller is a CR
  SELECT section_id, cr_rank INTO caller_section, caller_rank
  FROM public.users
  WHERE id = caller_id AND role = 'cr';

  IF caller_section IS NULL THEN
    RAISE EXCEPTION 'You are not a CR';
  END IF;

  -- Primary must transfer before resigning
  IF caller_rank = 'primary' THEN
    RAISE EXCEPTION 'Primary CR must transfer the role before resigning. Use transfer_primary_cr() first.';
  END IF;

  -- Resign
  UPDATE public.users
  SET role = 'student', cr_rank = NULL
  WHERE id = caller_id;

  -- Audit log
  INSERT INTO public.cr_transfer_log (section_id, actor_id, target_id, action, note)
  VALUES (caller_section, caller_id, caller_id, 'resigned', NULL);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. Update create_section_hub() to set cr_rank = 'primary'
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_section_hub(section_name text, invite text, class_roll text, uni_roll text)
RETURNS public.sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
  current_name text;
  created_section public.sections;
BEGIN
  SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  INTO current_email, current_name
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT public.is_skit_email(current_email) THEN
    RAISE EXCEPTION 'Only @skit.ac.in accounts can create a ClassHub section';
  END IF;

  -- 1. Create section WITHOUT created_by (avoids FK violation since user row doesn't exist yet)
  INSERT INTO public.sections (name, invite_code)
  VALUES (upper(section_name), upper(invite))
  RETURNING * INTO created_section;

  -- 2. Create user row (or update if exists) with CR role + primary rank
  INSERT INTO public.users (id, name, email, role, cr_rank, section_id, section_roll, university_roll)
  VALUES (auth.uid(), current_name, current_email, 'cr', 'primary', created_section.id, class_roll, upper(uni_roll))
  ON CONFLICT (id) DO UPDATE
    SET role = 'cr',
        cr_rank = 'primary',
        section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        updated_at = now();

  -- 3. NOW set created_by (user row exists, FK is satisfied)
  UPDATE public.sections
  SET created_by = auth.uid()
  WHERE id = created_section.id;

  -- Re-fetch to return the updated row with created_by set
  SELECT * INTO created_section FROM public.sections WHERE id = created_section.id;

  RETURN created_section;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. Add realtime publication for cr_transfer_log
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cr_transfer_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
