-- Migration: Support transaction-safe section deletion
-- RLS-defended function that checks caller auth/CR role and detaches members safely before deleting section.

CREATE OR REPLACE FUNCTION public.delete_section_hub(target_section_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  is_cr boolean;
  sec_creator uuid;
BEGIN
  -- 1. Check authentication
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify authorization
  -- Only the section creator or a CR of this section can delete it
  SELECT created_by INTO sec_creator FROM public.sections WHERE id = target_section_id;
  SELECT (role = 'cr' AND section_id = target_section_id) INTO is_cr FROM public.users WHERE id = caller_id;
  
  IF sec_creator IS DISTINCT FROM caller_id AND NOT COALESCE(is_cr, false) THEN
    RAISE EXCEPTION 'Unauthorized: Only the CR or creator can delete this section';
  END IF;

  -- 3. Break circular reference in sections.created_by
  UPDATE public.sections SET created_by = NULL WHERE id = target_section_id;

  -- 4. Reset roles and section settings for all users in this section so they return to onboarding flow
  UPDATE public.users 
  SET 
    section_id = NULL,
    role = 'student',
    section_roll = NULL,
    university_roll = NULL,
    day_scholar = true,
    notifications_enabled = false
  WHERE section_id = target_section_id;

  -- 5. Delete the section (which will cascade to subjects, timetable_slots, announcements, assignments, polls, etc.)
  DELETE FROM public.sections WHERE id = target_section_id;
END;
$$;
