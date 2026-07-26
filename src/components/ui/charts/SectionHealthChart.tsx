import { useMemo } from 'react';

interface SectionHealthChartProps {
  safeCount: number;
  warningCount: number;
  criticalCount: number;
  totalStudents: number;
}

export function SectionHealthChart({
  safeCount,
  warningCount,
  criticalCount,
  totalStudents,
}: SectionHealthChartProps) {
  const stats = useMemo(() => {
    const total = Math.max(1, totalStudents);
    const safePct = ((safeCount / total) * 100).toFixed(0);
    const warnPct = ((warningCount / total) * 100).toFixed(0);
    const critPct = ((criticalCount / total) * 100).toFixed(0);

    return { safePct, warnPct, critPct };
  }, [safeCount, warningCount, criticalCount, totalStudents]);

  if (totalStudents === 0) return null;

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12 }}>
          Section Attendance Health
        </span>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {totalStudents} Students
        </span>
      </div>

      {/* Multi-segment stacked bar */}
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'var(--bg-elevated)', gap: 2 }}>
        <div
          style={{ width: `${stats.safePct}%`, background: 'var(--status-safe)', transition: 'width 0.6s ease' }}
          title={`Safe: ${safeCount} (${stats.safePct}%)`}
        />
        <div
          style={{ width: `${stats.warnPct}%`, background: 'var(--status-warning)', transition: 'width 0.6s ease' }}
          title={`Warning: ${warningCount} (${stats.warnPct}%)`}
        />
        <div
          style={{ width: `${stats.critPct}%`, background: 'var(--status-critical)', transition: 'width 0.6s ease' }}
          title={`Critical: ${criticalCount} (${stats.critPct}%)`}
        />
      </div>

      {/* Legend mapping */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-safe)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Safe: {safeCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-warning)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Warn: {warningCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-critical)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Danger: {criticalCount}</span>
        </div>
      </div>
    </div>
  );
}

export default SectionHealthChart;
