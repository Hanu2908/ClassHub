import React from 'react';
import Skeleton from 'react-loading-skeleton';

export function SectionHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <p className="t-card-title" style={{ color: 'var(--text-primary)', flex: 1 }}>{title}</p>
      {count !== undefined ? (
        <span className="t-mono" style={{
          color: 'var(--accent-primary)',
          background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        }}>
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function LocalSubmissionsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Skeleton width="40%" height={13} />
            <Skeleton width="25%" height={10} />
          </div>
          <Skeleton width={70} height={22} borderRadius={10} />
        </div>
      ))}
    </div>
  );
}
