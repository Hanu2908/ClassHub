import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Coffee } from 'lucide-react';
import { useSchedule } from '../../../hooks/useSupabaseQuery';
import { todayKey, parseTime, hoursUntil, WidgetSkeleton, sectionCardStyle, sectionIconStyle } from './dashboardUtils';
import { getCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '../../../lib/scheduleUtils';
import type { ScheduleSlot } from '../../../store/appStore';

export default function ScheduleWidget() {
  const navigate = useNavigate();
  const key = todayKey();
  const { data: schedule, isLoading } = useSchedule();
  const classes = useMemo(() => schedule?.[key] ?? [], [schedule, key]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30 * 1000); // 30 second interval
    return () => clearInterval(timer);
  }, []);
  
  const current = useMemo(() => classes.find((c) => {
    const start = parseTime(c.startTime);
    const end = parseTime(c.endTime);
    return start <= now && now <= end;
  }), [classes, now]);

  const upcoming = useMemo(() => classes
    .filter((c) => parseTime(c.startTime) > now)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [classes, now]);

  const display = useMemo<ScheduleSlot[]>(() => {
    if (!current) return upcoming.slice(0, 2);
    return upcoming[0] ? [current, upcoming[0]] : [current];
  }, [current, upcoming]);

  if (isLoading) return <WidgetSkeleton height={60} />;

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Today's Schedule</span>
        <button className="section-link" onClick={() => navigate('/app/schedule')}>View all →</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {display.length === 0 ? (
          <div style={sectionCardStyle}>
            <div style={sectionIconStyle}>
              <Coffee size={24} color="var(--text-secondary)" />
            </div>
            <div>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>You're all clear!</p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>No classes scheduled for today.</p>
            </div>
          </div>
        ) : display.map((cls, i) => {
          const isNow = current?.id === cls.id;
          const cat = getCategory(cls.code, cls.type);
          const catStyle = CATEGORY_COLORS[cat];
          return (
            <div key={cls.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: i < display.length - 1 ? '1px solid var(--border-default)' : 'none',
              background: isNow ? 'rgba(74, 158, 255, 0.05)' : 'transparent',
              position: 'relative',
              gap: 12,
            }}>
              {/* Left Column: Time & Room */}
              <div style={{ display: 'flex', flexDirection: 'column', width: 62, flexShrink: 0 }}>
                <span className="t-mono" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} className="text-muted" style={{ opacity: 0.6 }} />
                  {cls.startTime}
                </span>
                <span className="t-helper" style={{ color: 'var(--text-muted)', marginTop: 2, paddingLeft: 15 }}>
                  {cls.room}
                </span>
              </div>
              
              {/* Vertical Category Indicator Line */}
              <div style={{
                width: 3,
                alignSelf: 'stretch',
                background: isNow ? 'var(--status-safe)' : catStyle.color,
                borderRadius: 1.5,
                flexShrink: 0,
              }} />

              {/* Middle Column: Subject Info */}
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <p className="truncate t-button" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>
                  {cls.subject}
                </p>
                <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                  {cls.code} · {CATEGORY_LABELS[cat] || cls.type || 'Lecture'}
                </p>
              </div>

              {/* Right Column: Badge Status */}
              <div style={{ flexShrink: 0 }}>
                {isNow ? (
                  <span className="badge badge-safe t-badge" style={{ 
                    background: 'rgba(52, 211, 153, 0.15)', 
                    color: 'var(--status-safe)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    letterSpacing: '0.05em',
                  }}>● LIVE</span>
                ) : (
                  <span className="badge t-badge" style={{ 
                    background: catStyle.bg,
                    color: catStyle.color,
                    borderColor: 'rgba(255, 255, 255, 0.05)' 
                  }}>
                    {hoursUntil(cls.startTime)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
