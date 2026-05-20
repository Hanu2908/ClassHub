-- Migration: relax ON DELETE RESTRICT → ON DELETE SET NULL
-- Required for account deletion to work without FK violations.
-- Authored content (announcements, assignments, polls, timetable_slots) stays
-- visible after user deletion with author_id = NULL.

-- announcements.author_id: RESTRICT → SET NULL
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;
ALTER TABLE public.announcements ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- assignments.created_by: RESTRICT → SET NULL
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_created_by_fkey;
ALTER TABLE public.assignments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- polls.created_by: RESTRICT → SET NULL
ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
ALTER TABLE public.polls ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.polls ADD CONSTRAINT polls_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- timetable_slots.created_by (already nullable): RESTRICT → SET NULL
ALTER TABLE public.timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_created_by_fkey;
ALTER TABLE public.timetable_slots ADD CONSTRAINT timetable_slots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
