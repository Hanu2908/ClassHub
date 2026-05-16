# ClassHub Architecture

ClassHub is a mobile-first PWA for SKIT section coordination. The app uses React, Vite, TypeScript, Tailwind, shadcn-style primitives, Zustand, React Hook Form, Zod, Recharts, and Supabase.

## System Boundary

- Frontend reads and writes normal user data directly through Supabase with the publishable key.
- Supabase Auth provides Google OAuth. Only `@skit.ac.in` emails are accepted by database checks and onboarding RPCs.
- PostgreSQL stores all product data. RLS is the authorization layer.
- Edge Functions perform privileged server work: critical announcement pushes, acknowledgment nudges, and assignment reminders.
- Realtime is used for freshness, not authorization.

## Runtime Flow

1. User signs in through Google OAuth.
2. User joins or creates a section hub.
3. User profile is stored in `public.users`, keyed by `auth.users.id`.
4. Feature modules query through typed Supabase helpers.
5. RLS filters every row by section, owner, and role.
6. CR actions that fan out to many users invoke Edge Functions.

## Deployment

- Frontend: Vercel.
- Backend: Supabase Cloud.
- Migrations: `supabase/migrations`.
- Edge Functions: `supabase/functions`.

## Security Decisions

- Never expose service-role keys to the browser.
- Do not authorize from user-editable metadata.
- Enable RLS on every public table.
- General poll identity is not exposed through normal client queries.
- Raw ERP attendance text is not stored; only aggregate attendance rows are saved.
