# Key Rotation Steps — ClassHub

Critical: rotate any keys that were committed or otherwise exposed (service_role, VAPID private key, anon if you consider it compromised).

Pre-flight checklist
- Identify all exposed secrets (e.g., old `.env` commit, `.env.example` earlier).
- Notify team and schedule short downtime if rotating service_role key.
- Ensure you have access to Supabase project dashboard and Vercel (or hosting) environment settings.

Rotation steps (Supabase service_role key)
1. Open Supabase project → Settings → API → Project API Keys.
2. Click "Regenerate Service Role Key" (or create new API key). Copy new key.
3. Update server-side environments:
   - Supabase Edge Functions: update secret `SUPABASE_SERVICE_ROLE_KEY` in each function's settings.
   - CI / GitHub Actions: update repository secret (e.g., `SUPABASE_SERVICE_ROLE_KEY`).
   - Any server runtime (self-hosted servers, MCP, etc.): update env and redeploy.
4. Deploy/restart all services that use the service_role key (edge functions, server processes).
5. Verify functions work: trigger function that requires service_role and confirm no auth error.
6. Revoke old key if dashboard provides that option; otherwise rotate and let old key expire per policy.

Rotation steps (VAPID / Web Push private key)
1. Generate new VAPID key pair. Example (node):

```js
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log(keys);
```

2. Update VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in:
   - Supabase Edge Functions that send push notifications.
   - CI / hosting secrets if functions built at deploy time.
3. Redeploy edge functions.
4. Verify push flow: subscribe a test client and send test push.
5. Revoke old key/rotate in application logic if you store allowed keys list.

Rotation steps (anon/public key)
- Anon key generally safe to remain public; rotate if compromised or to be safe.
- To rotate: Regenerate anon key in Supabase dashboard and update `VITE_SUPABASE_ANON_KEY` in `.env` for local dev and in hosting envs (Vercel), then rebuild client.

Git hygiene (if secrets were committed)
1. Consider purging secrets from git history using `git filter-repo` or `bfg`.
2. If you choose to purge, coordinate with team (force-push required). Example with `git filter-repo`:

```bash
pip install git-filter-repo
git clone --mirror git@github.com:org/repo.git
cd repo.git
git filter-repo --invert-paths --path .env
git push --force --all
git push --force --tags
```

3. After history rewrite, rotate any keys that were exposed (service_role, VAPID private keys) — assume exposure.

Post-rotation verification
- Run unit and integration tests.
- Manually test CR flows, push notifications, and RPCs that require service_role.
- Ensure CI builds succeed and that environment variables are present in hosting provider.

Notes & best practices
- Never store private keys in client-side code or `.env.example`.
- Use scoped secrets per environment (dev/test/prod).
- Keep short expiry and rotate periodically (90 days recommended for service_role keys).
- Use audit logs (Supabase, Vercel) to track when keys were changed.

If you want, I can:
- Generate a concrete `gh` or GitHub Actions workflow snippet to update secrets.
- Produce exact `git filter-repo` commands tailored to your repo.
- Create a small script to rotate VAPID keys and update function envs programmatically (requires provider API access).
