import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../../src/lib/utils/clipboard';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Resilient copyToClipboard utility', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
  });

  it('copies text successfully using navigator.clipboard.writeText', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const result = await copyToClipboard('22ESKCS099', {
      successMessage: 'Roll number copied!',
    });

    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('22ESKCS099');
    expect(toast.success).toHaveBeenCalledWith('Roll number copied!');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('falls back to document.execCommand when navigator.clipboard throws', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('104', {
      successMessage: 'Class roll copied!',
    });

    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('104');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(toast.success).toHaveBeenCalledWith('Class roll copied!');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('falls back to document.execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('P2WXYZ', {
      successMessage: 'Invite code copied!',
    });

    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(toast.success).toHaveBeenCalledWith('Invite code copied!');
  });

  it('displays error toast when both clipboard and execCommand fail', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(false);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('FailedText', {
      errorMessage: 'Clipboard permission denied',
    });

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Clipboard permission denied');
  });

  it('returns false and displays error toast when empty string is provided', async () => {
    const result = await copyToClipboard('');
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Clipboard permission denied');
  });
});
