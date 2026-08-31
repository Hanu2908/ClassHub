/**
 * File attachment helpers — pure functions for validation and formatting.
 * Used across FileUploader, AttachmentCard, and tests.
 */

/** Maximum file size in bytes (10 MB default) */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Maximum number of files per upload */
export const MAX_FILE_COUNT = 5;

export type SharedFileValidationError =
  | 'empty-share'
  | 'too-many-files'
  | 'file-too-large'
  | 'unsupported-type';

/** Allowed MIME type prefixes / extensions */
export const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'image/',
  'text/',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/csv',
  'text/csv',
] as const;

/**
 * Human-readable file size from bytes.
 * 0 → "0 Bytes", 1024 → "1 KB", etc.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Determines whether a file exceeds the maximum allowed size.
 */
export function isFileTooLarge(sizeBytes: number, maxMB: number = MAX_FILE_SIZE_MB): boolean {
  return sizeBytes > maxMB * 1024 * 1024;
}

/**
 * Generates the Supabase Storage path for a section attachment.
 * Format: `{sectionId}/{parentType}/{parentId}/{timestamp}_{filename}`
 */
export function buildStoragePath(
  sectionId: string,
  parentType: 'announcement' | 'assignment',
  parentId: string,
  filename: string,
 ): string {
  const ts = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${sectionId}/${parentType}/${parentId}/${ts}_${sanitized}`;
}

/**
 * Returns a file category label from its MIME type or filename extension.
 */
export function getFileCategory(fileType: string | undefined | null): 'pdf' | 'image' | 'spreadsheet' | 'code' | 'text' | 'other' {
  const t = (fileType || '').toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.includes('csv') || t.includes('sheet') || t.includes('excel')) return 'spreadsheet';
  if (t.includes('json') || t.includes('javascript') || t.includes('typescript') || t.includes('css')) return 'code';
  if (t.startsWith('text/')) return 'text';
  return 'other';
}

/**
 * Returns true when a stored attachment can be rendered as an inline image.
 * Falls back to filename extension because mobile uploads can omit MIME type.
 */
export function isPreviewableImage(fileType: string | undefined | null, filename: string | undefined | null): boolean {
  const t = (fileType || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  return (
    t.startsWith('image/') ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/.test(name)
  );
}

export function validateSharedFiles(
  files: File[],
  allowEmpty = false,
): { ok: true; files: File[] } | { ok: false; error: SharedFileValidationError } {
  if (files.length === 0) {
    if (allowEmpty) {
      return { ok: true, files };
    }
    return { ok: false, error: 'empty-share' };
  }
  if (files.length > MAX_FILE_COUNT) return { ok: false, error: 'too-many-files' };

  for (const file of files) {
    if (isFileTooLarge(file.size)) return { ok: false, error: 'file-too-large' };
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPreviewableImage(file.type, file.name) && !isPdf) {
      return { ok: false, error: 'unsupported-type' };
    }
  }

  return { ok: true, files };
}

import { supabase } from '../supabase';

export interface CachedUrls {
  thumbUrl: string;    // Thumbnail URL (or original URL if no thumbnail exists)
  fullUrl: string;     // Original full-resolution URL
  hasThumb: boolean;   // True when a real thumbnail was found
  expiresAt: number;
}
export const signedUrlCache = new Map<string, CachedUrls>();

export const DEFAULT_SIGNED_URL_TTL = 3600; // 1 Hour

/**
 * Pre-fetches signed URLs for a batch of storage paths in 1 single network roundtrip.
 * Results are cached in the in-memory signedUrlCache.
 */
export async function prefetchSignedUrls(
  storagePaths: string[],
  ttl = DEFAULT_SIGNED_URL_TTL
): Promise<void> {
  const unexpired = storagePaths.filter((p) => {
    const cached = signedUrlCache.get(p);
    return !cached || cached.expiresAt <= Date.now();
  });

  if (unexpired.length === 0) return;

  try {
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrls(unexpired, ttl);

    if (error || !data) return;

    const expiresAt = Date.now() + (ttl - 100) * 1000;
    data.forEach((item) => {
      if (item.signedUrl && item.path) {
        const existing = signedUrlCache.get(item.path);
        signedUrlCache.set(item.path, {
          thumbUrl: existing?.thumbUrl || item.signedUrl,
          fullUrl: item.signedUrl,
          hasThumb: existing?.hasThumb || false,
          expiresAt,
        });
      }
    });
  } catch {
    // Fail gracefully — on-demand loaders will fall back to individual signed URL fetching
  }
}

/**
 * Generates a signed URL with Content-Disposition download header
 * and triggers a client download.
 */
export async function downloadAttachmentFile(
  storagePath: string,
  filename: string,
  ttl = DEFAULT_SIGNED_URL_TTL
): Promise<void> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, ttl, {
      download: filename,
    });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Failed to generate download URL');
  }

  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

