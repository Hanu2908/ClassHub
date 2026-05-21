-- Drop the generated column and recreate it with the correct mathematical formula:
-- Denominator of regular classes held should be: present + od + absent.
-- Makeup classes are extra sessions attended to compensate for absences, so they only increase the numerator.

ALTER TABLE public.attendance_records DROP COLUMN IF EXISTS percentage;

ALTER TABLE public.attendance_records ADD COLUMN percentage numeric(5,2) GENERATED ALWAYS AS (
  CASE WHEN (present + od + absent) = 0 THEN 0
    ELSE round(((present + od + makeup)::numeric / (present + od + absent)::numeric) * 100, 2)
  END
) STORED;
