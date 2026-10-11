RLS Integration Tests

Database policy tests live in `supabase/tests/*.test.sql` (pgTAP). CI runs them
on every PR and before every production migration deploy:

    supabase start
    supabase test db

Add a test there for every new table or policy. A policy without a test is not
done.
