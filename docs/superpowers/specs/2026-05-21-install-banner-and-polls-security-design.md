# PWA Install Banner Gate & Polls Cryptographic Security Design

Documenting the technical design and security specs for gating the PWA install banner and hardening the anonymous voting system.

## 1. PWA Install Banner Gate & 10-Second Auto-Dismiss

### Objectives & Requirements
*   **Path & Onboarding Gate**: The `<InstallPwaBanner />` component must only display when the user has completed onboarding (valid `sectionId` exists in `authUser`) and has successfully navigated to the dashboard home page (`/app/home`).
*   **Auto-Dismiss Timer**: Once visible, the banner must automatically dismiss itself after exactly **10 seconds** (`10000ms`).
*   **Temporary Dismissal**: The auto-dismiss must act as a temporary hide for the current session/page load. If the user refreshes or re-enters the dashboard, they can be prompted again. Manual dismissal (clicking the Close "X" button or iOS "Got it" button) will still trigger the persistent 7-day snooze in `localStorage`.

### Proposed Changes

#### `<InstallPwaBanner />` (`src/components/InstallPwaBanner.tsx`)
*   Import `useLocation` from `react-router-dom` to dynamically inspect the current path.
*   Import `useAppStore` to fetch the logged-in user's profile (`authUser`).
*   Add visibility logic checking if `location.pathname === '/app/home'` and `!!authUser?.sectionId`.
*   Implement a `useEffect` driven by path navigation and visibility:
    *   When the banner becomes visible, start a `setTimeout` for 10 seconds.
    *   The timeout callback sets `isVisible(false)`.
    *   A cleanup function clears the active timeout if the component unmounts, the route changes, or the user manually closes it.

---

## 2. Polls Security Hardening: "Salted Cryptographic Ballot"

### Objectives & Requirements
*   **True Anonymity**: Ensure that neither Class Representatives (CRs) nor other students can reverse-engineer anonymous tokens to trace vote choices back to individual student accounts in general polls.
*   **Anti-Ballot Stuffing**: Prevent malicious users from generating arbitrary tokens to vote multiple times in general polls.
*   **Support for Vote Changing**: Retain the user's ability to update or delete their vote dynamically while keeping the system completely anonymous.

### Proposed Changes

#### A. Database Config & Salt Table (`supabase/migrations`)
Create a secure settings table `public.system_settings` to store a private cryptographic salt generated dynamically during migration.

```sql
-- Create system settings table for private variables
create table if not exists public.system_settings (
  key text primary key,
  value text not null
);

-- Enable RLS with absolutely NO select/update policies for regular authenticated users
alter table public.system_settings enable row level security;

-- Initialize the private cryptographic salt
insert into public.system_settings (key, value)
values ('poll_salt', gen_random_uuid()::text)
on conflict (key) do nothing;
```

#### B. Cryptographically Salted Token Generator (`supabase/migrations`)
Refactor the `public.calculate_anonymous_token` function to make it run as `SECURITY DEFINER` (allowing it to read the private salt) and append the salt to the token string:

```sql
create or replace function public.calculate_anonymous_token(user_id uuid, poll_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salt text;
begin
  select value into v_salt from public.system_settings where key = 'poll_salt';
  return md5(user_id::text || '-' || poll_id::text || '-' || v_salt)::uuid;
end;
$$;
```

#### C. Enforcing Strict INSERT Policies on `public.votes`
Update the INSERT RLS policy on the `votes` table to strictly validate that the user is submitting a token generated using their own active `auth.uid()`, preventing any ballot-box stuffing:

```sql
drop policy if exists "Students vote once in section polls" on public.votes;
create policy "Students vote once in section polls"
on public.votes for insert to authenticated
with check (
  exists (
    select 1 from public.polls p
    join public.poll_options po on po.poll_id = p.id
    where p.id = votes.poll_id
      and po.id = votes.option_id
      and p.section_id = (select public.current_user_section_id())
      and p.is_active
      and (p.expires_at is null or p.expires_at > now())
      and (
        (p.poll_type = 'actionable' and votes.student_id = (select auth.uid()) and votes.anonymous_token is null)
        or (p.poll_type = 'general' and votes.student_id is null and votes.anonymous_token = public.calculate_anonymous_token((select auth.uid()), votes.poll_id))
      )
  )
);
```

---

## 3. Verification & Testing Plan

### Automated / Integration Checks
*   **Build Correctness**: Run `npm run build` to verify there are zero TypeScript syntax errors.
*   **Timers**: Navigate to `/app/home` and verify using console logs that the install banner mounts and auto-dismounts after exactly 10 seconds.
*   **Security Policies**: Test SQL RLS rules to confirm:
    1.  Regular users cannot query `public.system_settings`.
    2.  Attempts to insert a vote in a general poll with a spoofed or random `anonymous_token` are instantly rejected by the database.
    3.  A student can successfully change (update) or delete their vote on an active general poll.

### Manual Verification
*   **Mobile Mocking**: Emulate a mobile browser environment and verify that the banner doesn't appear on the onboarding flow (`/onboarding/choice`), but triggers immediately upon arriving on `/app/home`.
*   **Auto-Dismiss Verification**: Let the banner close naturally after 10 seconds, then refresh the dashboard and confirm it reappears.
