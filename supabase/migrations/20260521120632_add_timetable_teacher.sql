-- Add teacher name field to timetable_slots (nullable, no RLS change needed)
ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS teacher text;
