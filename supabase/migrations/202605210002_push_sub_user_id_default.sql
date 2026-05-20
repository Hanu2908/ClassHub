-- Auto-set user_id on push_subscriptions insert so frontend
-- doesn't need to pass it explicitly. RLS already enforces
-- user_id = auth.uid(), this just makes the INSERT cleaner.
ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_id SET DEFAULT auth.uid();
