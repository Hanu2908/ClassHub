import { describe, expect, it, vi, beforeEach } from 'vitest';
import { copyToClipboard } from '../../src/lib/utils/clipboard';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

describe('clipboard util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses navigator.clipboard if available', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });
    // mock window.isSecureContext
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });

    const result = await copyToClipboard('test text');
    
    expect(mockWriteText).toHaveBeenCalledWith('test text');
    expect(result).toBe(true);
  });

  it('falls back to execCommand if navigator.clipboard is unavailable', async () => {
    // hide navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true });
    
    const mockExecCommand = vi.fn().mockReturnValue(true);
    document.execCommand = mockExecCommand;
    
    const result = await copyToClipboard('test text fallback');
    
    expect(mockExecCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  it('handles permission denied error', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });

    const result = await copyToClipboard('test text');
    
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Clipboard permission denied');
  });

  it('handles generic fallback error', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true });
    const mockExecCommand = vi.fn().mockReturnValue(false);
    document.execCommand = mockExecCommand;

    const result = await copyToClipboard('test text');

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard');
  });
});
