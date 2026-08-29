# ClassHub Backend & Database Architecture

This document describes the backend architecture, local Supabase CLI development workflow, schema relationships, Row-Level Security (RLS) enforcement, and local seed scripts for ClassHub.

---

## 1. Local Supabase CLI Development Workflow

ClassHub uses the Supabase CLI for local database development, migrations, and Edge Function testing.

### Prerequisites

- [Docker Desktop](https://www.docker.com/) running locally.
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm install -g supabase` or `brew install supabase/tap/supabase`).

### Starting the Local Stack

1. Initialize and start the local Supabase emulator:
   ```bash
   supabase start
   ```
   This spins up PostgreSQL 15, Auth, Storage, and Studio at `http://localhost:54323`.

2. Apply all active migrations and run the deterministic seed script:
   ```bash
   supabase db reset
   ```
   This resets the local database, executes all SQL files under `supabase/migrations/` in chronological order, and executes `supabase/seed.sql`.

3. Access Supabase Studio locally:
   - URL: `http://localhost:54323`
   - Default local API URL: `http://localhost:54321`
   - Default local anon key is output by `supabase status`.

---

## 2. Deterministic Local Seed Data (`supabase/seed.sql`)

When setting up locally or running automated backend tests, `supabase/seed.sql` populates a realistic, reproducible environment for **Section P2**:

- **Demo Section**: Section `P2` (`invite_code`: `P2WXYZ`).
- **Demo Users**:
  - **CR**: `cr.p2@skit.ac.in` (Roll: `01`, University Roll: `22ESKCS001`)
  - **Student**: `student.p2@skit.ac.in` (Roll: `02`, University Roll: `22ESKCS002`)
  - **Faculty**: `teacher.p2@skit.ac.in` (`Dr. Sunita Gupta`)
- **Core Engineering Subjects**: DBMS (`CS401`), Operating Systems (`CS402`), Computer Networks (`CS403`), Data Structures (`CS404`).
- **Weekly Schedule**: Recurring Monday through Wednesday timetable slots with assigned rooms (`LT-101`, `Lab-3`).
- **Sample Attendance Records**: Pre-populated attendance logs with safe bunks and threshold metrics.
- **Notices & Q&A**: High-priority announcements with verified student Q&A responses.

> [!IMPORTANT]
> The seed script strictly uses deterministic static UUIDs (such as `00000000-0000-4000-8000-000000000001`) and zero real student personal identifiable information (PII).

---

## 3. Database Schema & Tenant Isolation

ClassHub operates on a strict multi-tenant model isolated at the **Section** level.

```
sections (id, name, college, invite_code)
  ├── users (id, name, email, role, section_id, section_roll, university_roll)
  ├── subjects (id, section_id, code, name, semester)
  ├── timetable_slots (id, section_id, subject_id, day_of_week, start_time, end_time, room)
  ├── attendance_records (id, user_id, subject_id, present, od, makeup, absent)
  ├── announcements (id, section_id, author_id, title, message_content, priority)
  │     ├── acknowledgments (announcement_id, user_id)
  │     ├── announcement_comments (id, announcement_id, author_id, content, is_verified)
  │     └── announcement_reactions (id, announcement_id, user_id, emoji)
  └── assignments (id, section_id, subject_id, title, due_date)
        ├── assignment_sets (id, assignment_id, set_label, roll_start, roll_end)
        └── submissions (id, assignment_id, student_id, submission_link, status)
```

### Security & Row-Level Security (RLS) Rules

1. **Section Isolation**: Every query must be scoped to the authenticated user's `section_id` via Postgres function `public.current_user_section_id()`.
2. **Domain Protection**: Only accounts with the `@skit.ac.in` Google Workspace domain are permitted to authenticate.
3. **Zero ERP Passwords**: ClassHub never scrapes, requests, or stores external ERP passwords.
4. **Anonymous Poll Tokenization**: Anonymous voting utilizes salted one-way hashes (`calculate_anonymous_token`) to preserve ballot secrecy.

---

## 4. Creating New Database Migrations

To introduce schema modifications or new database functions:

```bash
supabase migration new <descriptive_migration_name>
```

Write idempotent SQL in the generated file under `supabase/migrations/`. Ensure all new tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and corresponding RLS policies.
