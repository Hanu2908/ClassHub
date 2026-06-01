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
): { ok: true; files: File[] } | { ok: false; error: SharedFileValidationError } {
  if (files.length === 0) return { ok: false, error: 'empty-share' };
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
