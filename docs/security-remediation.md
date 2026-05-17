# Security Remediation — quick actions

This file documents the immediate remediation steps I applied and recommended next steps.

## Actions I applied now

- Removed the committed `.env` file from the repository to stop storing keys in source control.
- Replaced the permissive wildcard CORS in Supabase edge functions with a dynamic `getCorsHeaders(req)` implementation that limits allowed origins based on the `ALLOWED_ORIGINS` environment variable.
- Updated edge functions to call `getCorsHeaders(req)` and return the computed headers for both preflight and responses.

Files changed:

- `supabase/functions/_shared/cors.ts` — now exports `getCorsHeaders(req)` and no longer uses `*`.
- `supabase/functions/*` — updated to use `getCorsHeaders(req)`.

## Immediate next steps (requires human/console actions)

1. Rotate keys that may have been exposed (recommended order):
   - `SUPABASE_SERVICE_ROLE_KEY` — rotate immediately if it was stored in the removed `.env` or elsewhere in the repo or CI history.
   - `VAPID_PRIVATE_KEY` — rotate if it was stored in the repo.
   - `VITE_SUPABASE_ANON_KEY` — treat as public but rotate if you suspect compromise; replace in hosting environment.

2. Recreate a local `.env` for development but do NOT commit it. Add the file locally and keep `.env` in `.gitignore`.

3. Add `ALLOWED_ORIGINS` to your Supabase Function environment variables listing allowed origins (comma-separated), e.g. `https://yourapp.vercel.app, http://localhost:5173`.

4. Verify the Supabase project: check APIs and revoke any API keys that were exposed. Create new keys and update the deployed environment (Vercel, Supabase project secrets, GitHub Actions secrets).

5. (Optional) If you want the `.env` removal removed from git history, we can rewrite history (BFG or git filter-branch). This is destructive to history and requires coordination — ask me before proceeding.

6. Add CI validation to prevent commits that contain `VITE_` keys or other secrets, e.g. a GitHub Action that runs `git grep -n "VITE_" -- .` and fails on matches.

## Verification steps I ran

- Ran unit tests after code changes; tests passed (no regressions expected from CORS change because it only affects server functions).

## Notes / rationale

- The `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` are server-only secrets — they remain accessible only via `Deno.env.get(...)` in edge functions and are not exposed to the client bundle. Ensure they are set in the Supabase Function environment and not printed to logs.
- The `VITE_SUPABASE_ANON_KEY` is a public key intended for client use; it is safe to be in client bundles but should still not be committed to repository history; treat any committed keys as compromised and rotate.

If you're okay with the above I can:

- Create a branch and commit these fixes, then open a PR.
- Add a small GitHub Action to detect accidental `.env` or `VITE_` commits.
- Help rotate the exposed keys (I cannot rotate them myself — I'll provide exact steps and scripts you can run).

Please confirm how you'd like me to proceed (create PR, rotate keys, rewrite git history).
