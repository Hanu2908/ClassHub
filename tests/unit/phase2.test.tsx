import React, { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { SkeletonTheme, default as Skeleton } from 'react-loading-skeleton';
import { useVirtualizer } from '@tanstack/react-virtual';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('Skeleton Theme Integration', () => {
  it('renders SkeletonTheme and injects correct custom colors as CSS variables', () => {
    const { container } = render(
      <SkeletonTheme baseColor="#121520" highlightColor="rgba(255, 255, 255, 0.05)">
        <Skeleton />
      </SkeletonTheme>
    );
    const skeleton = container.querySelector('.react-loading-skeleton');
    expect(skeleton).toBeDefined();
    
    const style = window.getComputedStyle(skeleton!);
    expect(style.getPropertyValue('--base-color')).toBe('#121520');
    expect(style.getPropertyValue('--highlight-color')).toBe('rgba(255, 255, 255, 0.05)');
  });
});

function VirtualizedList({ items }: { items: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 2,
  });

  return (
    <div
      ref={parentRef}
      data-testid="scroll-container"
      style={{
        height: '200px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-testid={`item-${virtualItem.index}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '50px',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  );
}

describe('Virtualizer Integration', () => {
  it('correctly calculates total container height based on estimated item sizes', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Item ${i}`);
    const { getByTestId } = render(<VirtualizedList items={items} />);
    
    // 20 items * 50px estimateSize = 1000px total height
    const scrollContainer = getByTestId('scroll-container');
    const innerContainer = scrollContainer.firstChild as HTMLDivElement;
    expect(innerContainer.style.height).toBe('1000px');
  });

  it('initially renders only a subset of items', () => {
    const items = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
    render(<VirtualizedList items={items} />);
    
    const renderedItems = screen.queryAllByTestId(/^item-/);
    // Since scrollHeight/clientHeight in jsdom defaults to 0, 
    // it will render a minimal subset of items (usually 0 + overscan, or a small number).
    // Let's assert it renders less than the full 50 items.
    expect(renderedItems.length).toBeLessThan(50);
  });
});

import { timeAgo, timeUntil, deadlineBadgeClass, deadlineLabel } from '../../src/components/Shared';

describe('Date Helper Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('timeAgo formats dates correctly', () => {
    const today = new Date().toISOString();
    expect(timeAgo(today)).toContain('Today');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(yesterday)).toContain('Yesterday');

    const older = new Date('2026-05-15T10:00:00Z').toISOString();
    expect(timeAgo(older)).toContain('15 May');
  });

  it('timeUntil calculates remaining time correctly', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(timeUntil(past)).toBe('Overdue');

    const futureMin = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    expect(timeUntil(futureMin)).toBe('in 5m');

    const futureHr = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(timeUntil(futureHr)).toBe('in 2h');

    const futureDay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
    expect(timeUntil(futureDay)).toBe('in 3d 2h');
  });

  it('deadlineBadgeClass returns correct status badges', () => {
    expect(deadlineBadgeClass(null)).toBe('badge-info');

    const past = new Date(Date.now() - 1000).toISOString();
    expect(deadlineBadgeClass(past)).toBe('badge-critical');

    const inOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineBadgeClass(inOneDay)).toBe('badge-critical');

    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineBadgeClass(inThreeDays)).toBe('badge-warning');

    const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineBadgeClass(inFiveDays)).toBe('badge-safe');
  });

  it('deadlineLabel returns correct friendly text', () => {
    expect(deadlineLabel(null)).toBe('No deadline');

    const past = new Date(Date.now() - 1000).toISOString();
    expect(deadlineLabel(past)).toBe('Overdue');

    const today = new Date().toISOString();
    expect(deadlineLabel(today)).toBe('Due Today');

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineLabel(tomorrow)).toBe('Due Tomorrow');

    const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineLabel(inFiveDays)).toBe('in 5 days');
  });
});

