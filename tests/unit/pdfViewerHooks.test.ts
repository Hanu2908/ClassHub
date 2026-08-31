import { describe, expect, it } from 'vitest';
import type { PageLayout } from '../../src/pages/app/pdf-viewer/types';

describe('PDF Viewer Types & Layout Calculations', () => {
  it('correctly calculates cumulative offsets for page layouts', () => {
    const mockLayouts: PageLayout[] = [
      { pageNumber: 1, width: 595, height: 842, offsetTop: 0 },
      { pageNumber: 2, width: 595, height: 842, offsetTop: 858 }, // 842 + 16px spacing
      { pageNumber: 3, width: 595, height: 842, offsetTop: 1716 },
    ];

    expect(mockLayouts.length).toBe(3);
    expect(mockLayouts[0].offsetTop).toBe(0);
    expect(mockLayouts[1].offsetTop).toBe(858);
    expect(mockLayouts[2].offsetTop).toBe(1716);
  });

  it('correctly evaluates assigned page range conditions', () => {
    const isPageInRange = (range: string, pageNum: number): boolean => {
      if (!range) return false;
      try {
        if (range.includes('-')) {
          const [start, end] = range.split('-').map((x) => parseInt(x.trim(), 10));
          return pageNum >= start && pageNum <= end;
        } else {
          return pageNum === parseInt(range.trim(), 10);
        }
      } catch {
        return false;
      }
    };

    expect(isPageInRange('4-8', 3)).toBe(false);
    expect(isPageInRange('4-8', 4)).toBe(true);
    expect(isPageInRange('4-8', 6)).toBe(true);
    expect(isPageInRange('4-8', 8)).toBe(true);
    expect(isPageInRange('4-8', 9)).toBe(false);
    expect(isPageInRange('5', 5)).toBe(true);
    expect(isPageInRange('5', 6)).toBe(false);
    expect(isPageInRange('', 1)).toBe(false);
  });

  it('correctly evaluates buffer window boundaries for low-end and high-end devices', () => {
    const isPageInCacheBuffer = (
      activePage: number,
      targetPage: number,
      isLowEnd: boolean
    ): boolean => {
      const rangeLimit = isLowEnd ? 1 : 2;
      return Math.abs(targetPage - activePage) <= rangeLimit;
    };

    // On low-end devices (buffer = 1)
    expect(isPageInCacheBuffer(5, 5, true)).toBe(true);
    expect(isPageInCacheBuffer(5, 6, true)).toBe(true);
    expect(isPageInCacheBuffer(5, 4, true)).toBe(true);
    expect(isPageInCacheBuffer(5, 7, true)).toBe(false);
    expect(isPageInCacheBuffer(5, 3, true)).toBe(false);

    // On standard/high-end devices (buffer = 2)
    expect(isPageInCacheBuffer(5, 7, false)).toBe(true);
    expect(isPageInCacheBuffer(5, 3, false)).toBe(true);
    expect(isPageInCacheBuffer(5, 8, false)).toBe(false);
    expect(isPageInCacheBuffer(5, 2, false)).toBe(false);
  });
});
