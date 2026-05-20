/**
 * File attachment helpers — pure functions for validation and formatting.
 * Used across FileUploader, AttachmentCard, and tests.
 */

/** Maximum file size in bytes (10 MB default) */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Maximum number of files per upload */
export const MAX_FILE_COUNT = 5;

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
export function getFileCategory(fileType: string): 'pdf' | 'image' | 'spreadsheet' | 'code' | 'text' | 'other' {
  const t = fileType.toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.includes('csv') || t.includes('sheet') || t.includes('excel')) return 'spreadsheet';
  if (t.includes('json') || t.includes('javascript') || t.includes('typescript') || t.includes('css')) return 'code';
  if (t.startsWith('text/')) return 'text';
  return 'other';
}
