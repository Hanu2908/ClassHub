alter table public.sections enable row level security;
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.attendance_records enable row level security;
alter table public.announcements enable row level security;
alter table public.acknowledgments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_sets enable row level security;
alter table public.submissions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.join_section(text, text, text) to authenticated;
grant execute on function public.create_section_hub(text, text, text, text) to authenticated;
grant execute on function public.poll_results(uuid) to authenticated;

create policy "Users read their own section"
on public.sections for select to authenticated
using (id = public.current_user_section_id() or created_by = auth.uid());

create policy "Authenticated users create hubs through rpc"
on public.sections for insert to authenticated
with check (created_by = auth.uid());

create policy "CR updates own section"
on public.sections for update to authenticated
using (public.is_cr_for_section(id))
with check (public.is_cr_for_section(id));

create policy "Users read members in their section"
on public.users for select to authenticated
using (section_id = public.current_user_section_id() or id = auth.uid());

create policy "Users upsert own profile"
on public.users for insert to authenticated
with check (id = auth.uid());

create policy "Users update own non-role profile"
on public.users for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

create policy "CR reads and manages section subjects"
on public.subjects for all to authenticated
using (section_id = public.current_user_section_id())
with check (public.is_cr_for_section(section_id));

create policy "Section members read timetable"
on public.timetable_slots for select to authenticated
using (section_id = public.current_user_section_id());

create policy "CR manages timetable"
on public.timetable_slots for insert to authenticated
with check (public.is_cr_for_section(section_id));

create policy "CR updates timetable"
on public.timetable_slots for update to authenticated
using (public.is_cr_for_section(section_id))
with check (public.is_cr_for_section(section_id));

create policy "CR deletes timetable"
on public.timetable_slots for delete to authenticated
using (public.is_cr_for_section(section_id));

create policy "Students manage own attendance"
on public.attendance_records for all to authenticated
using (user_id = auth.uid() or exists (
  select 1
  from public.users u
  join public.subjects s on s.section_id = u.section_id
  where u.id = attendance_records.user_id
    and s.id = attendance_records.subject_id
    and public.is_cr_for_section(u.section_id)
))
with check (user_id = auth.uid());

create policy "Section members read announcements"
on public.announcements for select to authenticated
using (section_id = public.current_user_section_id());

create policy "CR creates announcements"
on public.announcements for insert to authenticated
with check (public.is_cr_for_section(section_id) and author_id = auth.uid());

create policy "CR updates announcements"
on public.announcements for update to authenticated
using (public.is_cr_for_section(section_id))
with check (public.is_cr_for_section(section_id));

create policy "CR deletes announcements"
on public.announcements for delete to authenticated
using (public.is_cr_for_section(section_id));

create policy "Users read section acknowledgments"
on public.acknowledgments for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.announcements a
    where a.id = acknowledgments.announcement_id
      and public.is_cr_for_section(a.section_id)
  )
);

create policy "Users acknowledge as self"
on public.acknowledgments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.announcements a
    where a.id = announcement_id
      and a.section_id = public.current_user_section_id()
      and a.priority = 'critical'
  )
);

create policy "Section members read assignments"
on public.assignments for select to authenticated
using (section_id = public.current_user_section_id());

create policy "CR manages assignments"
on public.assignments for all to authenticated
using (public.is_cr_for_section(section_id))
with check (public.is_cr_for_section(section_id) and created_by = auth.uid());

create policy "Section members read assignment sets"
on public.assignment_sets for select to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_sets.assignment_id
    and a.section_id = public.current_user_section_id()
));

create policy "CR manages assignment sets"
on public.assignment_sets for all to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_sets.assignment_id
    and public.is_cr_for_section(a.section_id)
))
with check (exists (
  select 1 from public.assignments a
  where a.id = assignment_sets.assignment_id
    and public.is_cr_for_section(a.section_id)
));

create policy "Students manage own submissions and CR reads section"
on public.submissions for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.assignments a
    where a.id = submissions.assignment_id
      and public.is_cr_for_section(a.section_id)
  )
);

create policy "Students submit own work"
on public.submissions for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and a.section_id = public.current_user_section_id()
  )
);

create policy "Students update own submissions"
on public.submissions for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "CR may nudge submissions"
on public.submissions for update to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = submissions.assignment_id
    and public.is_cr_for_section(a.section_id)
))
with check (exists (
  select 1 from public.assignments a
  where a.id = submissions.assignment_id
    and public.is_cr_for_section(a.section_id)
));

create policy "Section members read polls"
on public.polls for select to authenticated
using (section_id = public.current_user_section_id());

create policy "CR manages polls"
on public.polls for all to authenticated
using (public.is_cr_for_section(section_id))
with check (public.is_cr_for_section(section_id) and created_by = auth.uid());

create policy "Section members read poll options"
on public.poll_options for select to authenticated
using (exists (
  select 1 from public.polls p
  where p.id = poll_options.poll_id
    and p.section_id = public.current_user_section_id()
));

create policy "CR manages poll options"
on public.poll_options for all to authenticated
using (exists (
  select 1 from public.polls p
  where p.id = poll_options.poll_id
    and public.is_cr_for_section(p.section_id)
))
with check (exists (
  select 1 from public.polls p
  where p.id = poll_options.poll_id
    and public.is_cr_for_section(p.section_id)
));

create policy "Students read own actionable votes and CR reads actionable section votes"
on public.votes for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.polls p
    where p.id = votes.poll_id
      and p.poll_type = 'actionable'
      and public.is_cr_for_section(p.section_id)
  )
);

create policy "Students vote once in section polls"
on public.votes for insert to authenticated
with check (
  exists (
    select 1 from public.polls p
    join public.poll_options po on po.poll_id = p.id
    where p.id = votes.poll_id
      and po.id = votes.option_id
      and p.section_id = public.current_user_section_id()
      and p.is_active
      and (p.expires_at is null or p.expires_at > now())
      and (
        (p.poll_type = 'actionable' and votes.student_id = auth.uid() and votes.anonymous_token is null)
        or (p.poll_type = 'general' and votes.student_id is null and votes.anonymous_token is not null)
      )
  )
);

create policy "Users manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users read own notification audit and CR reads section audit"
on public.notification_events for select to authenticated
using (
  recipient_id = auth.uid()
  or public.is_cr_for_section(section_id)
);
