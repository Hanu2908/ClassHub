RLS Integration Tests

This directory contains templates and SQL for running Row-Level Security (RLS)
integration tests against a disposable Postgres database (for example, a
Supabase project created specifically for CI).

Run instructions (manual):

1. Create a test Supabase project and apply the migrations from `supabase/migrations`.
2. Use a test account or set appropriate JWT claims to simulate different users.
3. Execute SQL scripts in this directory with `psql` or use pgTAP for structured assertions.

Example (local, postgres):

psql postgresql://user:pass@localhost:5432/testdb -f tests/integration/rls.test.sql

Notes:

- Do NOT run these tests against production or a database with real user data.
- Consider using pgTAP for reliable, CI-friendly assertions.
