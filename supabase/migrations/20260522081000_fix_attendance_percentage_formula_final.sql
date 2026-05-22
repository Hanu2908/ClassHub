-- Drop the percentage generated column and recreate it using the correct ERP mathematical formula:
-- Total held denominator must be: present + od + absent (excluding makeup)
ALTER TABLE public.attendance_records DROP COLUMN IF EXISTS percentage;

ALTER TABLE public.attendance_records ADD COLUMN percentage numeric(5,2) GENERATED ALWAYS AS (
  CASE WHEN (present + od + absent) = 0 THEN 0
    ELSE round(((present + od + makeup)::numeric / (present + od + absent)::numeric) * 100, 2)
  END
) STORED;
