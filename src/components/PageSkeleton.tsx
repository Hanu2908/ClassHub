import { Skeleton } from './Shared';

export default function PageSkeleton() {
  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      {/* Skeleton Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10,12,20,0.96)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border-default)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width="32px" height="32px" style={{ borderRadius: '50%' }} />
          <Skeleton width="120px" height="18px" style={{ borderRadius: 'var(--radius-sm)' }} />
        </div>
        <Skeleton width="28px" height="28px" style={{ borderRadius: '50%' }} />
      </header>

      {/* Main Content Area Placeholder */}
      <main style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Carousel/Highlight Skeleton */}
        <div className="card animate-pulse" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="90px" height="14px" style={{ borderRadius: 'var(--radius-pill)' }} />
            <Skeleton width="60px" height="12px" />
          </div>
          <Skeleton width="80%" height="20px" style={{ margin: '4px 0' }} />
          <Skeleton width="95%" height="13px" />
          <Skeleton width="60%" height="13px" />
        </div>

        {/* Small horizontal block skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="40%" height="12px" />
            <Skeleton width="80%" height="16px" style={{ marginTop: 4 }} />
          </div>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="40%" height="12px" />
            <Skeleton width="70%" height="16px" style={{ marginTop: 4 }} />
          </div>
        </div>

        {/* Primary Feed Item Skeletons */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skeleton width="40px" height="40px" style={{ borderRadius: '12px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="50%" height="14px" />
              <Skeleton width="30%" height="10px" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <Skeleton width="100%" height="12px" />
            <Skeleton width="90%" height="12px" />
            <Skeleton width="40%" height="12px" />
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skeleton width="40px" height="40px" style={{ borderRadius: '12px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="60%" height="14px" />
              <Skeleton width="25%" height="10px" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <Skeleton width="100%" height="12px" />
            <Skeleton width="85%" height="12px" />
          </div>
        </div>
      </main>

      {/* Skeleton Bottom Tab Bar */}
      <nav className="navbar" style={{ position: 'sticky', bottom: 0, height: '60px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Skeleton width="22px" height="22px" style={{ borderRadius: '50%' }} />
            <Skeleton width="32px" height="8px" style={{ borderRadius: 'var(--radius-sm)' }} />
          </div>
        ))}
      </nav>
    </div>
  );
}
