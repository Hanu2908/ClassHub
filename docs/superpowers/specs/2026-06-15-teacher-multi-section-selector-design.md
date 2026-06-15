# 2026-06-15 Teacher Unified Course Selector and Multi-Section Joining Design

Upgrade the Teacher Dashboard's Section/Subject selector to a premium Radix UI Dropdown Menu, and integrate frontend controls allowing teachers to join and manage multiple section hubs.

## Proposed Changes

### Teacher Dashboard

#### [MODIFY] [TeacherDashboardPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/TeacherDashboardPage.tsx)
* **Header Selector (Radix Dropdown)**:
  * Replace the two raw HTML `<select>` inputs in the header with a single unified course selector button showing the active class (e.g. `CS-301 - Section P2 ▾`).
  * Clicking the button opens a Radix UI `DropdownMenu` containing all sections and their linked subjects, grouped by section.
  * Tapping a subject in the dropdown switches both `selectedSectionId` and `selectedSubjectId` in the app store.
  * The footer of the dropdown features a persistent **"+ Join Another Section"** action.
* **Join Section Dialog**:
  * Implement an input-focused dialog/modal that prompts the teacher for a 6-character invite code (e.g., `T-P2WXYZ`).
  * On submit, calls the Supabase RPC `join_section_as_teacher`.
  * On success, shows a success toast, updates active selection to the new section, and automatically opens the "Link Subjects" bottom sheet for that section.
* **Setup Required Card**:
  * If a teacher has no linked subjects, show a welcome card with two actions:
    1. **"Link Subjects in [Current Section]"** (opens the subjects checklist for their default section).
    2. **"Join Another Section"** (opens the Join Section Dialog).

---

### Profile Settings

#### [MODIFY] [ProfilePage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ProfilePage.tsx)
* **Linked Courses Card**:
  * Add a **"+ Join Section"** button at the bottom of the Linked Courses section.
  * Tapping it opens the same Join Section Dialog, calling `join_section_as_teacher`, refreshing the profile/mappings query, and popping open the subjects-linking checklist for the new section on success.

---

## Verification Plan

### Manual Verification
* Verify that a teacher can click the new Radix selector in the header and switch subjects/sections in one click.
* Verify that tapping "+ Join Section" triggers the invite code dialog.
* Input a valid teacher invite code, verify that it joins the section, switches selection, and pops open the link subjects bottom sheet.
* Verify that the settings/empty-state buttons correctly trigger the flow.
