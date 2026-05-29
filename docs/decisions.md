# SectionHub — Architectural Decisions Log
**Format:** ADR (Architecture Decision Record)
**Owner:** Himanshu Saini (PM)
**Rule:** Every major technical or product decision is recorded here.
No decision is changed without updating this file and notifying the team.

---

## ADR-001 — Database: PostgreSQL via Supabase
**Decision:** Use Supabase (PostgreSQL) as the only backend.
**Rationale:** Multi-tenant SaaS requires Row Level Security, which
PostgreSQL provides natively. Supabase bundles Auth, Storage, Edge
Functions, and the database in one platform — eliminating the need for
a separate API server at this stage.
**Alternatives rejected:**
- Firebase: No row-level security. Difficult to enforce tenant isolation.
- PlanetScale (MySQL): No RLS. Learning MySQL separately adds no value
  when PostgreSQL is the industry standard for relational SaaS.
- Separate Node.js API: Over-engineering for a student team. Supabase
  Edge Functions cover any server-side logic needed.
**Date:** May 2026

---

## ADR-002 — Authentication: Google OAuth + Domain Restriction
**Decision:** Use Google OAuth via Supabase Auth, restricted to
`@skit.ac.in` emails only. Restriction is enforced at two layers:
1. Frontend: `onAuthStateChange` callback checks email domain immediately
   after OAuth completes. Non-SKIT emails are signed out instantly.
2. Database: A PostgreSQL trigger on `auth.users` raises an exception
   for any inserted email not matching `%@skit.ac.in`.
**Rationale:** SKIT provides Google Workspace to all students. OAuth
means no password management. Domain restriction prevents unauthorized
access without a separate approval workflow.
**Testing protocol:** After any auth change, test with a personal
Gmail account. It must be rejected before the user reaches any app screen.
**Alternatives rejected:**
- Email + password: Password resets, storage, and security overhead.
- Magic link: Requires reliable email delivery, which college infra
  may not guarantee.
- Manual CR approval: Creates a bottleneck. Domain restriction
  achieves the same security automatically.
**Date:** May 2026

---

## ADR-003 — Styling: Tailwind CSS (overrides original inline CSS decision)
**Decision:** Use Tailwind CSS v3 with a custom theme in `tailwind.config.ts`.
**Rationale:** The original Resource Hub V1 used inline CSS because it
was a solo project. SectionHub V2 is a team project. With 3+ developers
writing inline styles independently, visual inconsistency is guaranteed.
Tailwind enforces shared design tokens at the class level, making
consistency the default rather than an effort.
**Impact:** The PRD Section 6 reference to "inline CSS + global.css"
is superseded by this decision. All new components use Tailwind classes.
Global CSS (`styles/globals.css`) is used only for Tailwind directives,
CSS variable declarations, and base resets.
**Alternatives rejected:**
- CSS Modules: Better than inline but still allows arbitrary values.
  Does not enforce the design token system.
- Styled Components: Runtime cost, requires TypeScript generics, adds
  complexity without enough benefit at this stage.
- Inline CSS (original decision): Does not scale to a team. No responsive
  utilities. No hover/focus states without JS event handlers.
**Date:** May 2026

---

## ADR-004 — Schema: 12 Tables, Locked for V1.0
**Decision:** The V1.0 database schema consists of exactly 12 tables.
No tables are added or removed without PM sign-off and a new ADR entry.
**Tables:**
1.  `sections` — Section workspaces
2.  `users` — All users (students + CRs), linked to Supabase auth
3.  `subjects` — Subject source of truth, eliminates raw text codes
4.  `attendance_records` — Per-student, per-subject aggregate attendance
5.  `announcements` — Notices + Quick-Cast templates
6.  `acknowledgments` — Read receipts for Critical notices
7.  `assignments` — Task definitions
8.  `assignment_sets` — Roll-range routing for "Chaotic Professor" sets
9.  `submissions` — Student submission links and status
10. `polls` — Poll definitions (two types)
11. `votes` — Poll responses
12. `push_subscriptions` — Device endpoints for Web Push (V1.1 feature)
**Rationale:** Each table has a single clear responsibility. Junction
tables have UNIQUE constraints. All `created_by` fields are proper
FKs with `ON DELETE RESTRICT` to prevent ghost records.
**Date:** May 2026

---

## ADR-005 — Attendance: Paste-Parse Only, No ERP Scraping
**Decision:** Attendance data is entered by students via paste.
The app parses the pasted ERP text and stores aggregate data only
(attended, total per subject). Raw class-by-class logs are not stored.
**Rationale:** ERP scraping requires storing student credentials in
our system, which is a critical security risk and a non-starter.
A browser bookmarklet (runs in the student's browser without credential
storage) is a viable V2 upgrade but not needed for V1.0.
**CR visibility rule:** CR sees attendance percentages per student per
subject. CR does NOT see the raw class log (which classes were
attended on which dates). That data is private to the student.
**Alternatives rejected:**
- ERP credential storage + server-side scrape: Security risk. Never build.
- Manual entry per class: Too tedious for 70 students.
- Screenshot parsing: Unreliable across different screen sizes and ERP versions.
**Date:** May 2026

---

## ADR-006 — Polls: Two-Type System
**Decision:** Polls have two types, selected by the CR at creation:
1. **General** (`poll_type = 'general'`): Truly anonymous. No `student_id`
   is stored in the `votes` table. Both students and CR see aggregate
   percentages only. Used for sentiment, feedback, mass bunk decisions.
2. **Actionable** (`poll_type = 'actionable'`): `student_id` is stored.
   CR can see individual responses. Students see only the aggregate.
   The poll UI shows a visible warning badge before the student votes:
   *"The CR can see your individual response."* Used for logistics
   (expo attendance, lab group confirmation).
**Rationale:** The original "peer-anonymous, admin-visible" design was
contradictory. Splitting into two explicit types with clear UI
communication resolves the ethical issue without losing functionality.
**RLS enforcement:** For general polls, the RLS SELECT policy on `votes`
must return only aggregated COUNT, never raw rows with `student_id`.
**Date:** May 2026

---

## ADR-007 — Assignment Sets: Roll-Range Routing
**Decision:** Assignments can have multiple sets. Each set maps a
label (A, B, C) to a roll number range and a page range or PDF link.
Students see only their set based on the numeric suffix of their
`section_roll` (P-17 → numeric suffix 17).
**Query pattern:**
```sql
SELECT * FROM assignment_sets
WHERE assignment_id = $1
AND roll_start <= [student_numeric_roll]
AND roll_end >= [student_numeric_roll];
```
**UNIQUE constraints:** `(assignment_id, set_label)` and
`(assignment_id, roll_start, roll_end)` prevent overlapping ranges.
The CR form must validate no overlap before INSERT.
**Assignments without sets:** If no rows exist in `assignment_sets`
for an `assignment_id`, all students see the base description.
**Date:** May 2026

---

## ADR-008 — Push Notifications: V1.1 Feature, V1.0 Infrastructure
**Decision:** Web Push notification delivery ships in V1.1. However,
the infrastructure (VAPID keys, `push_subscriptions` table, service
worker push event handler) is built in Sprint 1 so no schema migration
is needed when the feature ships.
**Rationale:** Push notifications require a tested Edge Function, VAPID
key management, and device compatibility testing. Rushing this into V1.0
with a closed beta of 70 students risks poisoning the relationship with
the user base if notifications behave incorrectly.
**V1.0 fallback:** Announcements appear when the student opens the app.
The CR posts a one-line WhatsApp message to drive traffic to the app
for Critical notices.
**Date:** May 2026

---

## ADR-009 — Data Persistence: Supabase Only, No localStorage
**Decision:** All user data (submissions, attendance, acknowledgments,
votes) is persisted in Supabase. localStorage is not used for any
user-specific data.
**Rationale:** Multi-device support. A student on their phone sees the
same submissions as on their laptop. localStorage breaks this entirely.
**Exceptions:** Theme preference (dark/light if added in V2) may use
localStorage as it is a pure UI preference with no security implications.
**Date:** May 2026

---

## ADR-010 — Multi-Tenancy: section_id on Every Query
**Decision:** Every table that contains section-specific data has a
`section_id` column. Every query against these tables MUST include a
`section_id` filter. RLS policies enforce this at the database level,
but application code must also filter explicitly.
**Rationale:** Defense in depth. If an RLS policy has a bug, the
application filter is a second line of defense. If the application
filter is missing, RLS catches it. Both must exist.
**Rule:** If you write a Supabase query that touches `announcements`,
`assignments`, `submissions`, `polls`, `votes`, `subjects`, or
`attendance_records` without a `section_id` filter, it is a bug.
**Date:** May 2026

---

## ADR-011 — CR Identity: Role Column, Not Separate Table
**Decision:** The CR is identified by `users.role = 'cr'`. There is
no separate `cr_profiles` table in V1.0.
**Rationale:** Simplicity. One section has one CR. A role column on
the `users` table is sufficient. Multi-CR support (for V2 when other
sections join) can be handled by allowing multiple `role = 'cr'` rows
per section without schema changes.
**users.id rule:** `users.id` is identical to `auth.users.id` from
Supabase Auth. Never generate a separate ID for a user.
**Date:** May 2026

---

## ADR-012 — Announcement Accountability: Three-Layer System
**Decision:** Critical announcement visibility and tracking are enforced through a three-layer high-fidelity loop:
1. **Real-time Notification / Web Push (V1.1):** Alerts the student immediately on their device or in-app to open the dashboard.
2. **Prominent Dashboard Critical Carousel:** A high-visibility, high-aesthetic red-accented alerts container positioned at the absolute top of the dashboard feed, ensuring it is seen first without obtrusively hijacking general navigation.
3. **Interactive Read Receipt (Acknowledge) & Targeted Nudges:** The student taps "Acknowledge" to log a read receipt. CRs can monitor granular section acknowledgment statistics in real-time and send a targeted 1-click nudge to unacknowledged students.
**`nudge_sent` boolean:** Set to `true` after the first nudge to prevent duplicate sends. Must be reset to `false` manually if a second nudge is intentionally needed.
**Date:** May 2026

---

## ADR-013 — Student Onboarding: OAuth + Invite Code
**Decision:** Students sign in with Google (domain-restricted), then
enter a section Invite Code generated by the CR. The invite code
sets their `section_id` in the `users` table.
**Rationale:** Email domain alone proves they are a SKIT student.
The invite code proves they belong to a specific section. This prevents
a CSE P1 student from accessing P2 data just because they have the
same email domain.
**Invite code rotation:** The CR can regenerate the invite code in the
Command Center. Old codes become invalid immediately.
**Date:** May 2026

---

## ADR-014 — Resource Hub V1: Hard Cutover
**Decision:** The existing Resource Hub V1 (static Vite app on Vercel)
is shut down when SectionHub V2 enters closed beta. No parallel running.
The Vercel deployment is deleted. The domain redirects to SectionHub.
**Rationale:** Parallel systems cause confusion about which is the
authoritative source. Students will use whichever is easier to find,
not whichever is more correct.
**Date:** May 2026

---

## ADR-015 — TypeScript: Strict Mode
**Decision:** The frontend is written in TypeScript with strict mode
enabled in `tsconfig.json`. No `any` types. No type assertions with
`as unknown` unless absolutely required with a comment explaining why.
**Rationale:** The team includes developers at different experience levels.
TypeScript strict mode catches integration bugs (Supabase response shapes,
component prop mismatches) at compile time rather than in production.
Types for the database are generated via `npx supabase gen types typescript`.
**Date:** May 2026

---

## ADR-016 — State Management: TanStack Query + Zustand
**Decision:**
- **Server state** (anything from Supabase): TanStack Query v5.
  All Supabase fetches go through `useQuery`. All Supabase mutations
  go through `useMutation` with `invalidateQueries` on success.
- **Client state** (UI only — modal open, active tab, form draft):
  Zustand. Lightweight, no boilerplate, no provider needed.
**Alternatives rejected:**
- Redux: Too much boilerplate for a team of students.
- React Context for server state: No caching, no background refetch,
  no deduplication. Leads to waterfall requests.
- SWR: TanStack Query v5 has better TypeScript support and mutation API.
**Date:** May 2026

---

## ADR-017 — Gmail Notice Sync (Deferred to Roadmap)
**Decision:** Automatic import of SKIT college emails into ClassHub
announcements via Gmail API (`gmail.readonly` scope), with Supabase Vault
token storage, scheduled Edge Function sync, rule-based classification,
and a CR pending-review queue.
**Status:** Deferred to future roadmap. Design complete, implementation
blocked on Google Cloud OAuth verification for SKIT Workspace accounts.
**Design decisions locked for when picked up:**
- Rule-based classifier only (no AI) — keyword + sender pattern matching
- Map notices to `general`/`critical` only (no new `important` priority)
- `pg_cron` + `pg_net` for scheduling inside Supabase
**Date:** May 2026

---

## ADR-018 — Multi-CR Identity + Transfer System
**Decision:** Add a two-tier CR model on top of the existing `role = 'cr'`
system. The distinction is purely about CR management — who can add, remove,
or transfer the role itself. App permissions (announcements, assignments,
polls, timetable) are identical for both ranks.
**Model:**
- `primary_cr` — exactly 1 per section. Can manage co-CRs, transfer primary.
- `co_cr` — max 2 per section. Full app permissions, cannot manage CRs.
- Max 3 CRs per section total.
**Schema changes:**
- `users.cr_rank` column (`'primary' | 'co' | null`)
- Constraint: `cr_rank IS NULL OR role = 'cr'`
- Unique index: exactly 1 primary per section
- Trigger: max 3 CRs per section
- `cr_transfer_log` audit table for all CR changes
**Management:** Four SECURITY DEFINER RPCs — never direct table writes:
1. `transfer_primary_cr(new_primary_id, old_cr_action)` — atomic swap
2. `promote_to_co_cr(target_user_id)` — primary CR only
3. `demote_co_cr(target_user_id)` — primary CR only
4. `resign_as_cr()` — any CR (primary must transfer first)
**What doesn't change:**
- `requireCr()` in Edge Functions — still checks `role = 'cr'`
- All existing RLS policies — `role = 'cr'` covers both ranks
- All feature permissions — tied to `section_id`, not rank
**Date:** May 2026

---

## Change Log
| Version | Change | Author |
|---|---|---|
| 1.0 | Initial 16 decisions locked | Himanshu Saini |
| 1.1 | ADR-017 (deferred), ADR-018 (Multi-CR) added | Himanshu Saini |
