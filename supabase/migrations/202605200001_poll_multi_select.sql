-- Migration: Support multi-select polls and vote changing

-- 1. Add allow_multiple column to polls table
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

-- 2. Drop old unique constraints (which forced exactly one vote per poll per student)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_poll_id_student_id_key;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_poll_id_anonymous_token_key;

-- 3. Add new unique constraints at the option level (allowing multiple options per poll, but only one vote per option)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_option_id_student_id_key;
DROP INDEX IF EXISTS public.votes_option_id_student_id_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_option_id_student_id_key UNIQUE (option_id, student_id);

ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_option_id_anonymous_token_key;
DROP INDEX IF EXISTS public.votes_option_id_anonymous_token_key;
ALTER TABLE public.votes ADD CONSTRAINT votes_option_id_anonymous_token_key UNIQUE (option_id, anonymous_token);

-- 4. Enable RLS DELETE and UPDATE policies on votes table
DROP POLICY IF EXISTS "Students delete own votes" ON public.votes;
CREATE POLICY "Students delete own votes" ON public.votes
FOR DELETE
TO authenticated
USING (
  student_id = auth.uid() OR 
  anonymous_token = calculate_anonymous_token(auth.uid(), poll_id)
);

DROP POLICY IF EXISTS "Students update own votes" ON public.votes;
CREATE POLICY "Students update own votes" ON public.votes
FOR UPDATE
TO authenticated
USING (
  student_id = auth.uid() OR 
  anonymous_token = calculate_anonymous_token(auth.uid(), poll_id)
)
WITH CHECK (
  student_id = auth.uid() OR 
  anonymous_token = calculate_anonymous_token(auth.uid(), poll_id)
);

-- 5. Create BEFORE INSERT trigger to enforce single-choice integrity when allow_multiple is false
CREATE OR REPLACE FUNCTION public.check_vote_multiplicity()
RETURNS trigger AS $$
DECLARE
  v_allow_multiple boolean;
BEGIN
  SELECT allow_multiple INTO v_allow_multiple
  FROM public.polls
  WHERE id = NEW.poll_id;

  IF NOT coalesce(v_allow_multiple, false) THEN
    -- Check for existing vote on this poll for the student
    IF NEW.student_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.votes
        WHERE poll_id = NEW.poll_id AND student_id = NEW.student_id
      ) THEN
        RAISE EXCEPTION 'Already voted on this single-choice poll';
      END IF;
    ELSIF NEW.anonymous_token IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.votes
        WHERE poll_id = NEW.poll_id AND anonymous_token = NEW.anonymous_token
      ) THEN
        RAISE EXCEPTION 'Already voted on this single-choice poll';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicates, then create
DROP TRIGGER IF EXISTS check_vote_multiplicity_trigger ON public.votes;
CREATE TRIGGER check_vote_multiplicity_trigger
BEFORE INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.check_vote_multiplicity();
