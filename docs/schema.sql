-- 1. SECTIONS (The Workspaces)
sections (
  id          UUID PK,
  college     TEXT NOT NULL,           -- "SKIT"
  name        TEXT NOT NULL,           -- "P2"
  invite_code TEXT UNIQUE NOT NULL,    -- "P2-XYZ7"
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- 2. USERS (The People)
-- id matches Supabase auth.users.id exactly
users (
  id              UUID PK,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  role            TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'cr')),
  section_id      UUID NOT NULL REFERENCES sections(id),
  section_roll    TEXT,               -- "P-01"
  university_roll TEXT,               -- "B250636"
  day_scholar     BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- 3. SUBJECTS (Source of truth for subject data)
subjects (
  id         UUID PK,
  section_id UUID NOT NULL REFERENCES sections(id),
  code       TEXT NOT NULL,           -- "CSUL201"
  name       TEXT NOT NULL,           -- "Problem Solving Using OOP"
  semester   INTEGER NOT NULL
)

-- 4. ATTENDANCE_RECORDS (Per student, per subject — aggregate only)
attendance_records (
  id         UUID PK,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  attended   INTEGER NOT NULL DEFAULT 0,
  total      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, subject_id)
)
-- Raw class-by-class log is NOT stored. Aggregate only.
-- CR sees: all rows in their section (via JOIN through users).
-- Student sees: only their own rows.

-- 5. ANNOUNCEMENTS (Notices + Quick-Cast Templates)
announcements (
  id                UUID PK,
  section_id        UUID NOT NULL REFERENCES sections(id),
  author_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title             TEXT,
  message_content   TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'general'
                    CHECK (priority IN ('general', 'critical')),
  is_pinned         BOOLEAN DEFAULT false,
  is_template       BOOLEAN DEFAULT false,
  nudge_sent        BOOLEAN DEFAULT false,  -- blocks duplicate nudge sends
  notification_sent BOOLEAN DEFAULT false,  -- push notification tracking
  created_at        TIMESTAMPTZ DEFAULT NOW()
)

-- 6. ACKNOWLEDGMENTS (Read-receipt for Critical notices)
acknowledgments (
  id              UUID PK,
  announcement_id UUID NOT NULL REFERENCES announcements(id)
                  ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
)

-- 7. ASSIGNMENTS (The Tasks)
assignments (
  id          UUID PK,
  section_id  UUID NOT NULL REFERENCES sections(id),
  subject_id  UUID NOT NULL REFERENCES subjects(id),
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- 8. ASSIGNMENT_SETS ("Chaotic Professor" roll-number routing)
assignment_sets (
  id            UUID PK,
  assignment_id UUID NOT NULL REFERENCES assignments(id)
                ON DELETE CASCADE,
  set_label     TEXT NOT NULL,         -- "A", "B", "C"
  page_range    TEXT NOT NULL,         -- "Pages 4-5" shown to student
  pdf_url       TEXT,                  -- Drive link for this set
  roll_start    INTEGER NOT NULL,      -- numeric suffix: 1 for P-01
  roll_end      INTEGER NOT NULL,      -- numeric suffix: 25 for P-25
  UNIQUE (assignment_id, set_label),
  UNIQUE (assignment_id, roll_start, roll_end)
)

-- 9. SUBMISSIONS (Who Did The Work)
submissions (
  id              UUID PK,
  assignment_id   UUID NOT NULL REFERENCES assignments(id)
                  ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_link TEXT,                -- Drive or GitHub URL
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted')),
  submitted_at    TIMESTAMPTZ,
  nudge_sent      BOOLEAN DEFAULT false,
  UNIQUE (assignment_id, student_id)
)

-- 10. POLLS (The Questions)
polls (
  id            UUID PK,
  section_id    UUID NOT NULL REFERENCES sections(id),
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_text TEXT NOT NULL,
  poll_type     TEXT NOT NULL DEFAULT 'general'
                CHECK (poll_type IN ('general', 'actionable')),
  is_active     BOOLEAN DEFAULT true,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- 11. VOTES (The Answers)
votes (
  id          UUID PK,
  poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_choice TEXT NOT NULL,
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, student_id)
)
-- general polls:    RLS blocks student_id from being exposed in any query.
--                   Aggregate COUNT only. Truly anonymous.
-- actionable polls: CR can SELECT student_id + vote_choice.
--                   Student sees aggregate only.

-- 12. PUSH_SUBSCRIPTIONS (Web Push device endpoints)
push_subscriptions (
  id         UUID PK,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
-- One user can have multiple rows (phone + laptop = 2 subscriptions).
-- Edge Function loops through all user rows when sending a nudge.