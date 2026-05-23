# Resource Hub V2 Integration — Design Specification

## Overview
ClassHub will integrate the static Resource Hub V1 into a dynamic, highly responsive, and multi-tenant feature page. This page will preserve the unique **electric violet neon styling** and monospaced typography of the original system while providing an inline **Admin Edit Mode** (Option B) for real-time link maintenance without code changes.

---

## Architectural & UX Flow

### 1. Route & Navigation
* **URL Location**: `/app/resource-hub`
* **Access Point**: An elegant, rectangular button placed inside `src/pages/app/ProfilePage.tsx` with external-navigation indicators (`<ExternalLink size={18} />`).
* **Exit Point**: A floating, custom styled "Back" arrow button at the top-left to return to the Profile page seamlessly.
* **Scope**: Pure Resource Vault + PYQ Papers section. Timetable and counting features are excluded to avoid redundancies with ClassHub's existing dynamic schedule page.

### 2. Branding & Search Header
* **Theme**: Custom violet backdrop matching the V1 (`#0A0A0F` base, `#13131C` card surface, `#8B5CF6` electric violet accents, and `'IBM Plex Mono'` / `'Bebas Neue'` fonts).
* **Magnifying Glass Trigger**: A sleek rectangular button labeled `🔍 SEARCH` or `[ SEARCH 🔍 ]` matching the V1 share/branch button aesthetics. Clicking it smoothly slides open a glassmorphic search input field that filters subjects in real-time.
* **Minimalist Pill Selectors**: A swipable row of capsule pills (`Sem 1`, `Sem 2`, `Sem 3`...) for semesters and a branch selector badge (`All`, `IT`, `CSE`, `ME`, `EC`...).

### 3. Inline Admin Edit Mode (Option B)
* **Visibility**: When the signed-in user's role is CR (`authUser.role === 'cr'`), a subtle monospaced `[ EDIT ]` button appears on each subject card.
* **Editing Mechanism**: Tapping `[ EDIT ]` slides up ClassHub's pointers-physics `BottomSheet` with inputs for:
  - Subject Name & Code
  - Branch & Semester assignment
  - Accent Color Border Glow
  - Google Drive URLs: Syllabus, Notes, PYQs, Practice Questions, and Lab Manual.
* **Instant Update**: Saving the form triggers a Supabase UPDATE query, refreshing the view in real-time.

---

## Data Model & Database Schema

The Resource Hub V2 is backed by two global database tables in Supabase, allowing any student from any section/year to read the resources, while restricting write operations to CR admins.

### Table Schema Definition

```sql
-- 1. Global Resources Table
CREATE TABLE global_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  semester TEXT NOT NULL,           -- "Semester I", "Semester II"...
  branch TEXT NOT NULL,             -- "IT", "CSE", "ME", "EC", "ALL"
  accent_color TEXT DEFAULT '#8B5CF6',
  syllabus_url TEXT DEFAULT '',
  notes_url TEXT DEFAULT '',
  pyqs_url TEXT DEFAULT '',
  practice_url TEXT DEFAULT '',
  lab_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- 2. Global PYQs Table
CREATE TABLE global_pyqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester TEXT NOT NULL,
  year TEXT NOT NULL,
  url TEXT NOT NULL,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Seeding Initial Data
The database tables will be seeded with all 7 current Sem 2 subjects from `vault.js` and the existing PYQ papers to ensure the system is pre-populated out of the box.

---

## Security & Row Level Security (RLS)

### RLS Policies
---
RLS POLICY PROPOSED - require confirm before apply
Table: `global_resources`
Policy Name: `allow_read_all_users`
SQL: `CREATE POLICY allow_read_all_users ON global_resources FOR SELECT TO authenticated USING (true);`
Plain English: Allows any authenticated user to view resource list.
---
Table: `global_resources`
Policy Name: `allow_write_admin_users`
SQL: 
```sql
CREATE POLICY allow_write_admin_users ON global_resources
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'));
```
Plain English: Restricts write operations (insert, update, delete) to authenticated users with role = 'cr'.
---

*(Identical RLS policies will be applied to the `global_pyqs` table.)*

---

## Verification Plan

### Automated Tests
1. **Unauthorised Writes**: Try updating a resource link while signed in with a standard student account. Verify Supabase returns a `403 Forbidden` error.
2. **Authorised Updates**: Edit a link using the CR account and confirm the update succeeds and propagates in real-time.
3. **PWA Offline Mode**: Disable the internet connection and verify that the cached resources load correctly.
