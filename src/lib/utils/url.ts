/**
 * URL sanitization utilities to prevent XSS and malicious scheme execution.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Sanitizes an arbitrary URL string for safe use in <a href={...}> or window.open(...).
 * Returns '#blocked-insecure-protocol' if an unsafe or scriptable protocol is detected.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Disallow invisible control characters and null bytes
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return '#blocked-insecure-protocol';
  }

  // Allow relative URLs starting with / or internal anchor jumps starting with #
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  // Extract scheme
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    // Protocol-relative URL (e.g. //example.com)
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }
    // Relative path or plain domain without scheme: default to https
    return `https://${trimmed}`;
  }

  const scheme = trimmed.slice(0, colonIndex + 1).toLowerCase();

  // Explicitly block dangerous schemes
  if (ALLOWED_PROTOCOLS.has(scheme)) {
    return trimmed;
  }

  return '#blocked-insecure-protocol';
}
