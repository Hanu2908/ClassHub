import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly } from '../../components/Shared';
import { mockSchedule } from '../../data/mockData';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function currentDayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' });
}

function toDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0); return d;
}

function hoursLabel(timeStr: string): string {
  const now = new Date();
  const target = toDate(timeStr);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

const TYPE_COLORS: Record<string, string> = {
  Lecture: 'var(--accent-primary)',
  Lab: 'var(--status-warning)',
  Tutorial: 'var(--status-safe)',
  Other: 'var(--text-muted)',
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const todayKey = currentDayKey();
  const [selectedDay, setSelectedDay] = useState(
    DAYS.includes(todayKey as any) ? todayKey : 'Mon'
  );
  const now = new Date();

  const classes = (mockSchedule as any)[selectedDay] ?? [];

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button id="schedule-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Schedule</h1>
        </div>
        <div className="day-tabs">
          {DAYS.map(day => {
            const isToday = day === todayKey;
            const isActive = day === selectedDay;
            return (
              <button
                key={day}
                id={`day-tab-${day}`}
                className={`day-tab${isActive ? ' active' : ''}${isToday ? ' today' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{day}</span>
                <div className="day-dot" style={{ background: isToday ? 'currentColor' : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </header>

      <main className="page-content">
        <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-secondary)', marginBottom: -4 }}>
          {selectedDay === todayKey ? `Today — ` : ''}
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🎉</p>
            <p style={{ font: '600 16px var(--font-display)', color: 'var(--text-secondary)', marginBottom: 6 }}>No classes today!</p>
            <p style={{ font: '400 13px var(--font-body)' }}>Enjoy your free day.</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: 52, top: 0, bottom: 0, width: 1, background: 'var(--border-default)' }} />

            {classes.map((cls: any) => {
              const start = toDate(cls.startTime);
              const end = toDate(cls.endTime);
              const isNow = selectedDay === todayKey && start <= now && now <= end;
              const isPast = selectedDay === todayKey && end < now;
              const dotColor = isNow ? 'var(--status-safe)' : isPast ? 'var(--text-muted)' : 'var(--accent-primary)';
              const label = isNow ? 'NOW' : selectedDay === todayKey && start > now ? hoursLabel(cls.startTime) : '';

              return (
                <div key={cls.id} className="timeline-item">
                  <div style={{ width: 52, flexShrink: 0, paddingTop: 2 }}>
                    <p style={{ font: '500 10px var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right', paddingRight: 12, whiteSpace: 'nowrap' }}>
                      {formatTime(cls.startTime)}
                    </p>
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, marginTop: 4 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', border: `2px solid ${dotColor}`,
                      background: isNow ? dotColor : 'var(--bg-base)',
                      boxShadow: isNow ? `0 0 8px ${dotColor}` : undefined,
                    }} />
                  </div>
                  <div className="card" style={{
                    flex: 1, padding: '12px 14px',
                    opacity: isPast ? 0.5 : 1,
                    borderColor: isNow ? 'var(--border-active)' : undefined,
                    boxShadow: isNow ? 'var(--shadow-glow-blue)' : undefined,
                    animation: 'fadeSlideUp 0.35s ease both',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ font: '600 14px var(--font-display)', color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', marginBottom: 4 }}>
                          {cls.subject}
                        </p>
                        <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-muted)' }}>
                          {cls.code} · {cls.room}{cls.teacher ? ` · ${cls.teacher}` : ''}
                        </p>
                        <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>
                          {formatTime(cls.startTime)} – {formatTime(cls.endTime)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        {isNow && <span className="badge badge-info" style={{ animation: 'nowPulse 2s ease-in-out infinite' }}>NOW</span>}
                        {label && !isNow && <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>}
                        <span style={{ font: '400 10px var(--font-body)', color: TYPE_COLORS[cls.type] ?? 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {cls.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p style={{ textAlign: 'center', font: '400 12px var(--font-body)', color: 'var(--text-muted)', padding: '16px 0' }}>
              — No more classes —
            </p>
          </div>
        )}
      </main>

      <CROnly>
        <button id="add-schedule-fab" className="fab" aria-label="Add schedule slot">
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
