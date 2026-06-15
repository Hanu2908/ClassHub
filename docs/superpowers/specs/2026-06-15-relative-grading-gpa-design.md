# Design Spec: Relative Grading Engine for GPA Calculator

**Project:** ClassHub  
**Date:** 2026-06-15  
**Status:** Draft / Proposal  

---

## 1. Problem Statement
SKIT Jaipur operates under a **Relative Grading System** where the grade boundaries ($O$, $A+$, $A$, $B+$, $B$, etc.) for each course are calculated dynamically based on the class average (mean, $\mu$) and spread (standard deviation, $\sigma$). 

Currently, the ClassHub GPA Calculator relies on a static absolute scale (`GRADE_SCALE`), which leads to discrepancies between calculated SGPAs (e.g., $8.05$) and the official grade sheets (e.g., $7.76$).

---

## 2. Technical Architecture

Since Row-Level Security (RLS) blocks students from directly querying other students' GPA entries (`auth.uid() = user_id`), we will implement a secure Database Stored Procedure (RPC) with `SECURITY DEFINER` privileges. This allows aggregation across the section without exposing any individual student's grades or identity.

### 1. Database Migration: `20260615020000_relative_gpa_stats.sql`

```sql
-- Create RPC function to fetch aggregated subject stats for the caller's section
CREATE OR REPLACE FUNCTION get_section_gpa_stats(p_semester INT)
RETURNS TABLE (
  subject_name TEXT,
  mean_marks NUMERIC,
  stddev_marks NUMERIC,
  total_count INT
) 
SECURITY DEFINER -- Bypasses SELECT RLS safely
SET search_path = public
AS $$
DECLARE
  v_caller_section_id UUID;
BEGIN
  -- 1. Identify caller's section to enforce section scoping
  SELECT section_id INTO v_caller_section_id
  FROM users
  WHERE id = auth.uid();

  IF v_caller_section_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User not found in any section';
  END IF;

  -- 2. Extract and aggregate marks
  RETURN QUERY
  WITH expanded_subjects AS (
    SELECT 
      (sub_elem->>'name')::TEXT as s_name,
      (sub_elem->>'marks')::NUMERIC as s_marks
    FROM user_gpa_data gd
    JOIN users u ON gd.user_id = u.id
    -- Group by the semester string key in the JSONB object
    CROSS JOIN LATERAL jsonb_extract_path(gd.gpa_state, 'semesters', p_semester::TEXT, 'subjects') AS sub_arr
    CROSS JOIN LATERAL jsonb_to_recordset(sub_arr) AS sub_elem(name TEXT, marks NUMERIC)
    WHERE u.section_id = v_caller_section_id
      AND sub_elem.marks IS NOT NULL
  )
  SELECT 
    s_name,
    ROUND(AVG(s_marks), 2) as mean_marks,
    COALESCE(ROUND(STDDEV_SAMP(s_marks), 2), 0.00) as stddev_marks,
    COUNT(s_marks)::INT as total_count
  FROM expanded_subjects
  GROUP BY s_name;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Frontend Grade Computation Heuristic

We will update [gpaData.ts](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/lib/gpaData.ts) to support relative grade mappings when class statistics are available:

```typescript
export interface SubjectStats {
  mean: number;
  stddev: number;
  total: number;
}

/** 
 * Maps marks to relative grades using standard Z-score statistical boundaries.
 * Falls back to absolute grading if class sample size is too small (e.g. < 5 submissions).
 */
export function marksToRelativeGrade(
  marks: number | null, 
  stats?: SubjectStats
): { label: string; point: number; color: string } {
  const absoluteFallback = marksToGrade(marks);
  if (marks === null || !stats || stats.total < 5) {
    return absoluteFallback;
  }

  // Enforce absolute fail limit (must score >= 40 marks to pass)
  if (marks < 40) {
    return { label: 'F', point: 0, color: '#F87171' };
  }

  const { mean, stddev } = stats;
  // If no spread, return fallback absolute grade
  if (stddev === 0) return absoluteFallback;

  const z = (marks - mean) / stddev;

  // Standard RTU/SKIT Relative Grading Z-Score mapping
  if (z >= 1.5)  return { label: 'O',  point: 10, color: '#4ADE80' };
  if (z >= 1.0)  return { label: 'A+', point:  9, color: '#818CF8' };
  if (z >= 0.5)  return { label: 'A',  point:  8, color: '#60A5FA' };
  if (z >= 0.0)  return { label: 'B+', point:  7, color: '#67E8F9' };
  if (z >= -0.5) return { label: 'B',  point:  6, color: '#34C6D3' };
  if (z >= -1.0) return { label: 'C',  point:  5, color: '#FCD34D' };
  return { label: 'P', point:  4, color: '#F97316' }; // z < -1.0 and marks >= 40
}
```

---

## 4. Integration Plan

1.  **Toggle Option**: Add a toggle in the GPA Calculator UI: `"Use Relative Grading (Class Stats)"` (disabled or hidden if class stats are unavailable).
2.  **Fetch Trigger**: When the calculator loads or a semester changes, call the RPC:
    ```typescript
    const { data: statsData } = await supabase.rpc('get_section_gpa_stats', { p_semester: sem });
    ```
3.  **Real-time Recalculation**: If enabled, map the marks using `marksToRelativeGrade(marks, stats)` instead of `marksToGrade(marks)`. This dynamically aligns calculated SGPA/CGPA with official relative results.
