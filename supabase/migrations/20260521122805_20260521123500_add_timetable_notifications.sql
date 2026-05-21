-- Trigger to automatically generate notification events on timetable changes

create or replace function public.on_timetable_slot_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_subject_name text;
  v_subject_code text;
  v_type_cap text;
  v_day_name text;
  v_start_formatted text;
  v_details text;
  v_title text;
  v_body text;
  v_section_id uuid;
  v_actor_id uuid;
  v_target_id uuid;
  v_operation text;
  v_should_notify boolean := false;
begin
  -- Determine operation type
  if TG_OP = 'INSERT' then
    v_operation := 'INSERT';
    v_section_id := new.section_id;
    v_actor_id := coalesce(auth.uid(), new.created_by);
    v_target_id := new.id;
    v_should_notify := true;
  elsif TG_OP = 'UPDATE' then
    v_operation := 'UPDATE';
    v_section_id := new.section_id;
    v_actor_id := coalesce(auth.uid(), new.created_by);
    v_target_id := new.id;
    -- Only trigger if meaningful fields change
    if (old.subject_id is distinct from new.subject_id or
        old.day_of_week is distinct from new.day_of_week or
        old.start_time is distinct from new.start_time or
        old.end_time is distinct from new.end_time or
        old.room is distinct from new.room or
        old.teacher is distinct from new.teacher or
        old.type is distinct from new.type) then
      v_should_notify := true;
    end if;
  elsif TG_OP = 'DELETE' then
    v_operation := 'DELETE';
    v_section_id := old.section_id;
    v_actor_id := coalesce(auth.uid(), old.created_by);
    v_target_id := old.id;
    v_should_notify := true;
  end if;

  if not v_should_notify then
    return coalesce(new, old);
  end if;

  -- 1. Get Subject Name and Code
  if TG_OP = 'DELETE' then
    if old.subject_id is not null then
      select name, code into v_subject_name, v_subject_code from public.subjects where id = old.subject_id;
    end if;
  else
    if new.subject_id is not null then
      select name, code into v_subject_name, v_subject_code from public.subjects where id = new.subject_id;
    end if;
  end if;

  -- 2. Format details
  if TG_OP = 'DELETE' then
    v_type_cap := initcap(old.type::text);
    v_start_formatted := to_char(old.start_time, 'HH12:MI AM');
    v_day_name := case old.day_of_week
      when 0 then 'Sunday'
      when 1 then 'Monday'
      when 2 then 'Tuesday'
      when 3 then 'Wednesday'
      when 4 then 'Thursday'
      when 5 then 'Friday'
      when 6 then 'Saturday'
      else 'Day'
    end;
  else
    v_type_cap := initcap(new.type::text);
    v_start_formatted := to_char(new.start_time, 'HH12:MI AM');
    v_day_name := case new.day_of_week
      when 0 then 'Sunday'
      when 1 then 'Monday'
      when 2 then 'Tuesday'
      when 3 then 'Wednesday'
      when 4 then 'Thursday'
      when 5 then 'Friday'
      when 6 then 'Saturday'
      else 'Day'
    end;
  end if;

  -- 3. Construct Title and Body
  if v_operation = 'INSERT' then
    v_title := '📅 New Class Scheduled';
    v_details := '';
    if new.room is not null and new.room != '' then
      v_details := v_details || ' in Room ' || new.room;
    end if;
    if new.teacher is not null and new.teacher != '' then
      v_details := v_details || ' with ' || new.teacher;
    end if;
    v_body := coalesce(v_subject_name, 'Free Period') || ' (' || v_type_cap || ') scheduled on ' || v_day_name || ' at ' || v_start_formatted || v_details || '.';
  elsif v_operation = 'UPDATE' then
    v_title := '✏️ Timetable Entry Updated';
    v_details := '';
    if new.room is not null and new.room != '' then
      v_details := v_details || ' in Room ' || new.room;
    end if;
    if new.teacher is not null and new.teacher != '' then
      v_details := v_details || ' with ' || new.teacher;
    end if;
    v_body := coalesce(v_subject_name, 'Free Period') || ' (' || v_type_cap || ') on ' || v_day_name || ' at ' || v_start_formatted || ' has been updated' || v_details || '.';
  elsif v_operation = 'DELETE' then
    v_title := '❌ Class Cancelled';
    v_body := coalesce(v_subject_name, 'Free Period') || ' (' || v_type_cap || ') on ' || v_day_name || ' at ' || v_start_formatted || ' has been cancelled/removed.';
  end if;

  -- 4. Dispatch Notifications to all users in the section except the actor
  insert into public.notification_events (section_id, recipient_id, actor_id, kind, status, target_table, target_id, title, body)
  select 
    v_section_id,
    u.id,
    v_actor_id,
    'general_announcement'::public.notification_kind,
    'sent'::public.notification_status,
    'timetable_slots',
    v_target_id,
    v_title,
    v_body
  from public.users u
  where u.section_id = v_section_id
    and (v_actor_id is null or u.id != v_actor_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_on_timetable_change on public.timetable_slots;
create trigger trigger_on_timetable_change
  after insert or update or delete on public.timetable_slots
  for each row execute function public.on_timetable_slot_change();
