-- Migration: Fix Counsellor Notes Trigger Security Definer
-- Date: 2026-06-19

-- Redefine public.on_counsellor_notes_change to be SECURITY DEFINER with search_path = public
CREATE OR REPLACE FUNCTION public.on_counsellor_notes_change()
RETURNS TRIGGER AS $$
DECLARE
  student_sec uuid;
BEGIN
  SELECT section_id INTO student_sec FROM public.users WHERE id = NEW.student_id;

  -- A. Remark added or updated by counsellor
  IF (TG_OP = 'INSERT') OR (OLD.note_text IS DISTINCT FROM NEW.note_text) THEN
    INSERT INTO public.notification_events (section_id, recipient_id, actor_id, kind, target_table, target_id)
    VALUES (
      student_sec,
      NEW.student_id,
      NEW.counsellor_id,
      'counsellor_remark'::public.notification_kind,
      'counsellor_notes',
      NEW.id
    );
  END IF;

  -- B. Student response updated
  IF (TG_OP = 'UPDATE') AND (OLD.student_response IS DISTINCT FROM NEW.student_response) AND (NEW.student_response IS NOT NULL) THEN
    INSERT INTO public.notification_events (section_id, recipient_id, actor_id, kind, target_table, target_id)
    VALUES (
      student_sec,
      NEW.counsellor_id,
      NEW.student_id,
      'counsellor_remark_reply'::public.notification_kind,
      'counsellor_notes',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke direct execution permissions from standard roles
REVOKE EXECUTE ON FUNCTION public.on_counsellor_notes_change() FROM PUBLIC, anon, authenticated;
