# Image Thumbnail Optimization — Design Spec

## Problem

AttachmentCard loads the full-resolution signed URL (5–10 MB phone photos) for both the inline card preview and the zoom modal. This causes:

- **Memory spikes** on mobile — a 4000×3000 JPEG decodes to ~48 MB in GPU memory
- **Jank** when opening the zoom modal (same heavy bitmap scaled 5×)
- **Wasted bandwidth** — a 380px-tall card preview doesn't need a 4000px source image

## Strategy: C + D Hybrid

### Option C — Upload-time thumbnail generation (new uploads)

When a user uploads an image, generate a WebP thumbnail client-side and upload it alongside the original.

- **Thumbnail specs:** 800px wide, WebP format, quality 75
- **Thumbnail path:** `{storagePath}.thumb.webp` (convention-based, no schema change)
- **Bandwidth savings:** ~95% for card preview (50–80 KB thumb vs 5–10 MB original)

### Option D — Decode-time downscale via `createImageBitmap` (fallback)

For existing attachments without thumbnails, use `createImageBitmap(blob, { resizeWidth: 800 })` to decode at reduced resolution. The browser never allocates the full-size bitmap.

- **Memory savings:** ~95% (800×600 bitmap ≈ 2 MB vs 4000×3000 ≈ 48 MB)
- **Bandwidth savings:** None (still downloads full image)
- **Purpose:** Graceful fallback for legacy attachments

## Architecture

### New File: `src/lib/utils/imageResize.ts`

Pure utility functions, no React dependencies:

```typescript
const THUMB_MAX_WIDTH = 800;
const THUMB_QUALITY = 0.75;

/**
 * Generate a WebP thumbnail blob from a File.
 * Uses OffscreenCanvas when available, falls back to regular Canvas.
 * Returns null if generation fails (unsupported format, old browser, etc.)
 */
export async function generateThumbnail(file: File, maxWidth = THUMB_MAX_WIDTH): Promise<Blob | null>

/**
 * Decode a blob into a downscaled object URL for display.
 * Uses createImageBitmap({ resizeWidth }) for efficient decode-time downscale.
 * Falls back to returning the original URL if unsupported.
 */
export async function decodeAtReducedResolution(url: string, maxWidth = THUMB_MAX_WIDTH): Promise<string>
```

### New File: `src/lib/utils/uploadAttachment.ts`

Centralized upload logic — DRYs up duplicate code in AnnouncementsPage and AssignmentsPage:

```typescript
interface UploadAttachmentParams {
  file: File;
  sectionId: string;
  parentType: 'announcement' | 'assignment';
  parentId: string;
  userId: string;
}

/**
 * Upload a file to Supabase Storage + insert DB record.
 * For images, also generates and uploads a WebP thumbnail.
 * Thumbnail failure is silent — card falls back to Option D.
 */
export async function uploadAttachment(params: UploadAttachmentParams): Promise<void>
```

Upload flow:
1. Build storage path via `buildStoragePath()`
2. Upload original to `attachments/{path}`
3. If image → `generateThumbnail(file)` → upload to `attachments/{path}.thumb.webp` (silent catch)
4. Insert row into `attachments` table

### Modified: `src/components/AttachmentCard.tsx`

Two-tier URL loading:

1. **Signed URL fetcher** (visibility-gated, existing pattern):
   - First: try signed URL for `{storagePath}.thumb.webp`
   - If 404 or error: fall back to original `{storagePath}`
   - Store both `thumbUrl` and derive `fullUrl` lazily

2. **Card preview** uses `thumbUrl` (small, fast)

3. **On modal open**: pass both `thumbUrl` and `fullUrl` to ImageZoomModal

Cache structure update — extend existing `signedUrlCache`:
```typescript
interface CachedUrl {
  thumbUrl: string | null;  // null = no thumbnail exists
  fullUrl: string;
  expiresAt: number;
}
```

### Modified: `src/components/ImageZoomModal.tsx`

Progressive thumbnail-to-full swap:

```typescript
interface ImageZoomModalProps {
  thumbUrl: string;    // Show immediately (already cached)
  fullUrl: string;     // Fetch and swap when loaded
  onClose: () => void;
}
```

Behavior:
1. Modal opens instantly showing `thumbUrl` (already loaded by card)
2. Hidden `<img>` preloads `fullUrl`
3. On full-res load → crossfade swap the `src` (opacity transition)
4. User sees slightly soft image for 0.5–2s, then sharpens
5. If full-res fails, thumb stays visible (no error state)

### Modified: `src/pages/app/AnnouncementsPage.tsx`

Replace inline upload loop (lines 58–79) with:
```typescript
for (const file of files) {
  await uploadAttachment({ file, sectionId, parentType: 'announcement', parentId, userId });
}
```

### Modified: `src/pages/app/AssignmentsPage.tsx`

Replace inline upload loop (lines 151–172) with:
```typescript
for (const file of files) {
  await uploadAttachment({ file, sectionId, parentType: 'assignment', parentId, userId });
}
```

Note: AssignmentsPage uses a slightly different path format (`${sectionId}/assignments/${parentId}/${file.name}` vs `buildStoragePath()`). The centralized utility will accept `parentType: 'assignment'` and use `buildStoragePath()` for consistency. This is a harmless path format change for **new** assignments only — existing attachment paths are stored in the DB and won't be affected.

## Thumbnail Detection — No Extra Requests

Instead of trying the thumbnail URL and handling 404, we use a smarter approach:

1. Always request signed URL for the **thumbnail path** first
2. If the signed URL creation itself returns an error (file not found), fall back to original path
3. `createSignedUrl` is a lightweight metadata call — no image data is transferred
4. Cache the result so repeat renders don't re-probe

## Fallback Strategy

| Scenario | Card Preview | Modal |
|---|---|---|
| New upload (thumb exists) | Thumb signed URL (~50 KB) | Thumb instantly → full-res crossfade |
| Legacy upload (no thumb) | Original URL + Option D decode-time downscale | Original URL directly |
| Thumb generation failed | Same as legacy | Same as legacy |
| `createImageBitmap` unsupported | Original URL as `<img src>` (current behavior) | Original URL (current behavior) |

## Files Changed

| File | Change |
|---|---|
| `src/lib/utils/imageResize.ts` | **NEW** — thumbnail generation + decode-time downscale utilities |
| `src/lib/utils/uploadAttachment.ts` | **NEW** — centralized upload logic |
| `src/components/AttachmentCard.tsx` | **MODIFY** — two-tier URL loading, thumb-first with fallback |
| `src/components/ImageZoomModal.tsx` | **MODIFY** — accept thumbUrl + fullUrl, progressive swap |
| `src/pages/app/AnnouncementsPage.tsx` | **MODIFY** — replace upload loop with `uploadAttachment()` |
| `src/pages/app/AssignmentsPage.tsx` | **MODIFY** — replace upload loop with `uploadAttachment()` |

## What's NOT Changing

- **No schema changes** — thumbnail path is derived from `storagePath` convention
- **No migration** — existing attachments gracefully fall back to Option D
- **No Supabase Pro required** — all processing is client-side
- **No FileUploader changes** — it only manages file selection, not upload
- **No RLS changes** — thumbnails live in same storage bucket with same policies

## Verification Plan

1. **Upload a 5 MB+ phone photo** as announcement attachment
   - Verify `.thumb.webp` appears in Supabase Storage alongside original
   - Verify thumbnail is ≤100 KB and 800px wide
2. **View the card** — confirm it loads the thumbnail (check Network tab for `.thumb.webp`)
3. **Open the modal** — confirm progressive swap (thumb → full-res crossfade)
4. **Test legacy attachment** — existing images without thumbnails should still display (Option D fallback)
5. **Test non-image upload** — PDFs, CSVs should work unchanged
6. **Test on mobile** — confirm memory stays low with multiple image cards visible
7. **Test thumbnail failure** — block OffscreenCanvas in DevTools, confirm upload still succeeds
