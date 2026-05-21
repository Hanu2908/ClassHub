-- Add new notification kinds
alter type public.notification_kind add value if not exists 'general_announcement';
alter type public.notification_kind add value if not exists 'new_assignment';
alter type public.notification_kind add value if not exists 'new_poll';

-- Add payload columns and read status to notification_events
alter table public.notification_events add column if not exists title text;
alter table public.notification_events add column if not exists body text;
alter table public.notification_events add column if not exists read_at timestamptz;

-- RLS Update policy: Users can mark their own notifications as read
drop policy if exists "Users update own notification status" on public.notification_events;
create policy "Users update own notification status"
on public.notification_events for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- Register table for Supabase Realtime publication
do $$ 
begin 
  alter publication supabase_realtime add table public.notification_events;
exception when duplicate_object then null; 
end $$;

-- Triggers to automatically generate in-app notification events

-- 1. New Assignment Trigger
create or replace function public.on_assignment_created()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notification_events (section_id, recipient_id, actor_id, kind, status, target_table, target_id, title, body)
  select 
    new.section_id,
    u.id,
    new.created_by,
    'new_assignment'::public.notification_kind,
    'sent'::public.notification_status,
    'assignments',
    new.id,
    'New Assignment: ' || new.title,
    'Due ' || to_char(new.due_date, 'DY, Mon DD at HH:MI AM')
  from public.users u
  where u.section_id = new.section_id
    and u.id != new.created_by;
  return new;
end;
$$;

drop trigger if exists trigger_on_assignment_created on public.assignments;
create trigger trigger_on_assignment_created
  after insert on public.assignments
  for each row execute function public.on_assignment_created();

-- 2. New Announcement Trigger
create or replace function public.on_announcement_created()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notification_events (section_id, recipient_id, actor_id, kind, status, target_table, target_id, title, body)
  select 
    new.section_id,
    u.id,
    new.author_id,
    case when new.priority = 'critical' then 'critical_announcement'::public.notification_kind else 'general_announcement'::public.notification_kind end,
    'sent'::public.notification_status,
    'announcements',
    new.id,
    case when new.priority = 'critical' then '🚨 CRITICAL: ' || new.title else 'Announcement: ' || new.title end,
    substring(new.message_content from 1 for 120)
  from public.users u
  where u.section_id = new.section_id
    and u.id != new.author_id;
  return new;
end;
$$;

drop trigger if exists trigger_on_announcement_created on public.announcements;
create trigger trigger_on_announcement_created
  after insert on public.announcements
  for each row execute function public.on_announcement_created();

-- 3. New Poll Trigger
create or replace function public.on_poll_created()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notification_events (section_id, recipient_id, actor_id, kind, status, target_table, target_id, title, body)
  select 
    new.section_id,
    u.id,
    new.created_by,
    'new_poll'::public.notification_kind,
    'sent'::public.notification_status,
    'polls',
    new.id,
    'New Poll: ' || new.question_text,
    'Cast your vote on ClassHub!'
  from public.users u
  where u.section_id = new.section_id
    and u.id != new.created_by;
  return new;
end;
$$;

drop trigger if exists trigger_on_poll_created on public.polls;
create trigger trigger_on_poll_created
  after insert on public.polls
  for each row execute function public.on_poll_created();;
