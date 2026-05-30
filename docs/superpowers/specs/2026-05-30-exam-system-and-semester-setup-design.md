# Exam Timetable, Syllabus Preparation & Semester Onboarding Setup Specification

This specification details the technical architecture, data model, security structures, and visual designs for the **Shared College Exam Timetable, Syllabus Prep Tracker**, and the **Onboarding Semester Auto-Detect & Setup Fix**.

---

## 1. Goal & Context

To transition ClassHub into a complete academic copilot, we are addressing two major visual and operational gaps in Sprint 4:
1. **Accidental Curriculum Misallocation (Semester Setup Bug)**: When a CR pastes their ERP attendance table for the first time, all subjects default to Semester 1. We must introduce a context-aware semester selection to ensure upper-year classes align correctly on day one.
2. **Academic Exam Panic**: Currently, exams are scattered text posts. We are building a robust, shared college-wide Exam Hub. It syncs the timetable automatically across sections taking the same subjects while allowing section-level overrides for seating plans and rooms, backed by a personal student checklist for syllabus preparation.

---

## 2. Technical Architecture & Component Flows

```mermaid
graph TD
    subgraph Browser Client (PWA)
        Dashboard[Student Dashboard]
        ExamsPage[Exams Hub Page]
        ERPModal[Attendance ERP Modal]
        Store[Zustand useAppStore]
    end

    subgraph Supabase Storage
        Bucket[(Supabase Storage Bucket: 'attachments')]
    end

    subgraph Supabase Cloud Backend
        DB[(PostgreSQL Database)]
        ExamsTable[exams table]
        OverridesTable[exam_overrides table]
        PrepTable[student_exam_prep table]
    end

    ERPModal -->|1. Parse & Selected Semester| DB
    ExamsPage -->|2. Check off Syllabus Unit| PrepTable
    ExamsPage -->|3. Upload Seating/Syllabus PDF| Bucket
    ExamsPage -->|4. Save Override Room/Plan| OverridesTable
    Dashboard -->|5. Awake Countdown Hero Card| Store
```

---

## 3. Database Schema Definitions

We will create three new tables directly inside Supabase using Postgres DDL:

### A. Shared College-wide Exam Table (`public.exams`)
Stores the unified, shared exam dates, timings, types, and syllabus checklists.
```sql
CREATE TABLE public.exams (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester             INTEGER NOT NULL,
    subject_code         TEXT NOT NULL,
    subject_name         TEXT NOT NULL,
    exam_type            TEXT NOT NULL, -- "MST-1", "MST-2", "End-Sem", "Lab External", "Quiz", etc.
    exam_date            DATE NOT NULL,
    start_time           TIME NOT NULL,
    end_time             TIME NOT NULL,
    max_marks            INTEGER,
    room                 TEXT, -- Centralized default room
    syllabus_units       TEXT[] DEFAULT '{}'::TEXT[], -- Syllabus checklist elements
    syllabus_pdf_path    TEXT, -- Supabase Storage file path to syllabus PDF
    seating_plan_path    TEXT, -- Supabase Storage file path to centralized seating plan
    created_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

### B. Section-Specific Overrides Table (`public.exam_overrides`)
Allows any section CR to localize the classroom allocation or seating chart without affecting other sections.
```sql
CREATE TABLE public.exam_overrides (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id           UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    exam_id              UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    room                 TEXT, -- Section room override
    seating_plan_path    TEXT, -- Section seating plan override
    created_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(section_id, exam_id)
);
```

### C. Personal Preparation Checklist Tracker (`public.student_exam_prep`)
Maintains each student's private syllabus readiness checklist.
```sql
CREATE TABLE public.student_exam_prep (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exam_id              UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    unit_index           INTEGER NOT NULL, -- Index reference in syllabus_units
    is_prepared          BOOLEAN NOT NULL DEFAULT false,
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, exam_id, unit_index)
);
```

---

## 4. Row Level Security (RLS) & Safeguards

To maintain collaborative integrity while preventing accidental data loss:

### A. Centralized Exams RLS
* **Select**: Any authenticated student taking the subject in the same college/semester can read the exam.
* **Insert/Update**: Only users with `role = 'cr'` can create or update.
* **Delete Safeguard**: Only the specific CR who originally **created** the base exam (`exams.created_by = auth.uid()`) has delete permissions. Other CRs can only remove local section overrides.

### B. Section Overrides RLS
* **Select**: Any student belonging to that specific `section_id` can read.
* **Insert/Update/Delete**: Restrict strictly to CRs belonging to that specific `section_id`.

### C. Private Preparation Tracker RLS
* **Select/Insert/Update/Delete**: strictly locked where `user_id = auth.uid()`. Fully private; neither other students nor section CRs can read or inspect another student's preparation progress.

---

## 5. Unified Relational Querying (Coalesce Pattern)

When fetching the active exam timetable for a student, we perform a clean SQL join. This dynamically merges base college parameters with section overrides:

```sql
SELECT 
    e.id,
    e.semester,
    e.subject_code,
    e.subject_name,
    e.exam_type,
    e.exam_date,
    e.start_time,
    e.end_time,
    e.max_marks,
    e.syllabus_units,
    e.syllabus_pdf_path,
    COALESCE(o.room, e.room) AS active_room,
    COALESCE(o.seating_plan_path, e.seating_plan_path) AS active_seating_plan,
    e.created_by AS base_creator_id,
    o.id AS override_id
FROM public.exams e
LEFT JOIN public.exam_overrides o 
    ON o.exam_id = e.id AND o.section_id = :student_section_id
WHERE e.subject_code IN (
    SELECT code FROM public.subjects 
    WHERE section_id = :student_section_id
)
ORDER BY e.exam_date ASC, e.start_time ASC;
```

---

## 6. Dynamic Exam Mode Activation (Dashboard & UI)

During quiet weeks, the dashboard remains completely dormant. However, **within 7 days of an upcoming exam date**, the PWA triggers **Exam Mode**:

### A. Jump Center Activation
A glowing, crimson-accented **"Exams Hub" pill** appears inside the Jump Center dashboard shortcuts list:
* Icon: `Calendar` / `Award`
* Text: `[ 📝 2 Exams ]` (indicating count of active upcoming tests)

### B. Dashboard "Next Exam" Hero Card
Slides in right next to the Attendance Hero card:
* Styled with HSL subject gradient accents.
* Shows a **Live countdown clock** (updating every 1 minute) showing days, hours, and minutes remaining (e.g. *"MST-1 in 3d 4h"*).
* Displays the active coalesced room number.
* Interactive progress indicator showing study progress (e.g., *"1 of 3 units prepared"*).

### C. The Exams Hub Timeline (`ExamsPage.tsx`)
* **Header Resources Bar**: Holds seating charts, date sheets, and syllabus PDFs. Opens in ClassHub's high-fidelity `PDFViewerPage` natively.
* **Chronological Timeline**: Cards styled with Glassmorphism representing each exam.
* **Collapsible Syllabus Sheet**: Tapping a card expands a detailed study panel.
* **Confetti prep checklist**: Each syllabus unit has a private tick button. Checking it triggers a colorful celebration confetti animation on the screen and updates `student_exam_prep` in Supabase.
* **CR floating FAB**: Provides immediate exam creation and override fields directly on-screen.

---

## 7. Onboarding Semester Auto-Detect & Setup Fix

To resolve the first-time Setup Bug:

### A. Context Checker
We compute if the section contains zero subjects during mount inside `AttendancePage.tsx`:
```typescript
const isSectionEmpty = subjects.length === 0;
```

### B. Interactive setup dropdown (UI)
If `isSectionEmpty` is true, the PWA displays a clean select list inside the aggregate paste sheet:
```tsx
<div>
  <label htmlFor="import-semester-select" className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
    Select Your Section's Current Semester:
  </label>
  <select 
    id="import-semester-select" 
    className="input" 
    value={selectedImportSemester} 
    onChange={e => setSelectedImportSemester(Number(e.target.value))}
  >
    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
      <option key={sem} value={sem}>Semester {sem}</option>
    ))}
  </select>
</div>
```

### C. Passing to Subject Creation Hook
Inside `handleParse` in `AttendancePage.tsx`, the selected semester is passed explicitly:
```typescript
const activeSemester = isSectionEmpty 
  ? selectedImportSemester 
  : Math.max(...subjects.map(s => s.semester), 1);

const mapping = await ensureSubjects.mutateAsync(
  result.map(r => ({ 
    code: r.code, 
    name: r.name,
    semester: activeSemester
  }))
);
```

---

## 8. Verification & Validation Plan

### A. Database Migrations
* Verify the tables and primary keys mount successfully on Supabase via DDL triggers.
* Validate that RLS rules block students from updating base exams while allowing seamless coalesced selections.

### B. Linter & Compiler Integrity
* Ensure `npm run lint` and `npm run build` continue to succeed with zero errors or warnings after compiling TS definitions.

### C. Manual E2E Flow Checks
* Create a fresh section and verify pasting an ERP table with selected "Semester 4" registers all subjects under Semester 4.
* Schedule a mock exam and verify that the countdown widget slides onto the student dashboard precisely within 7 days of the date.
* Verify checking off a study checklist unit triggers a local confetti blast and updates only that specific student's private record.
