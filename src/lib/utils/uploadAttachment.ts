/**
 * Centralized attachment upload utility.
 * Handles storage upload, optional thumbnail generation for images,
 * and DB record insertion. Replaces duplicate logic in
 * AnnouncementsPage and AssignmentsPage.
 */
import { supabase } from '../supabase';
import { buildStoragePath, isPreviewableImage } from './attachments';
import { generateThumbnail, getThumbPath } from './imageResize';

export interface UploadAttachmentParams {
  file: File;
  sectionId: string;
  parentType: 'announcement' | 'assignment';
  parentId: string;
  userId: string;
}

/**
 * Upload a file to Supabase Storage + insert the `attachments` DB record.
 *
 * For images, also generates and uploads a WebP thumbnail alongside
 * the original. Thumbnail failure is silent — the display layer
 * falls back to decode-time downscale (Option D) automatically.
 *
 * @throws on original upload failure or DB insert failure.
 */
export async function uploadAttachment({
  file,
  sectionId,
  parentType,
  parentId,
  userId,
}: UploadAttachmentParams): Promise<void> {
  // 1. Build storage path
  const path = buildStoragePath(sectionId, parentType, parentId, file.name);

  // 2. Upload original file
  const { error: uploadErr } = await supabase.storage
    .from('attachments')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: parentType === 'assignment', // Assignments use upsert: true
    });
  if (uploadErr) throw uploadErr;

  // 3. Generate + upload thumbnail for images (silent failure)
  if (isPreviewableImage(file.type, file.name)) {
    try {
      const thumbBlob = await generateThumbnail(file);
      if (thumbBlob) {
        const thumbPath = getThumbPath(path);
        await supabase.storage
          .from('attachments')
          .upload(thumbPath, thumbBlob, {
            cacheControl: '86400', // Thumbs are immutable — cache aggressively
            upsert: parentType === 'assignment',
            contentType: 'image/webp',
          });
      }
    } catch (err) {
      // Silent — card will fall back to Option D (decode-time downscale)
      console.warn('[uploadAttachment] Thumbnail generation/upload failed:', err);
    }
  }

  // 4. Insert DB record
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
}
