import { toast } from 'sonner';

/**
 * Copies text to clipboard with a fallback for older browsers or environments
 * where navigator.clipboard is unavailable (like HTTP without localhost).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback using execCommand for unsupported contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      throw new Error('Fallback copy failed');
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      toast.error('Clipboard permission denied');
    } else {
      toast.error('Failed to copy to clipboard');
    }
    return false;
  }
}
