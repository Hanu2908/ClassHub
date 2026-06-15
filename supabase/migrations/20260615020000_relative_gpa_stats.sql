-- Migration: 20260615020000_relative_gpa_stats.sql
-- Description: Create get_section_gpa_stats SECURITY DEFINER RPC to safely calculate section-wide grading metrics without exposing individual student rows.

CREATE OR REPLACE FUNCTION get_section_gpa_stats()
RETURNS TABLE (
  semester_num INT,
  subject_name TEXT,
  mean_marks NUMERIC,
  stddev_marks NUMERIC,
  total_count INT
) 
SECURITY DEFINER
SET search_path = '' -- Best practice: secure search path to prevent hijacking
AS $$
DECLARE
  v_caller_section_id UUID;
BEGIN
  -- Get the caller's section_id (caching auth.uid() by selecting into variable or using subquery)
  SELECT u.section_id INTO v_caller_section_id
  FROM public.users u
  WHERE u.id = (SELECT auth.uid());

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User not found in any section';
  END IF;

  RETURN QUERY
  WITH expanded_subjects AS (
    SELECT 
      sem_num::INT as s_sem,
      (sub_elem->>'name')::TEXT as s_name,
      (sub_elem->>'marks')::NUMERIC as s_marks
    FROM public.user_gpa_data gd
    JOIN public.users u ON gd.user_id = u.id
    -- Extract semesters and subjects safely
    CROSS JOIN LATERAL pg_catalog.jsonb_each(gd.gpa_state->'semesters') AS sem(sem_num, sem_val)
    CROSS JOIN LATERAL pg_catalog.jsonb_to_recordset(sem_val->'subjects') AS sub_elem(name TEXT, marks NUMERIC)
    WHERE u.section_id = v_caller_section_id
      AND sub_elem.marks IS NOT NULL
  )
  SELECT 
    s_sem,
    s_name,
    ROUND(AVG(s_marks), 2) as mean_marks,
    COALESCE(ROUND(STDDEV_SAMP(s_marks), 2), 0.00) as stddev_marks,
    COUNT(s_marks)::INT as total_count
  FROM expanded_subjects
  GROUP BY s_sem, s_name;
END;
$$ LANGUAGE plpgsql;

-- Restrict execution privilege to authenticated users only
REVOKE EXECUTE ON FUNCTION public.get_section_gpa_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_section_gpa_stats() TO authenticated;
