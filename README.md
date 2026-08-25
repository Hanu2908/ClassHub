# ClassHub

Academic management progressive web application for engineering college sections. Built with React 19, TypeScript, Supabase, and Tailwind CSS.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://classshub.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PWA](https://img.shields.io/badge/PWA-Installable-8A2BE2)](https://web.dev/progressive-web-apps/)

---

## Overview

ClassHub replaces informal chat groups and loose spreadsheets with a structured, multi-tenant academic portal. The system coordinates schedules, subject attendance, assignments, announcements, and polls for college sections under section-level access control.

- **Live deployment**: [classshub.vercel.app](https://classshub.vercel.app)
- **Access requirement**: Google Workspace account with `@skit.ac.in` domain.

---

## Role-based workspaces

The application provides dedicated views tailored to five primary roles.

```
                  ┌──────────────────────────────┐
                  │      Google OAuth Login      │
                  │       (@skit.ac.in)          │
                  └──────────────┬───────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│ Student View  │        │   CR Command  │        │ Teacher View  │
│               │        │    Center     │        │               │
│ • Attendance  │        │ • Broadcasts  │        │ • Register    │
│ • Predictions │        │ • Register    │        │ • Timetable   │
│ • Assignments │        │ • Reports     │        │ • Notices     │
│ • Polls & Q&A │        │ • Submissions │        │ • Batches     │
└───────┬───────┘        └───────┬───────┘        └───────┬───────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
      ┌───────────────┐                     ┌───────────────┐
      │  Counsellor   │                     │   Developer   │
      │    Console    │                     │    Console    │
      │ • Mentorship  │                     │ • Telemetry   │
      │ • Remarks     │                     │ • Bug triage  │
      │ • Alerts      │                     │ • DB health   │
      └───────────────┘                     └───────────────┘
```

### Student workspace
- **Attendance calculations**: Subject-wise attendance percentages, safe bunks counter, classes needed for the 75% threshold, and exact integer target goals.
- **Attendance prediction engine**: Recovery date projection linked to weekly timetable frequency and the academic calendar, accounting for holidays and breaks.
- **What-if simulator**: Scenario modeling for boosting attendance, taking bunks, applying on-duty (OD) medical credits, or combining actions.
- **Assignment sets**: Automatic roll-number lookup to view assigned question sets and page ranges directly in the embedded PDF viewer.
- **Announcements and Q&A**: Filtered feed (Active, Exams, Schedule, Campus) with rich text formatting, threaded comments with edit and delete actions, emoji reactions, and 1-tap read receipts.
- **Polls**: Salted anonymous voting and class decision tracking.
- **Academic tools**: GPA calculator using university credits, relative grading distribution, exam schedule countdown, resource hub for notes and previous year question papers (PYQs), and a section directory with custom profile tags.

### Class representative command center
- **Multi-CR administration**: Two-tier model supporting 1 primary CR and up to 2 co-CRs per section with audited role transfer functions.
- **Class attendance register**: Period-by-period class register with present, absent, on-duty, and makeup toggles.
- **Multi-format report generation**: 1-tap export to WhatsApp-ready text summaries, in-app PDF document previews, and CSV downloads.
- **Broadcast announcements**: Priority alerts with instant Web Push delivery to all section members.
- **Assignment management**: Question set generator dividing document pages across roll number batches.
- **Submission tracking**: Real-time status tracker with verification toggles, student nudging, and shareable WhatsApp pending student lists.
- **Acknowledgment monitoring**: Live read-receipt audit to see which students have read urgent notices.
- **Section directory**: Roster management with role assignments and invite code rotation.

### Faculty workspace
- **Digital attendance register**: Period-by-period class register with present, absent, and medical leave toggles.
- **Multi-section timetable**: Schedule editor with batch assignments (Batch 1 and Batch 2) and room numbers.
- **Course notices**: Direct announcements to enrolled student sections.

### Counsellor workspace
- **Student mentorship console**: Attendance overview and academic records for assigned student batches.
- **Counsellor remarks**: Student feedback logging with automated in-app notifications.

### Developer workspace
- **System telemetry**: Sentry error tracking, client crash telemetry, feedback report triage, and database health metrics.

---

## Key technical subsystems

### 1. Web Share Target intake and smart parser
ClassHub registers a PWA Web Share Target handler (`/share-target`). When faculty or students share PDFs, photos, or message text from WhatsApp or other apps directly to ClassHub:
- The Service Worker intercepts the POST request and stages incoming files and text into local IndexedDB (`share-inbox`).
- A heuristic parser scans text for title, matching subject name, code, acronyms (such as DBMS, OS, CN, DSA, TOC), submission deadlines, and urgency level.
- Users receive a floating intake card with auto-filled fields and 1-tap routing to Announcement or Assignment composers.

### 2. Attendance intelligence and prediction engine
- **Precision arithmetic**: Uses exact integer arithmetic `(target * total - 100 * attended) / (100 - target)` to avoid floating-point rounding errors in class targets.
- **Timetable linkage**: Connects active schedule slots to subject attendance data to project the exact calendar date a student will cross 75%.
- **Academic calendar integration**: Evaluates scheduled day frequencies against institutional holidays and semester breaks.
- **Smart skip advisor**: Evaluates risk levels (safe, warning, critical) and calculates the projected percentage before a student skips a specific lecture.

### 3. Multi-format export and in-app document pipeline
- **WhatsApp report formatter**: Generates plain-text summaries with attendance counts, roll-sorted absent lists, and formatted pending assignment rosters.
- **Canvas-rendered PDF preview**: Uses PDF.js canvas rendering and `pdf-lib` for in-app document generation and viewing without external readers.
- **Client-side image compression**: Converts images to WebP format (max 1600px, quality 0.8) using `OffscreenCanvas` before upload, reducing 5MB to 10MB mobile photos to under 250KB.
- **Batched metadata writes**: Successful file uploads write to the database in a single batch insert query.
- **Long-term caching**: Storage assets include 1-year immutable cache headers.

### 4. Offline queue and background sync
- User actions performed while offline (such as voting on polls or acknowledging notices) queue into IndexedDB.
- When network connectivity returns, the Service Worker background sync replays queued transactions against Supabase REST endpoints without duplicate submissions.

### 5. Web Push notifications and lock-screen actions
- Push notifications run through VAPID Web Push via Supabase Edge Functions.
- Notifications include interactive action buttons. Students can tap "Acknowledge" directly from the system notification tray or lock screen to log their read receipt without opening the browser.
- Subscription self-healing runs on `pushsubscriptionchange` to update invalid endpoints automatically.

### 6. Salted anonymous polling
- To preserve ballot privacy while preventing double voting, poll responses use a database function (`calculate_anonymous_token`).
- The function combines the student ID, poll ID, and a section salt to generate a one-way voter token. The database stores the vote without recording the student ID in the response record.

---

## Tech stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, TypeScript (Strict), React Router v7 |
| **Styling & UI** | Tailwind CSS v3, Motion, Radix UI Primitives, Lucide Icons, Sonner |
| **State management** | Zustand v5 (client state and offline store), TanStack Query v5 (server cache) |
| **Backend** | Supabase (PostgreSQL 15, Auth, Storage, Edge Functions) |
| **PWA & Media** | Vite PWA Plugin, Workbox, Web Share Target API, Web Push VAPID, PDF.js, pdf-lib |
| **Analytics & Telemetry** | Vercel Speed Insights, Vercel Analytics, Sentry |
| **Testing** | Vitest 4, React Testing Library, Happy DOM (210 unit and integration tests) |
| **Deployment** | Vercel (frontend), Supabase Cloud (backend) |

---

## Database schema and security

The database uses PostgreSQL 15 with Row-Level Security (RLS) enabled on all 25+ tables:

```
sections ──────────┬─── users ───────────────┬─── user_tags
                   ├─── subjects             └─── cr_transfer_log
                   ├─── timetable_slots
                   ├─── attendance_records
                   ├─── attendance_class_logs
                   ├─── cr_attendance_records
                   ├─── counsellor_remarks
                   ├─── announcements ───────┬─── acknowledgments
                   │                         ├─── announcement_comments
                   │                         └─── announcement_reactions
                   ├─── assignments ─────────┬─── assignment_sets
                   │                         └─── submissions
                   ├─── polls ───────────────┬─── poll_options
                   │                         └─── votes
                   ├─── exams
                   ├─── attachments
                   ├─── push_subscriptions
                   └─── feedback_reports
```

### Security rules
- **Tenant isolation**: Every table includes a `section_id` foreign key. Row-Level Security policies reject queries outside the authenticated user's assigned section.
- **Domain restriction**: Auth triggers reject non-`@skit.ac.in` logins and revoke sessions immediately.
- **Credential safety**: ClassHub never requests, stores, or scrapes third-party ERP passwords.
- **Role enforcement**: Administrative endpoints verify `role = 'cr'`, `role = 'teacher'`, or `is_developer = true` through Postgres functions.

---

## Local development

### Prerequisites
- Node.js 18 or higher
- npm 9 or higher

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Hanu2908/ClassHub.git
cd ClassHub
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```
Fill in your Supabase URL, anon key, and VAPID public key in `.env`.

4. Start the local Vite development server:
```bash
npm run dev
```

### Available scripts

```bash
npm run dev        # Starts Vite local development server
npm test           # Runs Vitest test suite
npm run build      # Compiles TypeScript and builds production PWA bundle
npm run lint       # Runs ESLint checks across source files
npm run preview    # Previews the production build locally
```

---

## Testing

ClassHub maintains test coverage across calculations, permission policies, parsing logic, and component behaviors:

```bash
npm test -- --run
```

All 210 tests across 24 test suites covering attendance models, recovery prediction formulas, GPA algorithms, RLS authorization checks, attachment validation, and offline stores must pass before deployment.

---

## Contributing and license

Contributions are welcome. Please read our [Contributing guide](CONTRIBUTING.md), [Code of conduct](CODE_OF_CONDUCT.md), and [Security policy](SECURITY.md) before submitting issues or pull requests. See [Changelog](CHANGELOG.md) for version history.

ClassHub is developed for the student community at SKIT Jaipur by [Himanshu Saini](https://github.com/Hanu2908) and project contributors.

This project is licensed under the [MIT License](LICENSE).
