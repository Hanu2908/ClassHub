-- Migration: Add batch RPC for poll results to avoid N+1 RPC calls

create or replace function public.batch_poll_results(target_polls uuid[])
returns table(poll_id uuid, option_id uuid, votes int) as $$
  select p.poll_id, r.option_id, r.votes
  from unnest(target_polls) as p(poll_id)
  cross join lateral (
    select option_id, votes
    from public.poll_results(p.poll_id)
  ) r;
$$ language sql security definer;

-- Grant to authenticated role and revoke from anon for safety
grant execute on function public.batch_poll_results(uuid[]) to authenticated;
revoke execute on function public.batch_poll_results(uuid[]) from anon;
