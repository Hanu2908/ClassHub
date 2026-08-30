import { toast } from 'sonner';

export interface CopyOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
}

/**
 * Resilient copy-to-clipboard utility.
 * Attempts modern navigator.clipboard.writeText with a fallback to document.execCommand('copy')
 * for unsupported, legacy, or insecure contexts.
 */
export async function copyToClipboard(
  text: string,
  options: CopyOptions = {}
): Promise<boolean> {
  const {
    successMessage,
    errorMessage = 'Clipboard permission denied',
    showToast = true,
  } = options;

  if (!text) {
    if (showToast) {
      toast.error(errorMessage);
    }
    return false;
  }

  // 1. Try modern navigator.clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      if (showToast && successMessage) {
        toast.success(successMessage);
      }
      return true;
    } catch {
      // Modern clipboard failed or was rejected by permissions policy; fall through to legacy fallback
    }
  }

  // 2. Legacy fallback: document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Ensure textarea is not visible or disruptive to user focus
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        if (showToast && successMessage) {
          toast.success(successMessage);
        }
        return true;
      }
    } catch {
      // Fallback failed
    }
  }

  // 3. Complete failure handling
  if (showToast) {
    toast.error(errorMessage);
  }
  return false;
}
