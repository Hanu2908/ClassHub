create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('student', 'cr'); exception when duplicate_object then null; end $$;
do $$ begin create type public.announcement_priority as enum ('general', 'critical'); exception when duplicate_object then null; end $$;
do $$ begin create type public.submission_status as enum ('pending', 'submitted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.poll_type as enum ('general', 'actionable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.slot_type as enum ('lecture', 'lab', 'tutorial', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_kind as enum ('critical_announcement', 'ack_nudge', 'assignment_reminder'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_status as enum ('queued', 'sent', 'failed'); exception when duplicate_object then null; end $$;

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  college text not null default 'SKIT Jaipur',
  name text not null,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{2}[A-Z]{4}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (college, name)
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique check (email ~* '^[^@]+@skit\.ac\.in$'),
  avatar_url text,
  role public.user_role not null default 'student',
  section_id uuid references public.sections(id) on delete restrict,
  section_roll text check (section_roll is null or section_roll ~ '^\d{2}$'),
  university_roll text check (university_roll is null or university_roll ~ '^[0-9]{2}[A-Z]{3,7}[0-9]{2,5}$'),
  day_scholar boolean not null default true,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table if exists public.sections
    add constraint sections_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  code text not null,
  name text not null,
  semester integer not null check (semester > 0),
  accent text not null default '#4A9EFF',
  created_at timestamptz not null default now(),
  unique (section_id, code)
);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text,
  type public.slot_type not null default 'lecture',
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  present integer not null default 0 check (present >= 0),
  od integer not null default 0 check (od >= 0),
  makeup integer not null default 0 check (makeup >= 0),
  absent integer not null default 0 check (absent >= 0),
  percentage numeric(5,2) generated always as (
    case when (present + od + makeup + absent) = 0 then 0
      else round(((present + od + makeup)::numeric / (present + od + makeup + absent)::numeric) * 100, 2)
    end
  ) stored,
  updated_at timestamptz not null default now(),
  unique (user_id, subject_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  message_content text not null,
  priority public.announcement_priority not null default 'general',
  deadline_at timestamptz,
  is_pinned boolean not null default false,
  is_template boolean not null default false,
  nudge_sent boolean not null default false,
  notification_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.acknowledgments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  title text not null,
  description text,
  due_date timestamptz not null,
  nudge_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_sets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  set_label text not null,
  description text not null,
  pdf_url text,
  roll_start integer not null check (roll_start between 1 and 999),
  roll_end integer not null check (roll_end between 1 and 999),
  check (roll_end >= roll_start),
  unique (assignment_id, set_label)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  submission_link text,
  status public.submission_status not null default 'pending',
  submitted_at timestamptz,
  nudge_sent boolean not null default false,
  unique (assignment_id, student_id),
  check ((status = 'pending' and submission_link is null) or (status = 'submitted' and submission_link is not null))
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  question_text text not null,
  poll_type public.poll_type not null default 'general',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  unique (poll_id, label)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  student_id uuid references public.users(id) on delete cascade,
  anonymous_token uuid,
  voted_at timestamptz not null default now(),
  unique (poll_id, student_id),
  unique (poll_id, anonymous_token),
  check (student_id is not null or anonymous_token is not null)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete cascade,
  recipient_id uuid references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  kind public.notification_kind not null,
  status public.notification_status not null default 'queued',
  target_table text,
  target_id uuid,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_section_role_idx on public.users(section_id, role);
create index if not exists subjects_section_idx on public.subjects(section_id);
create index if not exists timetable_section_day_idx on public.timetable_slots(section_id, day_of_week, start_time);
create index if not exists announcements_section_created_idx on public.announcements(section_id, priority, created_at desc);
create index if not exists assignments_section_due_idx on public.assignments(section_id, due_date);
create index if not exists submissions_assignment_status_idx on public.submissions(assignment_id, status);
create index if not exists polls_section_active_idx on public.polls(section_id, is_active, expires_at);
create index if not exists votes_poll_option_idx on public.votes(poll_id, option_id);
create index if not exists notification_target_idx on public.notification_events(target_table, target_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists timetable_touch_updated_at on public.timetable_slots;
create trigger timetable_touch_updated_at before update on public.timetable_slots
for each row execute function public.touch_updated_at();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.is_skit_email(email text)
returns boolean
language sql
stable
as $$
  select email ~* '^[^@]+@skit\.ac\.in$';
$$;

create or replace function public.current_user_section_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select section_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_cr_for_section(target_section uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'cr'
      and section_id = target_section
  );
$$;

create or replace function public.join_section(invite text, class_roll text, uni_roll text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  target_section uuid;
  current_email text;
  current_name text;
  updated_user public.users;
begin
  select id into target_section
  from public.sections
  where invite_code = upper(invite);

  if target_section is null then
    raise exception 'Invalid invite code';
  end if;

  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  into current_email, current_name
  from auth.users
  where id = auth.uid();

  if not public.is_skit_email(current_email) then
    raise exception 'Only @skit.ac.in accounts can join ClassHub';
  end if;

  insert into public.users (id, name, email, section_id, section_roll, university_roll)
  values (auth.uid(), current_name, current_email, target_section, class_roll, upper(uni_roll))
  on conflict (id) do update
    set section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        updated_at = now()
  returning * into updated_user;

  return updated_user;
end;
$$;

create or replace function public.create_section_hub(section_name text, invite text, class_roll text, uni_roll text)
returns public.sections
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  current_name text;
  created_section public.sections;
begin
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  into current_email, current_name
  from auth.users
  where id = auth.uid();

  if not public.is_skit_email(current_email) then
    raise exception 'Only @skit.ac.in accounts can create a ClassHub section';
  end if;

  -- 1. Create section WITHOUT created_by (avoids FK violation since user row doesn't exist yet)
  insert into public.sections (name, invite_code)
  values (upper(section_name), upper(invite))
  returning * into created_section;

  -- 2. Create user row (or update if exists) with CR role
  insert into public.users (id, name, email, role, section_id, section_roll, university_roll)
  values (auth.uid(), current_name, current_email, 'cr', created_section.id, class_roll, upper(uni_roll))
  on conflict (id) do update
    set role = 'cr',
        section_id = excluded.section_id,
        section_roll = excluded.section_roll,
        university_roll = excluded.university_roll,
        updated_at = now();

  -- 3. NOW set created_by (user row exists, FK is satisfied)
  update public.sections
  set created_by = auth.uid()
  where id = created_section.id;

  -- Re-fetch to return the updated row with created_by set
  select * into created_section from public.sections where id = created_section.id;

  return created_section;
end;
$$;

create or replace function public.poll_results(target_poll uuid)
returns table(option_id uuid, label text, votes bigint, percentage numeric)
language sql
stable
security definer
set search_path = public
as $$
  with visible_poll as (
    select p.id
    from public.polls p
    where p.id = target_poll
      and p.section_id = public.current_user_section_id()
  ),
  counts as (
    select po.id, po.label, count(v.id)::bigint as vote_count
    from public.poll_options po
    join visible_poll vp on vp.id = po.poll_id
    left join public.votes v on v.option_id = po.id
    group by po.id, po.label, po.sort_order
    order by po.sort_order, po.label
  ),
  total as (
    select greatest(sum(vote_count), 1)::numeric as value from counts
  )
  select id, label, vote_count, round((vote_count::numeric / total.value) * 100, 2)
  from counts, total;
$$;

do $$ 
begin 
  alter publication supabase_realtime add table public.announcements;
  alter publication supabase_realtime add table public.acknowledgments;
  alter publication supabase_realtime add table public.assignments;
  alter publication supabase_realtime add table public.submissions;
  alter publication supabase_realtime add table public.polls;
  alter publication supabase_realtime add table public.votes;
  alter publication supabase_realtime add table public.timetable_slots;
exception when duplicate_object then null; 
end $$;
