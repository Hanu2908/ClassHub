import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly } from '../../components/Shared';
import { useAppStore, type ScheduleSlot } from '../../store/appStore';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';

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

// ── Subject category color system ─────────────────────────────────────────────
// Technical (CS/AI/DS/EC prefix): blue
// Lab (type=Lab or code ends with L): amber
// Audit/Other (ES/EN/HU/MENTOR, type=Other): violet
// Lecture/Tutorial (fallback): teal

type SubjectCategory = 'technical' | 'lab' | 'audit' | 'general';

function getCategory(code: string, type: string): SubjectCategory {
  if (type === 'Lab' || code.endsWith('L')) return 'lab';
  if (/^(CS|AI|DS|EC)/.test(code))          return 'technical';
  if (/^(ES|EN|HU|MENTOR)/.test(code))      return 'audit';
  return 'general';
}

const CATEGORY_COLORS: Record<SubjectCategory, { color: string; bg: string; border: string }> = {
  technical: { color: '#4A9EFF', bg: 'rgba(74,158,255,0.08)',  border: 'rgba(74,158,255,0.25)' },
  lab:       { color: '#FFB547', bg: 'rgba(255,181,71,0.08)',   border: 'rgba(255,181,71,0.25)' },
  audit:     { color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  general:   { color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.25)' },
};

const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  technical: 'Technical',
  lab:       'Lab',
  audit:     'Audit / Other',
  general:   'General',
};

// ── Add slot form ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
  font: '400 14px var(--font-body)', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  font: '500 12px var(--font-body)', color: 'var(--text-muted)',
  display: 'block', marginBottom: 6,
};

const SUBJECT_TYPES = ['Lecture', 'Lab', 'Tutorial', 'Other'];

function AddSlotSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const { addScheduleSlot } = useAppStore();
  const [subject, setSubject] = useState('');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [type, setType] = useState('Lecture');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const handleSave = () => {
    if (!subject.trim() || !code.trim() || !startTime || !endTime) {
      showToast('Fill in subject, code, and times', 'error');
      return;
    }
    const slot: ScheduleSlot = {
      id: `slot-${Date.now()}`,
      day,
      subject: subject.trim(),
      code: code.trim().toUpperCase(),
      room: room.trim() || 'TBD',
      teacher: teacher.trim(),
      type,
      startTime,
      endTime,
    };
    addScheduleSlot(slot);
    showToast('Slot added — visible to all students', 'success');
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} title={`Add Class — ${day}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
        <div>
          <label style={labelStyle}>Subject Name *</label>
          <input style={inputStyle} placeholder="e.g. DBMS" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Code *</label>
            <input style={inputStyle} placeholder="CS-304" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={{ ...inputStyle }} value={type} onChange={e => setType(e.target.value)}>
              {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Start Time *</label>
            <input style={inputStyle} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>End Time *</label>
            <input style={inputStyle} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Room</label>
          <input style={inputStyle} placeholder="Block B-102" value={room} onChange={e => setRoom(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Teacher</label>
          <input style={inputStyle} placeholder="Dr. Sharma" value={teacher} onChange={e => setTeacher(e.target.value)} />
        </div>

        <button
          id="save-slot-btn"
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: 'var(--accent-primary)', border: 'none',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            font: '600 14px var(--font-body)', color: '#fff',
          }}
        >
          <Save size={16} /> Save Slot
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Legend chip ───────────────────────────────────────────────────────────────
function LegendChip({ cat }: { cat: SubjectCategory }) {
  const { color } = CATEGORY_COLORS[cat];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ font: '400 10px var(--font-body)', color: 'var(--text-muted)' }}>
        {CATEGORY_LABELS[cat]}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const navigate = useNavigate();
  const todayKey = currentDayKey();
  const [selectedDay, setSelectedDay] = useState(
    DAYS.includes(todayKey as any) ? todayKey : 'Mon'
  );
  const [showAddSheet, setShowAddSheet] = useState(false);
  const now = new Date();

  const { schedule, deleteScheduleSlot, role } = useAppStore();
  const classes = (schedule[selectedDay] ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleDelete = (id: string) => {
    deleteScheduleSlot(id);
    showToast('Slot removed — updated for all students', 'info');
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button id="schedule-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>Schedule</h1>
          {/* Color legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(['technical', 'lab', 'audit'] as SubjectCategory[]).map(c => (
              <LegendChip key={c} cat={c} />
            ))}
          </div>
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
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <p style={{ font: '600 16px var(--font-display)', color: 'var(--text-secondary)', marginBottom: 6 }}>No classes today!</p>
            <p style={{ font: '400 13px var(--font-body)' }}>Enjoy your free day.</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', left: 52, top: 0, bottom: 0, width: 1, background: 'var(--border-default)' }} />

            {classes.map((cls) => {
              const start = toDate(cls.startTime);
              const end = toDate(cls.endTime);
              const isNow = selectedDay === todayKey && start <= now && now <= end;
              const isPast = selectedDay === todayKey && end < now;
              const dotColor = isNow ? 'var(--status-safe)' : isPast ? 'var(--text-muted)' : 'var(--accent-primary)';
              const label = isNow ? 'NOW' : selectedDay === todayKey && start > now ? hoursLabel(cls.startTime) : '';

              const cat = getCategory(cls.code, cls.type);
              const catStyle = CATEGORY_COLORS[cat];

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
                    borderColor: isNow ? 'var(--border-active)' : catStyle.border,
                    background: isPast ? undefined : catStyle.bg,
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
                        {/* Category badge */}
                        <span style={{
                          font: '400 10px var(--font-body)', color: catStyle.color,
                          background: catStyle.bg, border: `1px solid ${catStyle.border}`,
                          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                        }}>
                          {cls.type}
                        </span>
                        {/* CR delete */}
                        {role === 'cr' && (
                          <button
                            id={`del-slot-${cls.id}`}
                            onClick={() => handleDelete(cls.id)}
                            style={{
                              background: 'rgba(255,68,68,0.10)', border: '1px solid rgba(255,68,68,0.2)',
                              borderRadius: 6, padding: '4px 6px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                              font: '500 10px var(--font-body)', color: 'var(--status-critical)',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        )}
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

      {/* CR: add slot FAB */}
      <CROnly>
        <button
          id="add-schedule-fab"
          className="fab"
          aria-label="Add schedule slot"
          onClick={() => setShowAddSheet(true)}
        >
          <Plus size={22} />
        </button>
      </CROnly>

      {showAddSheet && (
        <AddSlotSheet day={selectedDay} onClose={() => setShowAddSheet(false)} />
      )}

      <NavBar />
    </div>
  );
}
