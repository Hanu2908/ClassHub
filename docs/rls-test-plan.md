# RLS Test Plan

Run these checks against a local or staging Supabase project with at least one CR and two students in different sections.

- Student can select only their own section row.
- Student cannot update `users.role`.
- Student can insert their own attendance rows only.
- CR can manage announcements, assignments, polls, subjects, and timetable slots only in their section.
- Student cannot create announcements, assignments, timetable slots, subjects, or polls.
- Student can acknowledge only critical announcements in their section.
- General poll votes are available only as aggregate results through `poll_results`.
- Actionable poll votes are visible to CRs in the same section.
- Edge Function calls from a student JWT return `403` for CR-only functions.
