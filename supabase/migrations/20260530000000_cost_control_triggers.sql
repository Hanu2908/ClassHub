-- 1. Push Subscription Device Capping Trigger
CREATE OR REPLACE FUNCTION public.prune_stale_push_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user already has 5 or more push subscriptions
  IF (SELECT count(*) FROM public.push_subscriptions WHERE user_id = NEW.user_id) >= 5 THEN
    -- Delete the oldest one by created_at time
    DELETE FROM public.push_subscriptions
    WHERE id = (
      SELECT id FROM public.push_subscriptions
      WHERE user_id = NEW.user_id
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS before_insert_push_subscription ON public.push_subscriptions;
CREATE TRIGGER before_insert_push_subscription
  BEFORE INSERT ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prune_stale_push_subscriptions();


-- 2. Announcement Writing Rate Limiter Trigger
CREATE OR REPLACE FUNCTION public.enforce_announcement_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_writes INT;
BEGIN
  -- Count announcements created by the current authenticated user in the last minute
  SELECT count(*) INTO recent_writes
  FROM public.announcements
  WHERE author_id = auth.uid()
    AND created_at > (NOW() - INTERVAL '1 minute');

  IF recent_writes >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 announcements per minute.'
      USING ERRCODE = '42900';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS before_insert_announcement_rate_limit ON public.announcements;
CREATE TRIGGER before_insert_announcement_rate_limit
  BEFORE INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_announcement_rate_limit();


-- 3. Poll Writing Rate Limiter Trigger
CREATE OR REPLACE FUNCTION public.enforce_poll_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_writes INT;
BEGIN
  -- Count polls created by the current authenticated user in the last minute
  SELECT count(*) INTO recent_writes
  FROM public.polls
  WHERE created_by = auth.uid()
    AND created_at > (NOW() - INTERVAL '1 minute');

  IF recent_writes >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 polls per minute.'
      USING ERRCODE = '42900';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS before_insert_poll_rate_limit ON public.polls;
CREATE TRIGGER before_insert_poll_rate_limit
  BEFORE INSERT ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_poll_rate_limit();
