-- Migration: 20260527220000_enforce_submission_integrity
-- Prevents non-CR accounts from modifying the cr_verified column on their submissions.

CREATE OR REPLACE FUNCTION public.check_submission_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_section_id UUID;
BEGIN
  -- We only restrict column modification on UPDATE operations
  IF (TG_OP = 'UPDATE') THEN
    -- If cr_verified value is being changed
    IF (OLD.cr_verified IS DISTINCT FROM NEW.cr_verified) THEN
      -- Get section_id for the associated assignment
      SELECT section_id INTO v_section_id 
      FROM public.assignments 
      WHERE id = NEW.assignment_id;

      -- If the user is NOT a CR for this section, they cannot touch this column!
      IF NOT public.is_cr_for_section(v_section_id) THEN
        RAISE EXCEPTION 'Unauthorized: Students cannot modify CR verification status';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (idempotency safety)
DROP TRIGGER IF EXISTS enforce_submission_integrity ON public.submissions;

-- Create the trigger
CREATE TRIGGER enforce_submission_integrity
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_submission_integrity();
