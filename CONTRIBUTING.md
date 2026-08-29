# Contributing to ClassHub

Thank you for your interest in contributing to ClassHub. This document outlines the process for proposing changes, setting up your development environment, and submitting pull requests.

Please read our [Code of conduct](CODE_OF_CONDUCT.md) before participating.

---

## Table of contents

1. [Project overview and scope](#project-overview-and-scope)
2. [Getting started](#getting-started)
3. [Development workflow](#development-workflow)
4. [Coding standards](#coding-standards)
5. [Database and security rules](#database-and-security-rules)
6. [Testing requirements](#testing-requirements)
7. [Commit message conventions](#commit-message-conventions)
8. [Submitting a pull request](#submitting-a-pull-request)
9. [Out-of-scope features](#out-of-scope-features)

---

## Project overview and scope

ClassHub is a multi-tenant academic progressive web application built for college sections. It coordinates class schedules, subject attendance tracking, assignments, announcements, and polls under section-level access control.

- **Stack**: React 19, TypeScript (Strict), Vite 8, Tailwind CSS v3, Supabase (PostgreSQL 15, Auth, Storage, Edge Functions), TanStack Query v5, Zustand v5, Vitest 4.
- **Repository**: [github.com/Hanu2908/ClassHub](https://github.com/Hanu2908/ClassHub)

---

## Getting started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Local environment setup

1. Fork the repository on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ClassHub.git
   cd ClassHub
   ```

2. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/Hanu2908/ClassHub.git
   ```

3. Install project dependencies:
   ```bash
   npm install
   ```

4. Set up local environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase project URL, anonymous public key, and VAPID key in `.env`.

5. (Optional) Run local Supabase database stack:
   ```bash
   supabase start      # Starts local Postgres, Auth, Storage, and Studio
   supabase db reset    # Applies all migrations and seeds deterministic Section P2 data from supabase/seed.sql
   ```
   For detailed database architecture and seeding documentation, refer to [docs/backend.md](docs/backend.md).

6. Start the Vite development server:
   ```bash
   npm run dev
   ```

---

## Development workflow

1. Ensure your local `main` branch is synchronized with upstream:
   ```bash
   git checkout main
   git pull upstream main
   ```

2. Create a dedicated feature or fix branch from `main`:
   ```bash
   git checkout -b feat/attendance-export-filters
   # or
   git checkout -b fix/poll-vote-duplicate-toast
   ```

3. Make your changes and run verification scripts locally:
   ```bash
   npm run lint       # Runs ESLint checks across source code
   npm test           # Runs Vitest unit and integration suites
   npm run build      # Compiles TypeScript and builds production assets
   ```

---

## Coding standards

### TypeScript
- Enable TypeScript strict mode at all times. Do not use `any` types.
- Define explicit interfaces and types for component props, data models, and API responses.
- Place shared types in `src/types/` or co-located utility type files.

### Component design and state management
- Use functional components with React hooks.
- **Server state**: Use TanStack Query (`useQuery`, `useMutation`). Always invalidate relevant queries on mutation success.
- **Client and UI state**: Use Zustand stores (`src/store/appStore.ts`) for modal states, local drafts, or transient filters.
- **Form validation**: Use React Hook Form with Zod schemas where complex validation is required.

### Styling
- Use Tailwind CSS utility classes defined in `tailwind.config.js`.
- Use the shared design system variables (`var(--border-default)`, `var(--text-primary)`, `var(--font-display)`).
- Support dark-mode aesthetics consistently across all components.

---

## Database and security rules

All contributors must adhere to the following non-negotiable security requirements:

1. **Row-Level Security (RLS)**: Every new database table must have Row-Level Security enabled with explicit policies for SELECT, INSERT, UPDATE, and DELETE.
2. **Section tenant isolation**: Every table containing section data must include a `section_id` foreign key. Application queries on these tables must explicitly filter by `section_id`.
3. **Domain restriction**: Only `@skit.ac.in` Google Workspace accounts are permitted to authenticate.
4. **Zero ERP credentials**: Never build features that request, scrape, or store student or faculty ERP passwords.
5. **Vote integrity**: Anonymous polls must never store `student_id` in general vote records. Use the database `calculate_anonymous_token` function for one-way voter tokens.
6. **Migrations**: Database schema changes must be submitted as SQL migration files under `supabase/migrations/` with UTC timestamp prefixes.

---

## Testing requirements

ClassHub relies on Vitest and React Testing Library to prevent regressions:

- Add unit tests for calculation algorithms, parsing logic, and permission helpers in `tests/unit/`.
- Add integration tests for composite UI workflows in `tests/integration/`.
- Run the full test suite before committing:
  ```bash
  npm test -- --run
  ```
- All 210+ tests must pass before submitting a pull request.

---

## Commit message conventions

ClassHub follows the Conventional Commits specification. Keep commit subject lines under 60 characters and write in the imperative mood.

### Allowed types:
- `feat`: A new feature or capability
- `fix`: A bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding or correcting tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks, dependency updates, or configuration changes

### Examples:
- `feat(attendance): add WhatsApp plain-text report export`
- `fix(polls): resolve double-vote state on slow network`
- `docs(readme): update role workspaces and schema diagram`

---

## Submitting a pull request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/attendance-export-filters
   ```

2. Open a pull request against the `main` branch of `Hanu2908/ClassHub`.
3. Fill out the pull request template completely.
4. Link the relevant issue number in the PR description (such as `Fixes #42`).
5. Ensure continuous integration checks (lint, build, test) pass in GitHub Actions.
6. Respond to code review feedback promptly.

---

## Out-of-scope features

To maintain focus and security, the following features are explicitly out of scope for ClassHub:

- Automated ERP scraping or credential vaults
- Public unrestricted file drops or community file dumps
- Anonymous grievance boards without section accountability
- Generic chat applications replacing existing messaging channels

Thank you for helping build ClassHub for the college community.
