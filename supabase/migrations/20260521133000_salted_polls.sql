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

-- Redefine public.calculate_anonymous_token to stable, security definer, reading from settings and validating access
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
  -- Enforce that a regular authenticated user can only calculate their own token
  if auth.uid() is not null and auth.uid() <> user_id then
    raise exception 'Unauthorized: You can only calculate your own anonymous token';
  end if;

  select value into v_salt from public.system_settings where key = 'poll_salt';
  return md5(user_id::text || '-' || poll_id::text || '-' || v_salt)::uuid;
end;
$$;

-- Grant execution permissions
grant execute on function public.calculate_anonymous_token(uuid, uuid) to authenticated;
revoke execute on function public.calculate_anonymous_token(uuid, uuid) from anon;

-- Recreate all policies on votes to ensure complete consistency

-- 1. SELECT Policy
drop policy if exists "Students read own actionable and anonymous votes and CR reads actionable section votes" on public.votes;
create policy "Students read own actionable and anonymous votes and CR reads actionable section votes"
on public.votes for select to authenticated
using (
  student_id = (select auth.uid())
  or anonymous_token = public.calculate_anonymous_token((select auth.uid()), poll_id)
);

-- 2. INSERT Policy
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

-- 3. DELETE Policy
drop policy if exists "Students delete own votes" on public.votes;
create policy "Students delete own votes" on public.votes
for delete
to authenticated
using (
  student_id = auth.uid() or 
  anonymous_token = public.calculate_anonymous_token(auth.uid(), poll_id)
);

-- 4. UPDATE Policy
drop policy if exists "Students update own votes" on public.votes;
create policy "Students update own votes" on public.votes
for update
to authenticated
using (
  student_id = auth.uid() or 
  anonymous_token = public.calculate_anonymous_token(auth.uid(), poll_id)
)
with check (
  student_id = auth.uid() or 
  anonymous_token = public.calculate_anonymous_token(auth.uid(), poll_id)
);
