/* eslint-disable react-refresh/only-export-components */
import { useAppStore } from '../store/appStore';

interface CROnlyProps { children: React.ReactNode; }

export function CROnly({ children }: CROnlyProps) {
  const role = useAppStore(s => s.role);
  return role === 'cr' ? <>{children}</> : null;
}

// Donut ring SVG for attendance
interface DonutRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function DonutRing({ percentage, size = 56, strokeWidth = 5, color, children }: DonutRingProps & { children?: React.ReactNode }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percentage, 100) / 100);
  const rounded = Math.round(percentage);
  const c = color ?? (rounded >= 85 ? 'var(--status-safe)' : rounded >= 75 ? 'var(--status-warning)' : 'var(--status-critical)');
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} className="donut-ring" style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle className="donut-track" cx={size/2} cy={size/2} r={r} strokeWidth={strokeWidth} />
        <circle
          className="donut-progress"
          cx={size/2} cy={size/2} r={r}
          strokeWidth={strokeWidth}
          stroke={c}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      {children && <div style={{ zIndex: 1, position: 'relative' }}>{children}</div>}
    </div>
  );
}

// Multi-segment donut showing multiple percentages as colored arcs
export interface MultiSegment {
  label: string;
  percentage: number; // 0-100
  color?: string;
}

interface MultiDonutProps {
  segments: MultiSegment[];
  size?: number;
  strokeWidth?: number;
}

export function MultiDonut({ segments, size = 72, strokeWidth = 8 }: MultiDonutProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = Math.max(0.0001, segments.reduce((s, seg) => s + Math.max(0, seg.percentage), 0));
  const arcs = segments.map((seg, i) => {
    const prior = segments
      .slice(0, i)
      .reduce((sum, priorSeg) => sum + ((priorSeg.percentage / total) * circ), 0);
    const pct = (seg.percentage / total) * 100;
    const dash = (pct / 100) * circ;
    return {
      ...seg,
      dashArray: `${dash} ${circ}`,
      dashOffset: -prior,
      stroke: seg.color ?? (i === 0 ? 'var(--status-safe)' : i === 1 ? 'var(--status-warning)' : 'var(--status-info)'),
    };
  });

  return (
    <div style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {arcs.map((seg, i) => {
          return (
            <circle
              key={seg.label + i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="transparent"
              stroke={seg.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} stroke="transparent" fill="none" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="t-subtitle" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {Math.round(segments.reduce((s, seg) => s + seg.percentage, 0))}%
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Done</div>
        </div>
      </div>
    </div>
  );
}

// Skeleton shimmer block
interface SkeletonProps { width?: string | number; height?: string | number; style?: React.CSSProperties; }
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

// Empty state
interface EmptyStateProps { emoji?: string; icon?: React.ReactNode; title: string; subtitle?: string; }
export function EmptyState({ emoji, icon, title, subtitle }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{icon ?? emoji}</div>
      <p className="t-card-title" style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</p>
      {subtitle && <p className="t-body" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

// Time helper - Context-aware absolute friendly timestamps
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  
  // Format the exact time (e.g. 2:30 PM)
  const timeStr = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Calculate day differences by resetting hours/minutes/seconds
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (targetDate === today) {
    return `Today • ${timeStr}`;
  } else if (targetDate === yesterday) {
    return `Yesterday • ${timeStr}`;
  } else {
    // Older: e.g. "31 May • 2:30 PM"
    const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${dateStr} • ${timeStr}`;
  }
}

export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `in ${hrs}h ${remainingMins}m` : `in ${hrs}h`;
  }
  const days = Math.floor(hrs / 24);
  const remainingHrs = hrs % 24;
  return remainingHrs > 0 ? `in ${days}d ${remainingHrs}h` : `in ${days}d`;
}

export function deadlineBadgeClass(iso: string | null): string {
  if (!iso) return 'badge-info';
  const diff = new Date(iso).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'badge-critical';
  if (days < 2) return 'badge-critical';
  if (days < 4) return 'badge-warning';
  return 'badge-safe';
}

export function deadlineLabel(iso: string | null): string {
  if (!iso) return 'No deadline';
  
  const targetDate = new Date(iso);
  const now = new Date();
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  
  const diffDays = Math.round((targetDayStart - todayStart) / (1000 * 60 * 60 * 24));
  
  if (targetDate.getTime() < now.getTime()) return 'Overdue';
  if (diffDays === 0) return 'Due Today';
  if (diffDays === 1) return 'Due Tomorrow';
  return `in ${diffDays} days`;
}
