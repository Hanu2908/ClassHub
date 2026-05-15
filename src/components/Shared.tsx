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

export function DonutRing({ percentage, size = 56, strokeWidth = 5, color }: DonutRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percentage, 100) / 100);
  const c = color ?? (percentage >= 85 ? 'var(--status-safe)' : percentage >= 75 ? 'var(--status-warning)' : 'var(--status-critical)');
  return (
    <svg width={size} height={size} className="donut-ring" style={{ flexShrink: 0 }}>
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
  );
}

// Skeleton shimmer block
interface SkeletonProps { width?: string; height?: number; style?: React.CSSProperties; }
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

// Empty state
interface EmptyStateProps { emoji: string; title: string; subtitle?: string; }
export function EmptyState({ emoji, title, subtitle }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
      <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</p>
      {subtitle && <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

// Time helper
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d ${hrs % 24}h`;
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
  const diff = new Date(iso).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'Overdue';
  if (days < 1) return 'Due Today';
  if (days < 2) return 'Due Tomorrow';
  return `Due ${new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
}
