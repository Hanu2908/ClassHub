import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DEFAULT_SIGNED_URL_TTL,
  signedUrlCache,
  prefetchSignedUrls,
  downloadAttachmentFile,
} from '../../src/lib/utils/attachments';
import { supabase } from '../../src/lib/supabase';

describe('Storage Signed URL TTL and Batch Prefetching', () => {
  beforeEach(() => {
    signedUrlCache.clear();
    vi.restoreAllMocks();
  });

  it('exports DEFAULT_SIGNED_URL_TTL as 3600 seconds (1 hour)', () => {
    expect(DEFAULT_SIGNED_URL_TTL).toBe(3600);
  });

  it('prefetches multiple signed URLs in a single roundtrip and populates cache', async () => {
    const mockCreateSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: 'section-p2/announcement/1/file1.pdf', signedUrl: 'https://storage/file1.pdf?token=abc', error: null },
        { path: 'section-p2/announcement/1/file2.png', signedUrl: 'https://storage/file2.png?token=def', error: null },
      ],
      error: null,
    });

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      createSignedUrls: mockCreateSignedUrls,
    } as any);

    const paths = [
      'section-p2/announcement/1/file1.pdf',
      'section-p2/announcement/1/file2.png',
    ];

    await prefetchSignedUrls(paths, 3600);

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(paths, 3600);
    expect(signedUrlCache.has('section-p2/announcement/1/file1.pdf')).toBe(true);
    expect(signedUrlCache.has('section-p2/announcement/1/file2.png')).toBe(true);

    const cached = signedUrlCache.get('section-p2/announcement/1/file1.pdf');
    expect(cached?.fullUrl).toBe('https://storage/file1.pdf?token=abc');
    expect(cached?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('skips already cached unexpired paths during prefetch', async () => {
    signedUrlCache.set('section-p2/announcement/1/cached.pdf', {
      thumbUrl: 'https://storage/cached.pdf?token=123',
      fullUrl: 'https://storage/cached.pdf?token=123',
      hasThumb: false,
      expiresAt: Date.now() + 1000 * 60 * 30, // 30 mins remaining
    });

    const mockCreateSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: 'section-p2/announcement/1/uncached.pdf', signedUrl: 'https://storage/uncached.pdf?token=456', error: null },
      ],
      error: null,
    });

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      createSignedUrls: mockCreateSignedUrls,
    } as any);

    await prefetchSignedUrls([
      'section-p2/announcement/1/cached.pdf',
      'section-p2/announcement/1/uncached.pdf',
    ]);

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['section-p2/announcement/1/uncached.pdf'], 3600);
  });

  it('downloadAttachmentFile calls createSignedUrl with download option and 3600s TTL', async () => {
    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage/download/file.pdf?token=xyz' },
      error: null,
    });

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    } as any);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadAttachmentFile('section-p2/assignment/1/notes.pdf', 'notes.pdf', 3600);

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'section-p2/assignment/1/notes.pdf',
      3600,
      { download: 'notes.pdf' }
    );
    expect(clickSpy).toHaveBeenCalled();
  });
});
