/**
 * Image resize utilities for thumbnail generation and decode-time downscaling.
 * Pure functions — no React dependencies.
 *
 * Option C: `generateThumbnail` — creates a WebP thumb at upload time.
 * Option D: `decodeAtReducedResolution` — downscales during decode for legacy images.
 */

// ── Constants ──────────────────────────────────────────────────────────────────
export const THUMB_MAX_WIDTH = 800;
export const THUMB_QUALITY = 0.75;
export const THUMB_SUFFIX = '.thumb.webp';

export const COMPRESSED_MAX_WIDTH = 1600;
export const COMPRESSED_QUALITY = 0.8;

/** Derive the thumbnail storage path from the original path. */
export function getThumbPath(storagePath: string): string {
  return `${storagePath}${THUMB_SUFFIX}`;
}

/**
 * Auto-compress an image File down to WebP format (max width 1600px, quality 0.8)
 * before upload. Reduces 5MB–10MB photos to ~150KB–300KB.
 * Returns the compressed File object, or the original File if non-image/error.
 */
export async function compressImage(
  file: File,
  maxWidth: number = COMPRESSED_MAX_WIDTH,
  quality: number = COMPRESSED_QUALITY
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  
  try {
    const bitmap = await createImageBitmap(file);
    const { width: natW, height: natH } = bitmap;

    // Calculate target width/height
    const targetW = natW > maxWidth ? maxWidth : natW;
    const targetH = natW > maxWidth ? Math.round((natH / natW) * maxWidth) : natH;

    let blob: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(targetW, targetH);
      const ctx = oc.getContext('2d');
      if (!ctx) { bitmap.close(); return file; }
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      blob = await oc.convertToBlob({ type: 'image/webp', quality });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return file; }
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', quality);
      });
    }

    bitmap.close();

    if (!blob) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const compressedFileName = `${baseName}.webp`;

    return new File([blob], compressedFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[imageResize] Client-side image compression failed, falling back to original:', err);
    return file;
  }
}

// ── Option C: Upload-time thumbnail generation ─────────────────────────────────

/**
 * Generate a WebP thumbnail blob from a File.
 * Uses OffscreenCanvas when available, falls back to HTMLCanvasElement.
 * Returns `null` if:
 *  - Image is already ≤ maxWidth (no point making a thumb)
 *  - Any error occurs (unsupported format, old browser, etc.)
 */
export async function generateThumbnail(
  file: File,
  maxWidth: number = THUMB_MAX_WIDTH,
  quality: number = THUMB_QUALITY,
): Promise<Blob | null> {
  try {
    // Decode the file into an ImageBitmap to read natural dimensions
    const bitmap = await createImageBitmap(file);
    const { width: natW, height: natH } = bitmap;

    // Skip if already small enough
    if (natW <= maxWidth) {
      bitmap.close();
      return null;
    }

    const scaledW = maxWidth;
    const scaledH = Math.round((natH / natW) * maxWidth);

    let blob: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      // ── OffscreenCanvas path (Chrome, Edge, Firefox) ─────────────────
      const oc = new OffscreenCanvas(scaledW, scaledH);
      const ctx = oc.getContext('2d');
      if (!ctx) { bitmap.close(); return null; }

      ctx.drawImage(bitmap, 0, 0, scaledW, scaledH);
      blob = await oc.convertToBlob({ type: 'image/webp', quality });
    } else {
      // ── HTMLCanvasElement fallback (Safari < 16.4, older browsers) ───
      const canvas = document.createElement('canvas');
      canvas.width = scaledW;
      canvas.height = scaledH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return null; }

      ctx.drawImage(bitmap, 0, 0, scaledW, scaledH);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          'image/webp',
          quality,
        );
      });
    }

    bitmap.close();
    return blob;
  } catch (err) {
    console.warn('[imageResize] Thumbnail generation failed:', err);
    return null;
  }
}

// ── Option D: Decode-time downscale for legacy images ──────────────────────────

/**
 * Decode-time downscale: fetches the image at `url`, decodes it at reduced
 * resolution via `createImageBitmap({ resizeWidth })`, and returns a new
 * object URL pointing to the smaller bitmap.
 *
 * This avoids allocating the full-resolution bitmap in GPU memory.
 * Falls back to returning the original URL if unsupported or on error.
 *
 * IMPORTANT: The caller is responsible for revoking the returned object URL
 * when it's no longer needed (unless the returned URL === the input URL).
 */
export async function decodeAtReducedResolution(
  url: string,
  maxWidth: number = THUMB_MAX_WIDTH,
): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const blob = await resp.blob();

    // Feature-detect resize options support by attempting the call.
    // Unsupported browsers will throw or ignore the options.
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, {
        resizeWidth: maxWidth,
        resizeQuality: 'medium',
      });
    } catch {
      // Resize options not supported — return original
      return url;
    }

    // If the bitmap is already small, skip the canvas step
    if (bitmap.width >= maxWidth * 0.9) {
      // The original was likely ≤ maxWidth, no benefit from re-encoding
      // Still use the decoded bitmap for display since it's already allocated
    }

    // Render to canvas → blob → object URL
    let outputBlob: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = oc.getContext('2d');
      if (!ctx) { bitmap.close(); return url; }
      ctx.drawImage(bitmap, 0, 0);
      outputBlob = await oc.convertToBlob({ type: 'image/webp', quality: THUMB_QUALITY });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return url; }
      ctx.drawImage(bitmap, 0, 0);
      outputBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', THUMB_QUALITY);
      });
    }

    bitmap.close();

    if (!outputBlob) return url;
    return URL.createObjectURL(outputBlob);
  } catch (err) {
    console.warn('[imageResize] Decode-time downscale failed:', err);
    return url;
  }
}
