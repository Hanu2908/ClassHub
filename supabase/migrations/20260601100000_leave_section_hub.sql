-- Migration: 20260601100000_leave_section_hub
-- Adds a leave_section_hub() RPC that detaches the calling user from their section.
-- This keeps the Supabase auth session alive but clears section membership,
-- allowing the user to join or create a new hub via the onboarding flow.

CREATE OR REPLACE FUNCTION public.leave_section_hub()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Detach user from section and reset to student role
  UPDATE public.users
  SET
    section_id         = NULL,
    role               = 'student',
    section_roll       = NULL,
    cr_rank            = NULL,
    notifications_enabled = false
  WHERE id = caller_id;
END;
$$;
