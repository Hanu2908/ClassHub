-- Migration: 20260602000001_upsert_push_subscription_rpc
-- Resolves RLS 409 Conflict when a new user logs into a browser that already has a push subscription for the previous user.
-- By using a SECURITY DEFINER function, we bypass RLS to update the user_id of the existing subscription endpoint.

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  sub_endpoint text,
  sub_p256dh text,
  sub_auth text,
  sub_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), sub_endpoint, sub_p256dh, sub_auth, sub_user_agent)
  ON CONFLICT (endpoint) DO UPDATE
  SET 
    user_id = auth.uid(),
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now();
END;
$$;
