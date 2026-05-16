# ClassHub Schema

Core tables:

- `sections`: multi-tenant workspace boundary.
- `users`: profile, role, roll numbers, section membership.
- `subjects`: section-owned subjects.
- `timetable_slots`: CR-managed weekly schedule.
- `attendance_records`: aggregate per-student, per-subject attendance.
- `announcements`: general and critical notices.
- `acknowledgments`: critical notice proof trail.
- `assignments`: task metadata.
- `assignment_sets`: roll-range assignment routing.
- `submissions`: student submission status and link.
- `polls`: general or actionable poll metadata.
- `poll_options`: normalized poll options.
- `votes`: student/actionable votes or anonymous-token general votes.
- `push_subscriptions`: browser push endpoints.
- `notification_events`: audit log for push sends and failures.

The migration `202605150001_initial_schema.sql` contains the full DDL and helper RPCs.
