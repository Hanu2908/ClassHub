import React from 'react';
import type { CSSProperties } from 'react';

export function todayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' });
}

export function parseTime(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function hoursUntil(timeStr: string): string {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Now';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;
}

export function linkify(text: string): React.ReactNode {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part) || part.startsWith('http://') || part.startsWith('https://')) {
      return React.createElement(
        'a',
        {
          key: index,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { color: 'var(--accent-primary)', textDecoration: 'underline', wordBreak: 'break-all' },
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        },
        part
      );
    }
    return part;
  });
}

// CSS Styles
export const skeletonCardStyle: CSSProperties = {
  padding: 16,
};

export const skeletonLineStyle: CSSProperties = {
  width: '60%',
  height: 14,
  marginBottom: 10,
  borderRadius: 6,
};

export const skeletonBlockStyle: CSSProperties = {
  width: '40%',
  borderRadius: 8,
};

export const pageHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'rgba(13,15,20,0.95)',
  backdropFilter: 'blur(16px)',
  borderBottom: '1px solid var(--border-default)',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const iconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  position: 'relative',
};

export const notificationBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: 'var(--status-critical)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1.5px solid var(--bg-base)',
  fontSize: '9px',
  fontWeight: 'bold',
  fontFamily: 'var(--font-mono)',
  lineHeight: 1,
};

export const sectionCardStyle: CSSProperties = {
  padding: '32px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  textAlign: 'center',
};

export const sectionIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function WidgetSkeleton({ height = 80 }: { height?: number }) {
  return React.createElement(
    'div',
    { className: 'card', style: skeletonCardStyle },
    React.createElement('div', { className: 'skeleton', style: skeletonLineStyle }),
    React.createElement('div', { className: 'skeleton', style: { ...skeletonBlockStyle, height } })
  );
}
