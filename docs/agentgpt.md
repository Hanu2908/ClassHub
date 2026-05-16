# rules.md

```md
# SectionHub Agent Rules

## Project Identity

SectionHub is a mobile-first Progressive Web App (PWA) for college section management and academic coordination.

Primary users:
- Students
- Class Representatives (CR)

The application is initially built for:
- SKIT Jaipur
- Section P2

The system is architected for future multi-section scaling.

---

# Core Product Philosophy

The app is NOT:
- a social media app
- a generic LMS clone
- a chat app
- a decorative student portal

The app IS:
- an academic operations platform
- a section coordination system
- a productivity-first dashboard
- a CR operational control system

---

# Product Priorities

Priority order:

1. Security
2. Clarity
3. Reliability
4. Mobile usability
5. Performance
6. Visual polish

Never sacrifice:
- data isolation
- role boundaries
- responsiveness
- readability

for visual aesthetics.

---

# Technical Stack

Frontend:
- React
- Vite
- TypeScript

Styling:
- Tailwind CSS
- shadcn/ui

Backend:
- Supabase

Database:
- PostgreSQL

Hosting:
- Vercel

State:
- Zustand

Forms:
- React Hook Form
- Zod

Charts:
- Recharts

PWA:
- vite-plugin-pwa

---

# Frontend Rules

## Design Philosophy

Student UI:
- calm
- fast-scanning
- low cognitive load
- Material You inspired
- mobile-first

CR UI:
- operational
- denser
- analytics-oriented
- dashboard-focused

---

## UI Rules

DO:
- use reusable components
- use Tailwind utility classes
- use shadcn/ui primitives
- optimize for 375px mobile width first
- maintain consistent spacing
- build responsive layouts

DO NOT:
- use inline styles unless absolutely necessary
- hardcode colors repeatedly
- create inconsistent spacing systems
- create desktop-first layouts
- introduce unnecessary animations
- use glassmorphism heavily
- create social-media-style UI

---

# Backend Rules

## Security

Every table MUST:
- use Row Level Security
- be scoped by section_id where applicable
- enforce role boundaries

Never trust frontend validation alone.

Always validate:
- role permissions
- section ownership
- authenticated identity

---

## Authentication Rules

Authentication uses:
- Google OAuth
- Supabase Auth

Allowed domain:
- @skit.ac.in only

Always validate email domain server-side.

---

# Database Rules

## Schema Discipline

Schema file:
- docs/schema.sql

This file is the source of truth.

Never create tables manually without updating schema.sql.

Never allow schema drift.

---

## Migration Rules

When changing schema:
1. Update schema.sql
2. Document reason in decisions.md
3. Verify foreign key integrity
4. Re-test RLS

---

# Code Quality Rules

## TypeScript

- Avoid any type whenever possible
- Prefer strict typing
- Use typed interfaces
- Use Zod validation for runtime safety

---

## Components

Prefer:
- small reusable components
- feature-based architecture
- composition over massive files

Avoid:
- giant page components
- duplicated logic
- deeply nested JSX

---

# Folder Structure Rules

Use feature-based organization.

Example:

src/
  features/
    assignments/
    attendance/
    polls/
    announcements/

---

# Performance Rules

DO:
- lazy load heavy routes
- memoize expensive calculations
- optimize queries
- paginate large datasets

DO NOT:
- fetch unnecessary data
- expose entire tables
- run large unfiltered queries

---

# UX Rules

The app should:
- reduce student stress
- prioritize today's tasks
- minimize friction
- make important information instantly visible

Critical notices must feel urgent.

Assignments must feel actionable.

Attendance risk must feel understandable.

---

# Important Product Constraints

Never build features outside PRD scope unless explicitly approved.

Current excluded features:
- social chat
- resource uploads by students
- public discussion boards
- gamification systems
- AI chatbot features

---

# Final Rule

Optimize for:
- maintainability
- scalability
- security
- clarity

NOT for:
- flashy UI
- overengineering
- unnecessary abstractions
```

---

# decisions.md

```md
# SectionHub Decisions Log

## Architecture Decisions

### Decision 1
Use Supabase as backend.

Reason:
- fast iteration
- PostgreSQL-native
- built-in auth
- strong RLS support
- good TypeScript ecosystem

---

### Decision 2
Use PostgreSQL instead of MySQL.

Reason:
- stronger relational modeling
- better RLS integration
- better long-term scalability

---

### Decision 3
Use Tailwind CSS + shadcn/ui.

Reason:
- scalable UI system
- faster iteration
- cleaner consistency
- better responsive workflows
- easier collaboration for team

Previous direction:
- inline CSS

Why changed:
Project scope expanded significantly.

---

### Decision 4
Use React + Vite + TypeScript.

Reason:
- modern frontend workflow
- fast development
- scalable architecture
- strong typing

---

### Decision 5
Use Zustand instead of Redux.

Reason:
- lower complexity
- less boilerplate
- easier onboarding
- enough for project scale

---

### Decision 6
Use Material You inspired UI direction.

Reason:
- mobile-first usability
- familiar Android interaction patterns
- accessibility
- calmer student UX

---

### Decision 7
Separate Student UI and CR UI visually.

Student UI:
- calmer
- simpler
- lower density

CR UI:
- operational
- analytics-focused
- denser

Reason:
Different workflows require different information hierarchy.

---

### Decision 8
Use Row Level Security on every table.

Reason:
- section isolation
- production-grade security
- backend-enforced authorization

---

### Decision 9
Authentication restricted to @skit.ac.in domain.

Reason:
- verified institutional identity
- prevent unauthorized access

---

### Decision 10
Assignments support personalized assignment sets.

Reason:
Professors assign different work ranges based on roll numbers.

This is a major product differentiator.

---

### Decision 11
Use acknowledgments table for critical notices.

Reason:
Need verifiable acknowledgment tracking.

WhatsApp-style visibility is insufficient.

---

### Decision 12
Use invite code onboarding flow.

Flow:
1. Google OAuth
2. Enter invite code
3. Join section

Reason:
Allows scalable multi-section onboarding.

---

### Decision 13
Treat authentication and authorization separately.

Google OAuth:
- proves identity

RLS + roles:
- control permissions

---

### Decision 14
Use feature-based frontend architecture.

Reason:
Better scaling and maintainability.

---

### Decision 15
Optimize mobile-first from day one.

Primary target width:
- 375px
- Android-first usability

Reason:
Most students use phones primarily.
```

---

# front.md

```md
# SectionHub Frontend Context

# Frontend Stack

Core:
- React
- Vite
- TypeScript

Styling:
- Tailwind CSS
- shadcn/ui

State:
- Zustand

Forms:
- React Hook Form
- Zod

Charts:
- Recharts

PWA:
- vite-plugin-pwa

---

# Frontend Architecture

The frontend uses:
- feature-based architecture
- reusable component systems
- centralized design tokens
- responsive mobile-first layouts

---

# Design Direction

## Student Experience

Goals:
- calm productivity
- fast scanning
- reduced stress
- low friction
- clear hierarchy

Visual inspiration:
- Material You
- Google Classroom
- modern Android productivity apps

---

## CR Dashboard Experience

Goals:
- operational clarity
- fast actions
- analytics visibility
- workflow efficiency

Visual inspiration:
- Linear
- Notion
- admin dashboards

---

# Frontend Folder Philosophy

Use:

src/
  components/
  features/
  hooks/
  stores/
  lib/
  routes/
  layouts/

---

# Features

## Student Features

- dashboard
- assignments
- announcements
- attendance
- polls
- timetable
- profile

---

## CR Features

- command center
- assignment management
- notice creation
- acknowledgment tracking
- poll creation
- timetable management
- analytics

---

# State Management

Use Zustand for:
- auth state
- user state
- dashboard cache
- UI state
- optimistic updates

Avoid massive global stores.

Keep feature state localized when possible.

---

# Forms

Use:
- React Hook Form
- Zod schemas

All forms must:
- validate inputs
- show proper error states
- support loading states
- prevent invalid submissions

---

# Responsive Rules

Primary target:
- mobile first

Target widths:
- 375px
- 390px
- 412px

Desktop support is secondary.

---

# UI Component Rules

DO:
- use reusable cards
- use consistent spacing
- use semantic colors
- use loading skeletons
- use proper empty states

DO NOT:
- use random spacing values
- mix multiple visual styles
- create inconsistent cards
- overload screens with information

---

# Navigation Structure

Student Bottom Nav:
- Home
- Assignments
- Polls
- Profile

CR Dashboard:
- sidebar or dense dashboard nav

---

# Important UX Priorities

The app must:
- surface urgent information quickly
- reduce missed assignments
- make attendance understandable
- reduce CR communication friction

---

# Important Screens

## Student
- Welcome screen
- Join Hub screen
- Dashboard
- Assignments
- Attendance
- Polls
- Announcements
- Profile

## CR
- Command Center
- Create Assignment
- Create Notice
- Poll Creator
- Submission Tracker
- Timetable CRUD

---

# Performance Expectations

- fast initial load
- smooth transitions
- optimized rendering
- minimal unnecessary rerenders
- lazy loaded routes where needed

---

# Final Frontend Goal

The app should feel:
- production-ready
- modern
- operationally useful
- mobile-native
- trustworthy

NOT like:
- a student side project
- a social app
- a generic dashboard template
```

---

# backend.md

```md
# SectionHub Backend Context

# Backend Stack

Backend:
- Supabase

Database:
- PostgreSQL

Authentication:
- Supabase Auth
- Google OAuth

Security:
- Row Level Security (RLS)

---

# Core Backend Philosophy

The backend is designed around:
- security
- section isolation
- relational integrity
- scalability
- role-based access

---

# Authentication Flow

1. User signs in with Google OAuth
2. Supabase validates identity
3. Backend validates @skit.ac.in domain
4. User enters invite code
5. User joins section

---

# Important Security Rule

Authentication != Authorization

Google OAuth only proves identity.

Permissions are enforced through:
- roles
- section ownership
- RLS policies

---

# User Roles

Roles:
- student
- cr

CR permissions are elevated but still section-scoped.

---

# Database Design

Database uses PostgreSQL relational modeling.

All tables:
- use UUID primary keys
- use strict foreign keys
- use relational constraints
- enforce integrity

---

# Core Tables

1. sections
2. users
3. subjects
4. attendance_records
5. announcements
6. acknowledgments
7. assignments
8. assignment_sets
9. submissions
10. polls
11. votes
12. push_subscriptions

---

# Most Important Product Logic

## Personalized Assignment Sets

Students only see assignments mapped to their roll range.

Logic:
- extract numeric roll suffix
- match against assignment_sets range
- show only assigned set

---

## Critical Notices

Critical notices:
- remain persistent
- require acknowledgment
- are tracked in acknowledgments table

CR can:
- see acknowledgment analytics
- send nudges
- track unacknowledged students

---

# RLS Philosophy

Every table must:
- enforce section isolation
- prevent cross-section leakage
- restrict unauthorized access

Students:
- only access their own section
- only modify allowed records

CRs:
- receive elevated section-scoped access

---

# Important Backend Constraints

Never:
- trust frontend checks
- expose entire tables
- bypass RLS
- expose student data across sections

---

# Attendance System

Attendance uses aggregate values only.

Stored:
- attended
- total

Not stored:
- class-by-class logs

Reason:
privacy and simplicity.

---

# Poll System

Two poll types:

## General Polls
- anonymous
- aggregate results only
- no student visibility leakage

## Actionable Polls
- CR-visible responses
- warning shown before voting

---

# Push Notification Architecture

Future V1.1 feature.

Infrastructure already planned:
- push_subscriptions table
- VAPID keys
- service workers
- notification flows

---

# Backend Development Rules

When changing schema:
1. update schema.sql
2. update RLS
3. test with dummy account
4. document changes

---

# Query Rules

DO:
- select only needed fields
- paginate large lists
- optimize joins
- use indexes correctly

DO NOT:
- overfetch data
- expose raw sensitive data
- bypass role checks

---

# Testing Requirements

Every feature must be tested with:
- student account
- CR account
- invalid account
- cross-section isolation checks

---

# Final Backend Goal

The backend should feel:
- secure
- scalable
- production-grade
- maintainable
- multi-tenant ready

NOT like:
- a hackathon backend
- a prototype-only system
```
