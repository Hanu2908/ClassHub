# codex.md — SectionHub Coding Agent Context
For: ChatGPT (GPT-4o), Codex, GitHub Copilot, or any general coding agent.
Use this file as the system prompt or paste at the top of a new conversation.

---

## Project Overview
You are helping build **SectionHub** — a multi-tenant academic management
PWA for college sections. V1.0 is a closed beta for Section P2, SKIT Jaipur.

**What it does:**
- Students see announcements, assignments (their specific set), attendance
  predictions, and today's timetable
- The CR (Class Representative) posts notices, creates assignments with
  roll-number-based sets, tracks who submitted, and runs polls

**Stack:** React 18 + TypeScript + Tailwind CSS + Supabase (PostgreSQL)
**Deploy:** Vercel (frontend), Supabase Cloud (backend)

---

## Before You Write Any Code

Answer these questions first:
1. Is this frontend (React component or hook) or backend (SQL/Supabase)?
2. Is this for the student view or the CR admin view?
3. Which table(s) from the schema does this touch?
4. Does this feature involve RLS? If yes, flag it and do not apply without confirmation.

---

## The Database (12 tables)

```
sections            college + section name + invite_code
users               id = Supabase auth.uid(), role = 'student'|'cr'
                    section_roll ("P-01"), university_roll ("B250636")
subjects            code + name per section (never use raw text for subjects)
attendance_records  attended + total per user per subject, UNIQUE(user_id, subject_id)
announcements       priority = 'general'|'critical', is_template for Quick-Cast
acknowledgments     UNIQUE(announcement_id, user_id) — read receipts
assignments         linked to subject_id + section_id
assignment_sets     roll_start + roll_end integers, UNIQUE per assignment
submissions         UNIQUE(assignment_id, student_id), nudge_sent boolean
polls               poll_type = 'general'|'actionable'
votes               UNIQUE(poll_id, student_id)
                    general polls: student_id NEVER in any query result
push_subscriptions  endpoint + p256dh + auth per device per user
```

---

## Hard Rules — If You Violate These, the Code Ships a Bug

**Rule 1:** Every query on section-scoped tables must include `.eq('section_id', sectionId)`.
Tables that require this: announcements, assignments, submissions, polls,
votes (via join), subjects, attendance_records (via user's section).

**Rule 2:** General polls (`poll_type = 'general'`) — never SELECT `student_id`
from `votes`. Use COUNT aggregate only. This is a privacy rule.

**Rule 3:** `users.id` is identical to `auth.uid()`. Never generate a separate ID.

**Rule 4:** No localStorage for user data. All persistence in Supabase.

**Rule 5:** No Tailwind arbitrary values like `w-[347px]` unless there is
genuinely no utility class available. Use the design token classes instead.

**Rule 6:** Minimum touch target height is 44px on all interactive elements.
Add `min-h-[44px]` to every button and link.

---

## Frontend Conventions

```typescript
// ✅ Correct — data fetching in a hook
// hooks/useAssignments.ts
export function useAssignments(sectionId: string) {
  return useQuery({
    queryKey: ['assignments', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, subjects(name, code), assignment_sets(*)')
        .eq('section_id', sectionId)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}

// ❌ Wrong — never fetch in a component
function AssignmentList() {
  useEffect(() => {
    supabase.from('assignments').select('*') // NEVER
  }, [])
}
```

```typescript
// ✅ Correct component structure
interface AssignmentCardProps {
  title: string
  dueDate: string
  status: 'pending' | 'submitted'
  subjectName: string
}

export function AssignmentCard({ title, dueDate, status, subjectName }: AssignmentCardProps) {
  const isSubmitted = status === 'submitted'
  return (
    <div className="bg-bg-card border border-border-mid rounded-lg p-4">
      <span className="font-mono text-xs text-text-muted tracking-wider">
        {subjectName}
      </span>
      <h3 className="text-text-primary font-semibold mt-1">{title}</h3>
      <div className="flex items-center justify-between mt-3">
        <span className="font-mono text-xs text-text-muted">{dueDate}</span>
        <span className={`text-xs font-mono px-2 py-1 rounded ${
          isSubmitted
            ? 'text-status-live bg-status-live/10'
            : 'text-status-warn bg-status-warn/10'
        }`}>
          {isSubmitted ? 'SUBMITTED' : 'PENDING'}
        </span>
      </div>
    </div>
  )
}
```

---

## Backend Conventions

```sql
-- ✅ Always filter by section_id
SELECT * FROM announcements
WHERE section_id = $1
  AND is_template = false
ORDER BY created_at DESC;

-- ❌ Never query without section filter
SELECT * FROM announcements; -- exposes all sections

-- ✅ UPSERT pattern for attendance
INSERT INTO attendance_records (user_id, subject_id, attended, total, updated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (user_id, subject_id)
DO UPDATE SET attended = EXCLUDED.attended,
             total = EXCLUDED.total,
             updated_at = NOW();

-- ✅ Assignment set routing
SELECT set_label, page_range, pdf_url
FROM assignment_sets
WHERE assignment_id = $1
  AND roll_start <= $2
  AND roll_end >= $2
LIMIT 1;
-- $2 = integer extracted from section_roll: "P-17" → 17
```

---

## Design Tokens (Tailwind class names)

Map these to `tailwind.config.ts` custom colors:

| Token | Hex | Usage |
|---|---|---|
| `bg-app` | `#0A0A0F` | Page background |
| `bg-card` | `#13131C` | Card surfaces |
| `bg-hover` | `#1A1A28` | Hover states |
| `border-faint` | `#1C1C2E` | Dividers |
| `border-mid` | `#2A2A40` | Standard borders |
| `accent` | `#8B5CF6` | Primary violet |
| `text-primary` | `#F0F0FF` | Main text |
| `text-muted` | `#9090B8` | Secondary text |
| `status-live` | `#4ADE80` | Success/submitted |
| `status-urgent` | `#F43F5E` | Critical/danger |
| `status-warn` | `#FB923C` | Warning/deadline |

---

## File Structure to Follow

```
src/
  lib/supabase.ts        — Only file that creates the Supabase client
  hooks/                 — All data fetching. One file per feature.
  components/student/    — Student-facing UI
  components/cr/         — CR admin UI (role-gated)
  components/shared/     — Used by both
  components/ui/         — Primitives: Button, Card, Badge, Input
  pages/                 — Route-level components
```

---

## Output Format for Code Responses

When writing code, always:
1. State which file you are writing (full path from `src/`)
2. Show the complete file, not a partial snippet, unless it is over 150 lines
3. List any new npm packages needed with the install command
4. Note if an RLS policy is required for the feature to work

Example:
```
File: src/hooks/useAnnouncements.ts
New packages: none
RLS required: ⚠️ Yes — students need SELECT on announcements for their section_id
```

---

## What Not to Do
- Do not use `any` TypeScript type
- Do not write class components
- Do not use `useEffect` for data fetching (use TanStack Query)
- Do not add CSS frameworks (Tailwind is already in use — no Bootstrap, no MUI)
- Do not create new files outside the defined structure without noting it
- Do not write or apply RLS policies without flagging them first
