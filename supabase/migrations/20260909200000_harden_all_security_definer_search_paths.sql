-- ============================================================================
-- Migration: Harden All SECURITY DEFINER Functions Search Path
-- Date: 2026-09-09
-- Purpose:
--   Enforce explicit, immutable search_path (public, pg_temp) on all
--   SECURITY DEFINER functions across the public schema to eliminate any
--   potential search_path hijack or privilege escalation vectors.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Iterate through every SECURITY DEFINER function in the public schema
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    -- Alter function to pin search_path strictly to public, pg_temp
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp;',
      r.schema_name,
      r.func_name,
      r.func_args
    );
  END LOOP;
END;
$$;
