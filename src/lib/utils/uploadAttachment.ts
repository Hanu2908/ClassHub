/**
 * Centralized attachment upload utility.
 * Handles storage upload, optional thumbnail generation for images,
 * and DB record insertion. Replaces duplicate logic in
 * AnnouncementsPage and AssignmentsPage.
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
 * Upload a file to Supabase Storage + insert the `attachments` DB record.
 * Runs original upload and thumbnail generation/upload concurrently.
 *
 * @throws on original upload failure or DB insert failure.
 */
export async function uploadAttachment({
  file: originalFile,
  sectionId,
  parentType,
  parentId,
  userId,
  onProgress,
}: UploadAttachmentParams): Promise<void> {
  // Auto-compress image before uploading to reduce network payload by 80-90%
  const file = isPreviewableImage(originalFile.type, originalFile.name)
    ? await compressImage(originalFile)
    : originalFile;

  // 1. Build storage path
  const path = buildStoragePath(sectionId, parentType, parentId, file.name);

  // 2. Setup parallel uploads (main file and thumbnail)
  const mainUploadPromise = uploadWithRetry(
    'attachments',
    path,
    file,
    {
      cacheControl: '3600',
      upsert: parentType === 'assignment', // Assignments use upsert: true
      contentType: file.type,
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
              cacheControl: '86400', // Thumbs are immutable — cache aggressively
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

  // 3. Insert DB record
  const insertRow = {
    section_id: sectionId,
    storage_path: path,
    filename: file.name,
    file_size: file.size,
    file_type: file.type,
    uploaded_by: userId,
    announcement_id: parentType === 'announcement' ? parentId : null,
    assignment_id: parentType === 'assignment' ? parentId : null,
  };

  const { error: dbErr } = await supabase
    .from('attachments')
    .insert(insertRow);
  if (dbErr) throw dbErr;

  // 4. Report completion progress
  if (onProgress) {
    onProgress(file.name, true);
  }
}

/**
 * Upload multiple files concurrently using Promise.allSettled.
 * Aggregates results of successful and failed uploads.
 */
export async function uploadAttachments(
  files: File[],
  params: Omit<UploadAttachmentParams, 'file'>
): Promise<BatchUploadResult> {
  const uploadPromises = files.map(async (file) => {
    try {
      await uploadAttachment({ ...params, file });
      return { filename: file.name, success: true };
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

  results.forEach((res, index) => {
    const file = files[index];
    if (res.status === 'fulfilled') {
      if (res.value.success) {
        succeeded.push(res.value.filename);
      } else {
        failed.push({
          filename: res.value.filename,
          error: res.value.error || 'Unknown error',
        });
      }
    } else {
      failed.push({
        filename: file.name,
        error: res.reason?.message || String(res.reason),
      });
    }
  });

  return { succeeded, failed };
}

