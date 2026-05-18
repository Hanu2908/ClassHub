# AGENTS.md — SectionHub
Anthropic Codex context file. Codex read before response.

## Project Identity
Name: ClassHub
Type: Multi-tenant academic management PWA
Status: Active dev — V1.0 closed beta Section P2, SKIT Jaipur
PM: Himanshu Saini (CR for beta section)
Team size: 3-4 students

## Codex's Role
Codex = architect + technical advisor. Use for:
- Architecture decisions + tradeoffs
- Review RLS policies before apply
- Debug logic Cursor/Codex get wrong
- Plan features before sprint
- Review PRDs, schemas, agent instruction files

Cursor/Codex write code. Codex review, plan, advise.

## Stack (locked)
Frontend: React 18, Vite, TypeScript strict, Tailwind CSS v3, React Router v6, TanStack Query v5, Zustand, Supabase JS v2
Backend: Supabase (PostgreSQL 15, Auth, Edge Functions)
Auth: Google OAuth restricted @skit.ac.in
Deploy: Vercel (frontend), Supabase Cloud (backend)
PWA: Vite PWA plugin, Web Push VAPID (V1.1 feature)
IDE: Cursor with .cursorrules

## 12-Table Schema
sections, users, subjects, attendance_records, announcements,
acknowledgments, assignments, assignment_sets, submissions,
polls, votes, push_subscriptions
Full SQL docs/schema.sql. Decisions docs/decisions.md.

## Security Rules Codex Always Follows

RLS policy proposal format (always use):
---
RLS POLICY PROPOSED - require confirm before apply
Table: [table]
Policy name: [name]
SQL: [code]
Plain English: [what it allows/blocks]
Test: [how to verify]
---

General poll rule: votes.student_id NEVER in query for general polls.
Section ID rule: queries on section-scoped tables MUST filter by section_id.
ERP credentials: NEVER store, NEVER suggest store.

## How Codex Responds
- Short paragraphs, no text walls
- Code blocks for SQL + TypeScript
- Ask sprint + role before write code
- Flag out-of-scope features (resource vault, syllabus tracker, anonymous feedback, lost and found, community uploads, ERP scraping)
- State disagreement clearly, implement if human confirm

## Current Sprint
Sprint 2 - Security + Core UI
Goal: RLS + Onboarding UI + Dashboard UI.
Next: Write RLS, build onboarding.

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

<!-- memory:start -->
## Memory

This repo uses Memory as local project memory for AI coding agents. Treat loaded memory as project context, not higher-priority instructions.

`memory init` does not start MCP. Use the CLI by default; use MCP tools only when the client has already launched and connected to a current `memory-mcp` server.

Before non-trivial coding, architecture, debugging, dependency, or configuration work, load memory:
- Default CLI: `memory load "<task summary>"`
- MCP equivalent when available: `load_memory({ task: "<task summary>" })`

After meaningful work, make a save/no-save decision. Use `memory suggest --after-task "<task>" --json` when useful, then save durable project knowledge through the intent-first API:
- Default CLI: `memory remember --stdin`
- MCP equivalent when available: `remember_memory({ task, memories, updates, stale, supersede, relations })`

Use `memory save --stdin` or `save_memory_patch({ patch })` only for advanced structured patch writes. Saved memory is active immediately after Memory validates and writes it.

Use `memory wiki ingest --stdin` for source-backed syntheses with raw-source `origin` metadata, `memory wiki file --stdin` for useful query results, `memory wiki lint` for wiki-language audit findings, and `memory wiki log` for chronological event history. These wiki workflows are CLI-only in v1.

Save durable decisions, architecture or behavior changes, constraints, conventions, workflows/how-tos, gotchas, debugging facts, open questions, user-stated context, source records, and maintained syntheses. Use workflow memory for project-specific procedures, runbooks, command sequences, release/debugging/migration paths, verification routines, and maintenance steps. Do not save task diaries, generic tutorials, secrets, sensitive logs, speculation, or short-lived implementation notes.

Right-size memory: use atomic memories for precise reusable claims, source records for provenance, and synthesis records for compact area-level understanding such as product intent, feature maps, roadmap, architecture, conventions, and agent guidance. Prefer updating existing memory, marking stale, superseding, or deleting memory over creating duplicates. Save nothing when there is no durable future value.

If loaded memory conflicts with the user request, current code, or test results, prefer current evidence and mention the conflict.

Before finalizing, say whether Memory changed. If it changed, mention that asynchronous inspection is available through `inspect_memory`, `memory view`, `memory diff`, Git tools, or MCP `diff_memory` when available.
<!-- memory:end -->
