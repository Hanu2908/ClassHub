# Project Snapshot — ClassHub

**Overview**
- **Name:** ClassHub
- **Type:** Multi-tenant academic management PWA (student/section hub)
- **Primary goal:** Manage sections, attendance, assignments, polls, announcements and push subscriptions for academic cohorts.

**Stack**
- Frontend: React 18 + Vite + TypeScript (strict) + Tailwind CSS
- State + Data: TanStack Query v5, Zustand
- Backend: Supabase (Postgres 15, Auth, Edge Functions)
- Deploy: Vercel (frontend) and Supabase Cloud (backend)
- Testing: Vitest for unit tests

**Core Database Tables (12)**
- sections, users, subjects, attendance_records, announcements,
  acknowledgments, assignments, assignment_sets, submissions,
  polls, votes, push_subscriptions
(See schema: [docs/schema.sql](docs/schema.sql))

**Key code areas**
- UI pages: [src/pages/app](src/pages/app)
  - Attendance page: [src/pages/app/AttendancePage.tsx](src/pages/app/AttendancePage.tsx#L1)
  - Assignments, Polls, Dashboard etc. in the same folder.
- Shared UI/components: [src/components](src/components)
- Data access + helpers: [src/lib](src/lib)
- Hooks: [src/hooks](src/hooks)
- Tests: [tests/unit](tests/unit)

**RLS / Security notes**
- Project follows RLS-first thinking (see [AGENTS.md](AGENTS.md)).
- Important rules: section-scoped tables must filter by `section_id`; poll votes must avoid exposing `student_id` in general polls.

**Status as of this change**
- Unit tests pass locally: 9 tests, all passing.
- I added a few utility and validation modules to satisfy existing tests (see "Recent changes").
- I added a `test` script to `package.json` so tests can be invoked via `npm test` (after installing deps).

**Recent changes (files added/updated)**
- New/updated utilities and validation used by tests:
  - [src/lib/utils/attendance.ts](src/lib/utils/attendance.ts#L1)
  - [src/lib/utils/rolls.ts](src/lib/utils/rolls.ts#L1)
  - [src/lib/utils/permissions.ts](src/lib/utils/permissions.ts#L1)
  - [src/lib/validation/assignments.schema.ts](src/lib/validation/assignments.schema.ts#L1)
  - [src/lib/validation/onboarding.schema.ts](src/lib/validation/onboarding.schema.ts#L1)
  - [src/lib/validation/polls.schema.ts](src/lib/validation/polls.schema.ts#L1)
  - [src/lib/validation/timetable.schema.ts](src/lib/validation/timetable.schema.ts#L1)
- Added a small barrel export: [src/lib/index.ts](src/lib/index.ts#L1)
- Created CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Added edge-case tests: [tests/unit/attendance.parse.test.ts](tests/unit/attendance.parse.test.ts#L1)
- Updated: [package.json](package.json#L1) (added `test` script and pinned `vitest` devDependency)

**How to run tests locally**
- Install dev deps (recommended):

```bash
npm ci
```

- Run tests:

```bash
npm test
# or
npx vitest run
```

**Notes on `parseERPAttendance`**
- The ERP parser accepts TSV or space-separated exports and attempts to reconstruct subject code and name by locating the subject `type` token (e.g. `Lecture`) and treating preceding tokens as `[serial?, code, name words...]`.
- Edge cases handled: Windows CRLF, tab-separated input, single-space or multi-space separation, optional extra numeric columns (OD, makeup).

**Next recommended steps (already applied where possible)**
1. Add CI to run tests on PRs (created `.github/workflows/ci.yml`).
2. Add `vitest` as devDependency and `test` script (done in `package.json`).
3. Add `src/lib/index.ts` barrel to simplify imports (done).
4. Add extra unit tests for edge cases (added small attendance parse tests).
5. (Optional) Add a lightweight CONTRIBUTING.md explaining how to run tests and format commits.

**Contact / follow-ups**
- If you want I can commit these changes to a branch, open a PR, and/or create the GitHub Actions secret/config for CI. Tell me which next step you prefer.
