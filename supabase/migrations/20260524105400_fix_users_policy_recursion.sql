-- Fix infinite recursion in public.users update policy
drop policy if exists "Users update own non-role profile" on public.users;

create policy "Users update own non-role profile"
on public.users for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = public.current_user_role());
