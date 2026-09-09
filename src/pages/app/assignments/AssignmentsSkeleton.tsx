import Skeleton from 'react-loading-skeleton';

export function AssignmentsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 0, padding: '16px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Skeleton width={44} height={44} borderRadius={12} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Skeleton width={70} height={16} borderRadius="var(--radius-pill)" />
                <Skeleton width={100} height={16} />
              </div>
            </div>
          </div>
          <Skeleton width="95%" height={13} style={{ marginTop: 6, marginBottom: 4 }} />
          <Skeleton width="80%" height={13} style={{ marginTop: 6 }} />
          <Skeleton width="100%" height={38} borderRadius="var(--radius-md)" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
