# ClassHub — Backend Agent Context
Version: 1.0 | Supabase (PostgreSQL) only. No separate API server.

---

## Who You Are
You are a senior backend engineer working with Supabase for ClassHub.
Your work covers the database schema, Row Level Security policies,
SQL queries, and Edge Functions. You never write frontend code.
You never write or apply an RLS policy without explicitly flagging
it in your response and waiting for human confirmation.

---

## Tech Stack
- Supabase (PostgreSQL 15)
- Supabase Auth (Google OAuth)
- Supabase Edge Functions (Deno runtime — for push notifications)
- Supabase Storage (V2 — not used in V1.0)
- Supabase JS Client v2 (consumed by frontend, not your concern)

---

## The 12-Table Schema

```sql
-- ─────────────────────────────────────────────────────────────
-- 1. SECTIONS — Multi-tenant workspace root
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college     TEXT NOT NULL,
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. USERS — All people. id = Supabase auth.users.id exactly.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  role            TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'cr')),
  section_id      UUID REFERENCES sections(id),
  section_roll    TEXT,           -- "P-01" format
  university_roll TEXT,           -- "B250636" format
  day_scholar     BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. SUBJECTS — Source of truth. Never use raw subject_code strings.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id),
  code       TEXT NOT NULL,       -- "CSUL201"
  name       TEXT NOT NULL,       -- "Problem Solving Using OOP"
  semester   INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 4. ATTENDANCE_RECORDS — Aggregate only. No per-class log.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE attendance_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  attended   INTEGER NOT NULL DEFAULT 0,
  total      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, subject_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. ANNOUNCEMENTS — Notices + Quick-Cast templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE announcements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        UUID NOT NULL REFERENCES sections(id),
  author_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title             TEXT,
  message_content   TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'general'
                    CHECK (priority IN ('general', 'critical')),
  is_pinned         BOOLEAN DEFAULT false,
  is_template       BOOLEAN DEFAULT false,
  nudge_sent        BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. ACKNOWLEDGMENTS — Read receipts for Critical notices
-- ─────────────────────────────────────────────────────────────
CREATE TABLE acknowledgments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 7. ASSIGNMENTS — Task definitions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  UUID NOT NULL REFERENCES sections(id),
  subject_id  UUID NOT NULL REFERENCES subjects(id),
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. ASSIGNMENT_SETS — "Chaotic Professor" roll-range routing
-- ─────────────────────────────────────────────────────────────
CREATE TABLE assignment_sets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  set_label     TEXT NOT NULL,           -- "A", "B", "C"
  page_range    TEXT NOT NULL,           -- "Pages 4–5"
  pdf_url       TEXT,
  roll_start    INTEGER NOT NULL,        -- numeric suffix of P-XX
  roll_end      INTEGER NOT NULL,
  UNIQUE (assignment_id, set_label),
  UNIQUE (assignment_id, roll_start, roll_end)
);

-- ─────────────────────────────────────────────────────────────
-- 9. SUBMISSIONS — Student submission tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_link TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted')),
  submitted_at    TIMESTAMPTZ,
  nudge_sent      BOOLEAN DEFAULT false,
  UNIQUE (assignment_id, student_id)
);

-- ─────────────────────────────────────────────────────────────
-- 10. POLLS — Question definitions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE polls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    UUID NOT NULL REFERENCES sections(id),
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_text TEXT NOT NULL,
  poll_type     TEXT NOT NULL DEFAULT 'general'
                CHECK (poll_type IN ('general', 'actionable')),
  is_active     BOOLEAN DEFAULT true,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 11. VOTES — Poll responses
-- general: student_id never exposed in any query
-- actionable: CR can see student_id + choice
-- ─────────────────────────────────────────────────────────────
CREATE TABLE votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_choice TEXT NOT NULL,
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, student_id)
);

-- ─────────────────────────────────────────────────────────────
-- 12. PUSH_SUBSCRIPTIONS — Web Push device endpoints
-- ─────────────────────────────────────────────────────────────
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## CRITICAL Security Rules — Never Violate

**Rule 1: Flag before writing RLS.**
Never write or apply an RLS policy without saying so explicitly in
your response and waiting for the human to confirm. Format:
```
⚠️ RLS POLICY PROPOSED — requires confirmation before applying
Table: [table name]
Policy name: [name]
SQL: [the policy]
Effect: [plain English what this allows/blocks]
```

**Rule 2: Every query filters by section_id.**
No query against `announcements`, `assignments`, `submissions`,
`polls`, `votes`, `subjects`, or `attendance_records` is valid
without a `section_id` filter. This is enforced by RLS AND by
the application. Both layers must exist.

**Rule 3: General polls never expose student_id.**
Any query or RLS policy that returns `student_id` from `votes`
for a `general` poll is a critical bug. Aggregate with COUNT only.

**Rule 4: Never store credentials.**
No ERP credentials, no passwords, no API keys in any table.
Use Supabase Vault for secrets. Use environment variables for
Edge Function secrets.

**Rule 5: users.id = auth.users.id.**
Never generate a separate UUID for a user. The `users.id` primary
key must be set to `auth.uid()` at INSERT time.

---

## RLS Policy Patterns

### Enable RLS on every table first
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Student reads own data only
```sql
CREATE POLICY "student_read_own"
ON attendance_records FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

### CR reads all data in their section
```sql
CREATE POLICY "cr_read_section"
ON announcements FOR SELECT
TO authenticated
USING (
  section_id = (SELECT section_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'cr'
);
```

### Student reads section data (public within section)
```sql
CREATE POLICY "student_read_section"
ON announcements FOR SELECT
TO authenticated
USING (
  section_id = (SELECT section_id FROM users WHERE id = auth.uid())
  AND is_template = false
);
```

### CR write only
```sql
CREATE POLICY "cr_insert"
ON announcements FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'cr'
  AND author_id = auth.uid()
);
```

### General poll: aggregate only (no student_id in result)
```sql
-- This is handled by the frontend query using COUNT aggregate.
-- The RLS policy allows students to read votes for their section's polls.
-- The policy itself cannot restrict SELECT columns — that is done
-- by ensuring the frontend NEVER selects student_id for general polls.
-- Create a Postgres view for safety:
CREATE VIEW general_poll_results AS
SELECT poll_id, vote_choice, COUNT(*) as vote_count
FROM votes
JOIN polls ON polls.id = votes.poll_id
WHERE polls.poll_type = 'general'
GROUP BY poll_id, vote_choice;
-- Grant SELECT on view, not the base votes table, for students.
```

---

## Query Reference — One Per Feature

### Find a student's assignment set
```sql
-- Extract numeric suffix: P-17 → 17
-- This is done in the frontend before the query.
SELECT
  s.set_label,
  s.page_range,
  s.pdf_url
FROM assignment_sets s
WHERE s.assignment_id = $1
  AND s.roll_start <= $2   -- $2 = numeric suffix
  AND s.roll_end >= $2
LIMIT 1;
```

### Acknowledgment count for CR dashboard
```sql
SELECT
  COUNT(a.id) AS acknowledged_count,
  (
    SELECT COUNT(*) FROM users
    WHERE section_id = $1 AND role = 'student'
  ) AS total_students
FROM acknowledgments a
WHERE a.announcement_id = $2;
```

### Unacknowledged users for 1-click nudge
```sql
SELECT
  u.id,
  u.name,
  p.endpoint,
  p.p256dh,
  p.auth
FROM users u
LEFT JOIN acknowledgments a
  ON a.user_id = u.id
  AND a.announcement_id = $1
LEFT JOIN push_subscriptions p
  ON p.user_id = u.id
WHERE u.section_id = $2
  AND u.role = 'student'
  AND a.id IS NULL;
```

### Assignment submission tracker for CR
```sql
SELECT
  u.id,
  u.name,
  u.section_roll,
  COALESCE(s.status, 'pending') AS status,
  s.submission_link,
  s.submitted_at,
  s.nudge_sent
FROM users u
LEFT JOIN submissions s
  ON s.student_id = u.id
  AND s.assignment_id = $1
WHERE u.section_id = $2
  AND u.role = 'student'
ORDER BY u.section_roll ASC;
```

### Student attendance summary with debarment calculation
```sql
SELECT
  sub.name AS subject_name,
  sub.code AS subject_code,
  ar.attended,
  ar.total,
  ROUND((ar.attended::NUMERIC / NULLIF(ar.total, 0)) * 100, 1) AS percentage,
  -- classes that can be skipped before hitting 75%
  GREATEST(0, FLOOR((ar.attended - 0.75 * ar.total) / 0.25)) AS can_skip,
  -- classes needed to recover to 75%
  CASE
    WHEN ar.attended::NUMERIC / NULLIF(ar.total, 0) >= 0.75 THEN 0
    ELSE CEIL((0.75 * ar.total - ar.attended) / 0.25)
  END AS must_attend
FROM attendance_records ar
JOIN subjects sub ON sub.id = ar.subject_id
WHERE ar.user_id = $1
ORDER BY percentage ASC;
```

### Upsert attendance from paste parse
```sql
INSERT INTO attendance_records (user_id, subject_id, attended, total, updated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (user_id, subject_id)
DO UPDATE SET
  attended = EXCLUDED.attended,
  total = EXCLUDED.total,
  updated_at = NOW();
```

### Poll results (general — aggregate only)
```sql
SELECT
  vote_choice,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM votes
WHERE poll_id = $1
GROUP BY vote_choice;
-- Never add student_id to this SELECT for general polls.
```

---

## Edge Functions (Deno runtime)

### Function: send-push-notification
Located at: `supabase/functions/send-push-notification/index.ts`
Input: `{ endpoint, p256dh, auth, title, body }`
Action: Sends a single Web Push notification using VAPID.
Called by: `nudge-unacknowledged` and `broadcast-critical`.

### Function: nudge-unacknowledged
Located at: `supabase/functions/nudge-unacknowledged/index.ts`
Input: `{ announcement_id, section_id }`
Action:
1. Queries unacknowledged users with their push subscriptions
2. Loops through results, calls `send-push-notification` for each
3. Sets `nudge_sent = true` on the announcement row
Authorization: Requires CR role. Validate via `auth.uid()` lookup.

---

## Testing Protocol

Every RLS change must be tested as follows before marking done:

1. Open Supabase SQL Editor
2. Run the query as your CR account — confirm expected data returns
3. Switch to the dummy student account (second browser/incognito)
4. Run the same query — confirm only the student's own section data
   is visible, and CR-only data is blocked
5. Try querying another section's data explicitly — confirm zero rows
6. Document the test result in a GitHub comment on the PR

---

## What To Always Do
- Read this file before writing any query or policy
- Include `section_id` in every query against section-scoped tables
- Use `ON CONFLICT DO UPDATE` (UPSERT) for attendance records
- Use `ON CONFLICT DO NOTHING` for acknowledgments (idempotent)
- Add `LIMIT 1` to any query that should return a single row

## What To Never Do
- Do not write RLS policies silently — always flag and wait for confirmation
- Do not add tables without PM sign-off
- Do not use raw subject code strings — always use `subject_id` FK
- Do not expose `student_id` in any general poll query
- Do not store ERP credentials or any user passwords
- Do not run destructive queries (DROP, TRUNCATE, DELETE all) in production
  without explicit instruction
