import { Skeleton } from './Shared';

// 1. Announcements Page Skeleton loader (vertical stack of feed cards)
export function AnnouncementsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="90px" height={16} style={{ borderRadius: 'var(--radius-pill)' }} />
            <Skeleton width="60px" height={12} />
          </div>
          <Skeleton width="75%" height={18} style={{ margin: '4px 0 6px' }} />
          <Skeleton width="95%" height={13} style={{ marginBottom: 4 }} />
          <Skeleton width="80%" height={13} />
        </div>
      ))}
    </div>
  );
}

// 2. Assignments Page Skeleton loader (left icon + title details + full button)
export function AssignmentsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Skeleton width="44px" height="44px" style={{ borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Skeleton width="70px" height={16} style={{ borderRadius: 'var(--radius-pill)' }} />
                <Skeleton width="100px" height={16} />
              </div>
            </div>
          </div>
          <Skeleton width="95%" height={13} style={{ marginTop: 6, marginBottom: 4 }} />
          <Skeleton width="80%" height={13} />
          <Skeleton width="100%" height={38} style={{ borderRadius: 'var(--radius-md)', marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// 3. Polls Page Skeleton loader (closes badge + question + 3 option bars)
export function PollsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Skeleton width="80px" height={16} style={{ borderRadius: 'var(--radius-pill)' }} />
              <Skeleton width="60px" height={16} style={{ borderRadius: 'var(--radius-pill)' }} />
            </div>
            <Skeleton width="70px" height={12} />
          </div>
          <Skeleton width="85%" height={18} style={{ margin: '4px 0 8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="100%" height={40} style={{ borderRadius: 'var(--radius-md)' }} />
            <Skeleton width="100%" height={40} style={{ borderRadius: 'var(--radius-md)' }} />
            <Skeleton width="100%" height={40} style={{ borderRadius: 'var(--radius-md)' }} />
          </div>
          <Skeleton width="50px" height={12} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

// 4. Schedule Page Skeleton loader (proportional timeline cards + hour markers)
export function ScheduleSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="schedule-timeline" style={{ position: 'relative', height: 350, marginTop: 8 }}>
        {/* Proportional Hour Marks */}
        {[8, 9, 10, 11, 12, 13].map((h, i) => (
          <div key={h} className="schedule-hour-mark" style={{ top: i * 70, position: 'absolute', left: 0, right: 0 }}>
            <span className="schedule-hour-label" style={{ color: 'var(--text-muted)' }}>
              {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
            </span>
            <div className="schedule-hour-line" />
          </div>
        ))}
        {/* Proportional Class block overlays */}
        <div style={{ position: 'absolute', top: 15, left: 52, right: 8, height: 90, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="65%" height={11} />
        </div>
        <div style={{ position: 'absolute', top: 135, left: 52, right: 8, height: 60, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 6 }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="50%" height={11} />
        </div>
        <div style={{ position: 'absolute', top: 215, left: 52, right: 8, height: 110, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 8 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="70%" height={11} />
        </div>
      </div>
    </div>
  );
}

// 5. Attendance Page Skeleton loader (flex grid list of cards with Donut placeholder)
export function AttendanceSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12, marginBottom: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="45%" height={11} style={{ marginTop: 2 }} />
            <Skeleton width="60%" height={12} style={{ marginTop: 4 }} />
          </div>
          {/* Circular donut placeholder */}
          <div className="skeleton" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// 6. Manage Subjects Page Skeleton loader (table list structure of curriculum rows)
export function ManageSubjectsSkeleton() {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 80px 24px', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
        <Skeleton width="30px" height={10} />
        <Skeleton width="120px" height={10} />
        <Skeleton width="20px" height={10} />
        <Skeleton width="50px" height={10} />
        <div />
      </div>
      {/* Table grid rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 80px 24px', gap: 10, alignItems: 'center', padding: '8px 0' }}>
          <Skeleton width="50px" height={32} style={{ borderRadius: 6 }} />
          <Skeleton width="90%" height={32} style={{ borderRadius: 6 }} />
          <Skeleton width="30px" height={32} style={{ borderRadius: 6 }} />
          <Skeleton width="70px" height={32} style={{ borderRadius: 6 }} />
          <Skeleton width="18px" height={18} style={{ borderRadius: '50%', justifySelf: 'center' }} />
        </div>
      ))}
    </div>
  );
}

// 7. CR Command Center Submissions Tracker Row list Skeleton loader
export function SubmissionsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="student-ack-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', margin: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Skeleton width="40%" height={13} />
            <Skeleton width="25%" height={10} />
          </div>
          <Skeleton width="70px" height={22} style={{ borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );
}
