/**
 * Centralized attachment upload utility.
 * Handles storage upload, optional thumbnail generation for images,
 * and batched DB record insertion.
 */
import { supabase } from '../supabase';
import { buildStoragePath, isPreviewableImage } from './attachments';
import { generateThumbnail, getThumbPath, compressImage } from './imageResize';

export interface UploadAttachmentParams {
  file: File;
  sectionId: string;
  parentType: 'announcement' | 'assignment';
  parentId: string;
  userId: string;
  onProgress?: (filename: string, completed: boolean) => void;
}

export interface BatchUploadResult {
  succeeded: string[];
  failed: { filename: string; error: string }[];
}

export interface StagedUploadResult {
  file: File;
  storagePath: string;
  insertRow: {
    section_id: string;
    storage_path: string;
    filename: string;
    file_size: number;
    file_type: string;
    uploaded_by: string;
    announcement_id: string | null;
    assignment_id: string | null;
  };
}

/**
 * Robust retry wrapper for Supabase Storage uploads.
 * Retries only on network-related errors (e.g. timeout, disconnected)
 * with exponential backoff, failing immediately for non-network errors.
 */
async function uploadWithRetry(
  bucket: string,
  path: string,
  body: File | Blob,
  options: { cacheControl: string; upsert: boolean; contentType?: string },
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, body, options);
      if (error) throw error;
      return;
    } catch (error: unknown) {
      const err = error as { message?: string; name?: string; status?: number; statusCode?: number };
      const isNetworkError =
        err.message?.includes('Failed to fetch') ||
        err.name === 'TypeError' ||
        err.status === 0 ||
        err.statusCode === 0;

      if (!isNetworkError || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 500ms → 1500ms → 4500ms
      await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt)));
    }
  }
}

/**
 * Upload a single file to Supabase Storage and returns its metadata payload.
 */
export async function uploadSingleFileToStorage({
  file: originalFile,
  sectionId,
  parentType,
  parentId,
  userId,
  onProgress,
}: UploadAttachmentParams): Promise<StagedUploadResult> {
  // Auto-compress image before uploading to reduce network payload by 80-90%
  const file = isPreviewableImage(originalFile.type, originalFile.name)
    ? await compressImage(originalFile)
    : originalFile;

  // 1. Build storage path
  const path = buildStoragePath(sectionId, parentType, parentId, file.name);

  // 2. Setup parallel uploads (main file and optional thumbnail)
  const mainUploadPromise = uploadWithRetry(
    'attachments',
    path,
    file,
    {
      cacheControl: '31536000, immutable', // 1 Year immutable caching
      upsert: parentType === 'assignment', // Assignments use upsert: true
      contentType: file.type || 'application/octet-stream',
    }
  );

  const thumbUploadPromise = (async () => {
    if (isPreviewableImage(file.type, file.name)) {
      try {
        const thumbBlob = await generateThumbnail(file);
        if (thumbBlob) {
          const thumbPath = getThumbPath(path);
          await uploadWithRetry(
            'attachments',
            thumbPath,
            thumbBlob,
            {
              cacheControl: '31536000, immutable', // Thumbs are immutable — cache aggressively
              upsert: parentType === 'assignment',
              contentType: 'image/webp',
            }
          );
        }
      } catch (err) {
        // Silent failure — card will fall back to decode-time downscale
        console.warn('[uploadAttachment] Thumbnail generation/upload failed:', err);
      }
    }
  })();

  // Run main file upload and thumbnail processing in parallel
  await Promise.all([mainUploadPromise, thumbUploadPromise]);

  if (onProgress) {
    onProgress(file.name, true);
  }

  return {
    file,
    storagePath: path,
    insertRow: {
      section_id: sectionId,
      storage_path: path,
      filename: file.name,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream',
      uploaded_by: userId,
      announcement_id: parentType === 'announcement' ? parentId : null,
      assignment_id: parentType === 'assignment' ? parentId : null,
    },
  };
}

/**
 * Upload a file to Supabase Storage + insert the `attachments` DB record.
 */
export async function uploadAttachment(params: UploadAttachmentParams): Promise<void> {
  const staged = await uploadSingleFileToStorage(params);
  const { error: dbErr } = await supabase.from('attachments').insert(staged.insertRow);
  if (dbErr) throw dbErr;
}

/**
 * Upload multiple files concurrently and batch insert DB records in a single roundtrip.
 * Aggregates results of successful and failed uploads.
 */
export async function uploadAttachments(
  files: File[],
  params: Omit<UploadAttachmentParams, 'file'>
): Promise<BatchUploadResult> {
  const uploadPromises = files.map(async (file) => {
    try {
      const staged = await uploadSingleFileToStorage({ ...params, file });
      return { filename: file.name, success: true, staged };
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      return {
        filename: file.name,
        success: false,
        error: errorObj?.message || String(err),
      };
    }
  });

  const results = await Promise.allSettled(uploadPromises);
  const succeeded: string[] = [];
  const failed: { filename: string; error: string }[] = [];
  const rowsToInsert: StagedUploadResult['insertRow'][] = [];

  results.forEach((res, index) => {
    const file = files[index];
    if (res.status === 'fulfilled') {
      if (res.value.success && res.value.staged) {
        succeeded.push(res.value.filename);
        rowsToInsert.push(res.value.staged.insertRow);
      } else {
        failed.push({
          filename: res.value.filename,
          error: res.value.error || 'Upload failed',
        });
      }
    } else {
      failed.push({
        filename: file.name,
        error: res.reason?.message || String(res.reason),
      });
    }
  });

  // Batch insert all successful file rows in 1 single database roundtrip
  if (rowsToInsert.length > 0) {
    try {
      const { error: dbErr } = await supabase.from('attachments').insert(rowsToInsert);
      if (dbErr) {
        console.error('[uploadAttachments] Batch database insert failed:', dbErr);
        // Mark these as failed if DB row insertion failed
        rowsToInsert.forEach((row) => {
          const idx = succeeded.indexOf(row.filename);
          if (idx !== -1) succeeded.splice(idx, 1);
          failed.push({ filename: row.filename, error: dbErr.message || 'Database insert failed' });
        });
      }
    } catch (err: any) {
      console.error('[uploadAttachments] Batch database insert exception:', err);
      rowsToInsert.forEach((row) => {
        const idx = succeeded.indexOf(row.filename);
        if (idx !== -1) succeeded.splice(idx, 1);
        failed.push({ filename: row.filename, error: err?.message || 'Database insert failed' });
      });
    }
  }

  return { succeeded, failed };
}
