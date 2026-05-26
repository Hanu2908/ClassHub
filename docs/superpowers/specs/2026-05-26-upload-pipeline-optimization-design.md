# Upload Pipeline Optimization — Design Spec

**Date:** 2026-05-26
**Status:** Approved
**Approach:** A — Parallel Batch + Retry (no main image compression)

---

## Problem Statement

The current attachment upload pipeline in ClassHub has four bottlenecks:

1. **Sequential uploads** — files are uploaded one-by-one in a `for` loop. 5 files × 3MB = ~15s sequential wait.
2. **Sequential thumbnail generation** — thumbnail is generated and uploaded *after* the main upload completes, adding unnecessary latency.
3. **No retry logic** — a single network hiccup kills the entire upload with no recovery.
4. **No progress feedback** — the UI shows only a boolean spinner with no indication of progress.

## Design Decision: No Main Image Compression

The original proposal included compressing the main image to 2048px WebP. This was rejected because:

- Students need full-resolution originals for whiteboard photos, exam schedules, and handwritten notes — the primary content types CRs post.
- The existing thumbnail pipeline (`generateThumbnail` → 800px WebP) already handles the expensive card preview bandwidth.
- Files are capped at 10MB max — not large enough to justify lossy re-encoding.

**Result:** Original files upload untouched. Only thumbnails are compressed (existing behavior preserved).

---

## Architecture

### 1. Retry Wrapper — `uploadWithRetry`

**Location:** `src/lib/utils/uploadAttachment.ts` (internal, not exported)

```typescript
async function uploadWithRetry(
  bucket: string,
  path: string,
  body: File | Blob,
  options: { cacheControl: string; upsert: boolean; contentType?: string },
  maxRetries = 3,
): Promise<void>
```

**Behavior:**
- Wraps `supabase.storage.from(bucket).upload(path, body, options)`.
- On **network errors only** (`Failed to fetch`, `TypeError`, status 0), retries with exponential backoff.
- On auth/validation/quota errors, fails immediately — no retry.
- Backoff schedule: `500ms → 1500ms → 3500ms` (formula: `500 * 3^attempt`).
- After 3 failed attempts, throws the last error.

### 2. Per-File Pipeline — `uploadAttachment` (updated)

**Location:** `src/lib/utils/uploadAttachment.ts`

New signature adds `onProgress` callback:

```typescript
export interface UploadAttachmentParams {
  file: File;
  sectionId: string;
  parentType: 'announcement' | 'assignment';
  parentId: string;
  userId: string;
  onProgress?: (filename: string, completed: boolean) => void;
}
```

**Execution flow per file:**

```
┌─────────────────────────────────────────────────┐
│              Per-File Pipeline                   │
│                                                  │
│  Promise.all([                                   │
│    uploadWithRetry(main file),                   │
│    generateThumbnail(file)                       │
│      .then(blob => uploadWithRetry(thumb blob))  │
│  ])                                              │
│         │                                        │
│         ▼                                        │
│  Insert DB record (attachments table)            │
│  onProgress(filename, true)                      │
└─────────────────────────────────────────────────┘
```

- Main upload and thumbnail **generation** start concurrently.
- Thumbnail **upload** runs after generation completes (needs the blob).
- Thumbnail pipeline failure is silent — existing fallback to decode-time downscale (Option D) still works.
- `onProgress` fires once per file after all operations for that file complete.

### 3. Batch Helper — `uploadAttachments` (new, exported)

**Location:** `src/lib/utils/uploadAttachment.ts`

```typescript
export async function uploadAttachments(
  files: File[],
  params: Omit<UploadAttachmentParams, 'file'>,
): Promise<{
  succeeded: string[];
  failed: { filename: string; error: string }[];
}>
```

**Behavior:**
- Runs all files via `Promise.allSettled` — true parallelism.
- One file failing does NOT cancel the others.
- Calls `onProgress` per-file as each settles.
- Returns structured result: which files succeeded, which failed (with error messages).
- Callers can surface partial success to the user.

### 4. Call Site Changes

Both pages replace their sequential `for` loop with the batch helper.

#### `src/pages/app/AnnouncementsPage.tsx`

Before:
```typescript
for (const file of files) {
  await uploadAttachment({ file, sectionId, parentType: 'announcement', parentId, userId });
}
```

After:
```typescript
const result = await uploadAttachments(files, {
  sectionId, parentType: 'announcement', parentId, userId,
  onProgress: (filename, completed) => setUploadProgress(prev => prev + 1),
});
if (result.failed.length > 0) {
  showToast(`${result.failed.length} file(s) failed to upload`, 'warning');
}
```

#### `src/pages/app/AssignmentsPage.tsx`

Identical pattern with `parentType: 'assignment'`.

---

## Files Modified

| File | Action | Description |
|---|---|---|
| `src/lib/utils/uploadAttachment.ts` | MODIFY | Add `uploadWithRetry`, parallelize thumb+main inside `uploadAttachment`, add `uploadAttachments` batch helper |
| `src/pages/app/AnnouncementsPage.tsx` | MODIFY | Replace sequential `for` loop with `uploadAttachments()` call, add `uploadProgress` state |
| `src/pages/app/AssignmentsPage.tsx` | MODIFY | Replace sequential `for` loop with `uploadAttachments()` call, add `uploadProgress` state |

## Files NOT Modified

| File | Reason |
|---|---|
| `src/lib/utils/imageResize.ts` | Existing `generateThumbnail` is reused as-is — no changes needed |
| `src/lib/utils/attachments.ts` | Existing helpers (`buildStoragePath`, `isPreviewableImage`) reused as-is |
| `src/components/FileUploader.tsx` | Selection/validation UI unchanged — only the upload execution changes |

---

## Verification Plan

### Automated
- `npm run build` — confirms clean TypeScript compilation.
- `npm run lint` — confirms no ESLint violations.

### Manual
1. Upload 3-5 mixed files (images + PDFs) in an announcement — confirm all upload in parallel (~4× faster than before).
2. Simulate flaky network (DevTools → Network → offline toggle mid-upload) — confirm retry kicks in and upload recovers.
3. Verify partial failure: upload 3 files where 1 is to a restricted path — confirm 2 succeed and 1 failure is reported.
4. Verify thumbnails still generate correctly for images alongside the main upload.
