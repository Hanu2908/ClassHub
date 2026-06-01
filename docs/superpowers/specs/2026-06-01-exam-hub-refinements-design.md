# Exam Hub Refinements and Syllabus Auto-Extractor Design Specification

This specification details the technical architecture, data flow, storage layouts, client-side PDF parsing heuristics, and user interface upgrades for the refined ClassHub **Exams Hub** system.

---

## 1. Goals & Context

Based on real-world feedback from Sprint 4, we are introducing five major upgrades to the Exam Hub:
1. **Subject Selection Dropdown (No Manual Typing)**: Replace error-prone text input fields with a premium, section-scoped `<select>` dropdown populated directly from the active subjects list.
2. **Deterministic Exam Publication Sync**: Resolve the visibility mismatch where newly created exams disappeared because their typed subject codes did not match the section's exact subject list.
3. **Secure Attachment Integration (Seating Plans & Syllabi)**: Integrate the custom file uploader to support uploading seating charts and syllabus files, complying fully with multi-tenant storage RLS folder partitioning.
4. **Signed URL Authorization Security**: Resolve 401 unauthenticated load failures when rendering PDFs inside `PDFViewerPage` by generating temporary, secure signed URLs on-the-fly.
5. **Notice Pasting Physical Location**: Rename "Default Room Number" to "Seating Notice Physical Location" representing where printed rosters are physically posted in college, storing overrides natively in the `room` column.
6. **Intelligent client-side PDF/TXT Syllabus Auto-Extractor**: Automatically extract syllabus unit headings and topics on the client using `pdfjsLib` and structured regex heuristics, pre-populating the checklist area with zero backend dependencies.

---

## 2. Technical Architecture & File Layouts

```mermaid
graph TD
    subgraph Browser Client (React PWA)
        ExamsPage[ExamsPage.tsx]
        PDFViewer[PDFViewerPage.tsx]
        useSubjects[useSubjects Hook]
        useExams[useExams Hook]
        PDFEngine[pdfjsLib Parser]
    end

    subgraph Supabase Storage
        Bucket[(Private Bucket: 'attachments')]
    end

    subgraph Supabase Cloud Database
        ExamsTable[(public.exams)]
        OverridesTable[(public.exam_overrides)]
        SubjectsTable[(public.subjects)]
    end

    useSubjects -->|Fetch Active Subjects| SubjectsTable
    ExamsPage -->|1. Populates Dropdown| useSubjects
    ExamsPage -->|2. Extract Text| PDFEngine
    ExamsPage -->|3. Upload PDFs| Bucket
    ExamsPage -->|4. Save Paths & Metadata| ExamsTable
    ExamsPage -->|5. Save Overrides| OverridesTable
    ExamsPage -->|6. Get Signed URL| Bucket
    ExamsPage -->|7. Render Signed URL| PDFViewer
```

---

## 3. Storage Security & Path Conventions

To satisfy the Supabase Storage object RLS policy (`split_part(name, '/', 1) = section_id`), all file paths uploaded for exams must strictly begin with the CR's active `section_id`. 

### A. Folder Scopes
* **Base Exam Centralized Files** (Uploaded to central base exam):
  * Syllabus PDF: `${sectionId}/exams/${examId}/syllabus_${Date.now()}_${filename}`
  * Seating Plan PDF: `${sectionId}/exams/${examId}/base_seating_plan_${Date.now()}_${filename}`
* **Section-Specific Overrides** (Uploaded to section override):
  * Seating Plan PDF: `${sectionId}/exams/${examId}/override_seating_plan_${Date.now()}_${filename}`

### B. Secure Temporary Authorization (Signed URL flow)
To resolve unauthenticated load failures (since the `attachments` bucket is private), `ExamsPage.tsx` must request a secure 5-minute (300 seconds) signed URL before navigating to the native PDF viewer:

```typescript
const openSecurePdf = async (storagePath: string, titleStr: string) => {
  try {
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      navigate(`/app/pdf-viewer?url=${encodeURIComponent(storagePath)}&title=${encodeURIComponent(titleStr)}`);
      return;
    }
    
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(storagePath, 300);
      
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('Could not authorize access.');
    
    navigate(`/app/pdf-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(titleStr)}`);
  } catch (err: any) {
    showToast(err.message || 'Failed to open PDF', 'error');
  }
};
```

---

## 4. UI Components & Forms Refactoring

### A. Subject Select Dropdown
Replaces the old text boxes inside the publication and edit worksheets:

```tsx
<select
  className="input select-custom"
  value={subjCodeVal ? `${subjCodeVal}|${subjNameVal}` : ''}
  onChange={(e) => {
    const val = e.target.value;
    if (val) {
      const [code, name] = val.split('|');
      setSubjCodeVal(code);
      setSubjNameVal(name);
    } else {
      setSubjCodeVal('');
      setSubjNameVal('');
    }
  }}
  required
>
  <option value="">-- Select Hub Subject --</option>
  {subjects.map((s) => (
    <option key={s.id} value={`${s.code}|${s.name}`}>
      [{s.code}] {s.name}
    </option>
  ))}
</select>
```

### B. Notice Board Physical Location Input
Renames and re-brands the room number text field:
* **Label**: `Seating Notice Physical Location:`
* **Placeholder**: `e.g., D-Block Central Notice Board`
* **Column Mapping**: Maps directly to the `room` column of the `public.exams` and `public.exam_overrides` tables.

---

## 5. Client-Side Intelligent Syllabus Auto-Extractor

When a CR picks a syllabus file (PDF or TXT), the browser uses a background thread to extract topics automatically:

```typescript
const parseSyllabusText = (rawText: string) => {
  // Heuristics: split by lines, search for Unit markers
  const lines = rawText.split('\n');
  const extractedUnits: string[] = [];
  
  // Heuristics Regex for detecting units
  const unitRegex = /^\s*(unit|module|chapter|part)\s*[-:–—\dIIVX]+\s*[:–—\s]?/i;
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (unitRegex.test(trimmed) && trimmed.length > 8 && trimmed.length < 150) {
      extractedUnits.push(trimmed);
    }
  });

  // Fallback: If no Unit headers detected, group heavy paragraphs
  if (extractedUnits.length === 0) {
    const cleanParagraphs = lines
      .map(l => l.trim())
      .filter(l => l.length > 25 && l.length < 180)
      .slice(0, 5);
    extractedUnits.push(...cleanParagraphs);
  }

  return extractedUnits.slice(0, 6).join('\n');
};
```

---

## 6. E2E Verification & Verification Plan

### A. Automated Tests
* Run `npm test` to verify zero regressions.
* Validate that RLS policies prevent standard students from modifying `exams` rows or overriding non-section `exam_overrides`.

### B. Manual Verification Flows
* **Subject Select Check**: Confirm that a CR can only publish exams for subjects currently set up in their section.
* **Auto-Extractor Check**: Upload a mock syllabus PDF and confirm it auto-populates the syllabus checklist text box.
* **Signed URL Check**: Verify that clicking a seating plan or syllabus PDF successfully opens and renders inside `/app/pdf-viewer` without any 401 failures.
