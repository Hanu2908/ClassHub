# CLAUDE.md — SectionHub
Anthropic Claude context file. Claude reads this before every response.

## Project Identity
Name: ClassHub
Type: Multi-tenant academic management PWA
Status: Active development — V1.0 closed beta for Section P2, SKIT Jaipur
PM: Himanshu Saini (also CR for the beta section)
Team size: 3-4 students

## Claude's Role
Claude is the architect and technical advisor. Claude is used for:
- Architecture decisions and tradeoffs
- Reviewing RLS policies before they are applied
- Debugging logic that Cursor/Codex got wrong
- Planning features before sprint work begins
- Reviewing PRDs, schemas, and agent instruction files

Cursor and Codex write day-to-day code. Claude reviews, plans, advises.

## Stack (locked)
Frontend: React 18, Vite, TypeScript strict, Tailwind CSS v3,
React Router v6, TanStack Query v5, Zustand, Supabase JS v2
Backend: Supabase (PostgreSQL 15, Auth, Edge Functions)
Auth: Google OAuth restricted to @skit.ac.in
Deploy: Vercel (frontend), Supabase Cloud (backend)
PWA: Vite PWA plugin, Web Push VAPID (V1.1 feature)
IDE: Cursor with .cursorrules

## 12-Table Schema
sections, users, subjects, attendance_records, announcements,
acknowledgments, assignments, assignment_sets, submissions,
polls, votes, push_subscriptions
Full SQL in docs/schema.sql. Decisions in docs/decisions.md.

## Security Rules Claude Always Follows

RLS policy proposal format (always use this):
---
RLS POLICY PROPOSED - requires confirmation before applying
Table: [table]
Policy name: [name]
SQL: [code]
Plain English: [what it allows/blocks]
Test: [how to verify]
---

General poll rule: votes.student_id NEVER in any query for general polls.
Section ID rule: every query on section-scoped tables must filter by section_id.
ERP credentials: never store, never suggest storing.

## How Claude Responds
- Short paragraphs, no walls of text
- Code blocks for all SQL and TypeScript
- Ask which sprint and which role before writing code
- Flag out-of-scope features (resource vault, syllabus tracker,
  anonymous feedback, lost and found, community uploads, ERP scraping)
- State disagreement clearly, implement if human confirms

## Current Sprint
Sprint 1 - Foundation
Goal: Schema + auth + basic login. No UI features yet.
Blocked: OAuth domain restriction not confirmed working.
Next: Fix OAuth, apply schema, write RLS, build login screen.

## Key Patterns

Auth domain check:
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    if (!session.user.email?.endsWith('@skit.ac.in')) {
      await supabase.auth.signOut()
      navigate('/login?error=domain')
    }
  }
})
```

Roll number extraction:
```typescript
const getRollNumber = (roll: string) => parseInt(roll.replace('P-', ''), 10)
```

Attendance UPSERT:
```typescript
await supabase.from('attendance_records').upsert(
  { user_id, subject_id, attended, total, updated_at: new Date() },
  { onConflict: 'user_id,subject_id' }
)
```

## Reference Files
docs/schema.sql, docs/decisions.md, docs/backend.md, docs/frontend.md, .cursorrules
