-- Migration: Add insights JSONB column to attendance_records
-- Date: 2026-08-10
-- Purpose: Store pre-computed attendance intelligence (day-of-week rates,
-- streaks, absence patterns) derived from class-level ERP data.
-- Edge computation model: all stats computed client-side, stored as compact JSON.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS insights jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.attendance_records.insights IS
  'Pre-computed attendance intelligence from class-level ERP data. '
  'Contains day-of-week attendance rates, streak info, and absence patterns. '
  'Schema version tracked via insights.version key.';
