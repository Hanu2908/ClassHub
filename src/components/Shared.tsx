/* eslint-disable react-refresh/only-export-components */
import { useAppStore } from '../store/appStore';
import { isToday, isYesterday, format, differenceInCalendarDays, differenceInHours, differenceInMinutes } from 'date-fns';


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

export { default as Skeleton } from 'react-loading-skeleton';

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
  const timeStr = format(date, 'h:mm a'); // E.g., "2:30 PM"
  
  if (isToday(date)) {
    return `Today • ${timeStr}`;
  } else if (isYesterday(date)) {
    return `Yesterday • ${timeStr}`;
  } else {
    const dateStr = format(date, 'd MMM'); // E.g., "31 May"
    return `${dateStr} • ${timeStr}`;
  }
}

export function timeUntil(iso: string): string {
  const targetDate = new Date(iso);
  const now = new Date();
  
  const diffMins = differenceInMinutes(targetDate, now);
  if (diffMins <= 0) return 'Overdue';
  
  if (diffMins < 60) return `in ${diffMins}m`;
  
  const diffHrs = differenceInHours(targetDate, now);
  if (diffHrs < 24) {
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `in ${diffHrs}h ${remainingMins}m` : `in ${diffHrs}h`;
  }
  
  const diffDays = Math.floor(diffHrs / 24);
  const remainingHrs = diffHrs % 24;
  return remainingHrs > 0 ? `in ${diffDays}d ${remainingHrs}h` : `in ${diffDays}d`;
}

export function deadlineBadgeClass(iso: string | null): string {
  if (!iso) return 'badge-info';
  const targetDate = new Date(iso);
  const now = new Date();
  
  const diffDays = differenceInCalendarDays(targetDate, now);
  if (diffDays < 0) return 'badge-critical';
  if (diffDays < 2) return 'badge-critical';
  if (diffDays < 4) return 'badge-warning';
  return 'badge-safe';
}

export function deadlineLabel(iso: string | null): string {
  if (!iso) return 'No deadline';
  
  const targetDate = new Date(iso);
  const now = new Date();
  
  if (targetDate.getTime() < now.getTime()) return 'Overdue';
  
  const diffDays = differenceInCalendarDays(targetDate, now);
  if (diffDays === 0) return 'Due Today';
  if (diffDays === 1) return 'Due Tomorrow';
  return `in ${diffDays} days`;
}
