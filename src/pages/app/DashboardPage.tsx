import { useState, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, ChevronRight, AlertTriangle, Megaphone, BookOpen, Cpu, BookMarked, X, Coffee, PartyPopper, ShieldCheck, BarChart2, ClipboardList, Activity, Percent, Calendar, Clock } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { DonutRing, deadlineBadgeClass, deadlineLabel, timeAgo } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement, type ScheduleSlot } from '../../store/appStore';
import { BottomSheet } from '../../components/BottomSheet';
import { useSection, useAnnouncements, useAssignments, usePolls, useSchedule, useAttendance } from '../../hooks/useSupabaseQuery';


// ── Schedule helpers ──
function todayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' });
}

function parseTime(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function hoursUntil(timeStr: string): string {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Now';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;
}

// ── Loading skeleton ─────────────────────────────────────────────────────────
const skeletonCardStyle: CSSProperties = {
  padding: 16,
};
const skeletonLineStyle: CSSProperties = {
  width: '60%',
  height: 14,
  marginBottom: 10,
  borderRadius: 6,
};
const skeletonBlockStyle: CSSProperties = {
  width: '40%',
  borderRadius: 8,
};
const pageHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'rgba(13,15,20,0.95)',
  backdropFilter: 'blur(16px)',
  borderBottom: '1px solid var(--border-default)',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const iconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  position: 'relative',
};
const notificationBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: 'var(--status-critical)',
  font: '600 9px var(--font-mono)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1.5px solid var(--bg-base)',
};
const sectionCardStyle: CSSProperties = {
  padding: '32px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  textAlign: 'center',
};
const sectionIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function WidgetSkeleton({ height = 80 }: { height?: number }) {
  return (
    <div className="card" style={skeletonCardStyle}>
      <div className="skeleton" style={skeletonLineStyle} />
      <div className="skeleton" style={{ ...skeletonBlockStyle, height }} />
    </div>
  );
}

// ── Notification sheet ──────────────────────────────────────────────────────
function NotificationSheet({ onClose }: { onClose: () => void }) {
  const { notifications, markAllNotificationsRead, clearNotification } = useAppStore();

  const [now] = useState(() => Date.now());
  const visibleNotifications = useMemo(() => notifications.filter(n => {
    if (!n.read || !n.readAt) return true;
    const readTime = new Date(n.readAt).getTime();
    return now - readTime < 48 * 60 * 60 * 1000;
  }), [notifications, now]);

  return (
    <BottomSheet onClose={onClose} title="Notifications">
      <div style={{ paddingBottom: 20 }}>
        {visibleNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
            <Bell size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ font: '500 14px var(--font-body)', color: 'var(--text-secondary)' }}>No notifications yet</p>
          </div>
        ) : (
          <>
            <button
              onClick={markAllNotificationsRead}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                font: '500 12px var(--font-body)',
                color: 'var(--accent-primary)',
                padding: '0 0 12px',
                display: 'block',
              }}
            >
              Mark all as read
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleNotifications.map(n => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 14px',
                  background: n.read ? 'var(--bg-elevated)' : 'rgba(74,158,255,0.07)',
                  border: `1px solid ${n.read ? 'var(--border-default)' : 'rgba(74,158,255,0.2)'}`,
                  borderRadius: 'var(--radius-md)',
                }}>
                  {!n.read ? (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }} />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: '600 13px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</p>
                    <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
                    <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => clearNotification(n.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Critical banner ──────────────────────────────────────────────────────────
function CriticalBanner({ ann }: { ann: Announcement }) {
  const navigate = useNavigate();
  return (
    <div className="critical-banner" onClick={() => navigate('/app/announcements')}>
      <AlertTriangle size={18} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ font: '600 12px var(--font-mono)', color: 'var(--status-critical)', marginBottom: 3, letterSpacing: '0.04em' }}>
          ⚠ CRITICAL ALERT
        </p>
        <p className="truncate" style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)' }}>
          {ann.title}
        </p>
        <p className="truncate" style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)', marginTop: 2 }}>
          {timeAgo(ann.postedAt)}
        </p>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  );
}

import { getCategory, CATEGORY_COLORS } from '../../lib/scheduleUtils';

// ── Schedule widget ──────────────────────────────────────────────────────────
function ScheduleWidget() {
  const navigate = useNavigate();
  const key = todayKey();
  const { data: schedule, isLoading } = useSchedule({ day: key });
  const classes = useMemo(() => schedule?.[key] ?? [], [schedule, key]);
  const now = useMemo(() => new Date(), []);
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
              <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>You're all clear!</p>
              <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>No classes scheduled for today.</p>
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
                <span style={{ font: '600 13px var(--font-mono)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} className="text-muted" style={{ opacity: 0.6 }} />
                  {cls.startTime}
                </span>
                <span style={{ font: '500 10px var(--font-mono)', color: 'var(--text-muted)', marginTop: 2, paddingLeft: 15 }}>
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
                <p className="truncate" style={{ font: '600 14px var(--font-body)', color: 'var(--text-primary)', marginBottom: 2 }}>
                  {cls.subject}
                </p>
                <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)' }}>
                  {cls.code} · {cls.type || 'Lecture'}
                </p>
              </div>

              {/* Right Column: Badge Status */}
              <div style={{ flexShrink: 0 }}>
                {isNow ? (
                  <span className="badge badge-safe" style={{ 
                    background: 'rgba(52, 211, 153, 0.15)', 
                    color: 'var(--status-safe)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    font: '700 10px var(--font-mono)',
                    letterSpacing: '0.05em',
                  }}>● LIVE</span>
                ) : (
                  <span className="badge" style={{
                    background: catStyle.bg,
                    color: catStyle.color,
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    font: '600 10px var(--font-mono)',
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

// ── Attendance Widget (Trial Switcher) ──────────────────────────────────────
function AttendanceWidget() {
  const navigate = useNavigate();
  const { data: attendance, isLoading } = useAttendance();
  const [attendanceStyle, setAttendanceStyle] = useState<'ring' | 'bar'>(() => 
    (localStorage.getItem('classhub_attendance_style') as 'ring' | 'bar') || 'ring'
  );

  const subjects = useMemo(() => attendance?.subjects ?? [], [attendance]);
  const overall = useMemo(() => attendance?.overall ?? 0, [attendance]);

  const totalClasses = useMemo(() => subjects.reduce((sum, sub) => sum + sub.total, 0), [subjects]);
  const attendedClasses = useMemo(() => subjects.reduce((sum, sub) => sum + sub.present, 0), [subjects]);

  const overallTotal = totalClasses;
  const overallAttended = attendedClasses;
  const canSkipOverall = useMemo(() => overallTotal > 0 ? Math.max(0, Math.floor((overallAttended - 0.75 * overallTotal) / 0.75)) : 0, [overallTotal, overallAttended]);
  const needToAttendOverall = useMemo(() => overallTotal > 0 ? Math.max(0, Math.ceil((0.75 * overallTotal - overallAttended) / 0.25)) : 0, [overallTotal, overallAttended]);

  const handleStyleChange = (style: 'ring' | 'bar') => {
    setAttendanceStyle(style);
    localStorage.setItem('classhub_attendance_style', style);
  };

  const standing = useMemo(() => {
    const val = Math.round(overall);
    if (val >= 85) {
      return {
        label: 'Safe',
        color: 'var(--status-safe)',
        bg: 'rgba(52, 211, 153, 0.06)',
        desc: `You are safely above the 75% threshold. You can skip up to ${canSkipOverall} classes.`,
      };
    } else if (val >= 75) {
      return {
        label: 'Warning',
        color: 'var(--status-warning)',
        bg: 'rgba(251, 191, 36, 0.06)',
        desc: `Close to threshold! You can skip up to ${canSkipOverall} classes.`,
      };
    } else {
      return {
        label: 'Critical',
        color: 'var(--status-critical)',
        bg: 'rgba(248, 113, 113, 0.06)',
        desc: `Below 75%! You must attend at least ${needToAttendOverall} consecutive classes to recover.`,
      };
    }
  }, [overall, canSkipOverall, needToAttendOverall]);

  if (isLoading) return <WidgetSkeleton height={80} />;
  if (subjects.length === 0) return null;

  return (
    <section>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="section-title">Attendance</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="segment-switcher">
            <button
              onClick={() => handleStyleChange('ring')}
              className={`segment-btn ${attendanceStyle === 'ring' ? 'active' : ''}`}
            >
              Ring
            </button>
            <button
              onClick={() => handleStyleChange('bar')}
              className={`segment-btn ${attendanceStyle === 'bar' ? 'active' : ''}`}
            >
              Bar
            </button>
          </div>
          <button className="section-link" onClick={() => navigate('/app/attendance')} style={{ background: 'none', border: 'none', padding: 0 }}>
            Update →
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => navigate('/app/attendance')}>
        {attendanceStyle === 'ring' ? (
          /* Trial A: Circular Progress Ring */
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <DonutRing percentage={overall} size={84}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ font: '700 18px var(--font-display)', color: 'var(--text-primary)' }}>
                  {Math.round(overall)}%
                </span>
                <span style={{ font: '500 9px var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 1 }}>
                  Overall
                </span>
              </div>
            </DonutRing>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: '700 14px var(--font-display)', color: standing.color }}>
                  {standing.label} Standing
                </span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: standing.color }} />
              </div>
              <p style={{ font: '600 12px var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>
                {attendedClasses} / {totalClasses} classes attended
              </p>
              <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                {standing.desc}
              </p>
            </div>
          </div>
        ) : (
          /* Trial B: Horizontal Progress Bar */
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ font: '700 16px var(--font-display)', color: 'var(--text-primary)' }}>
                {Math.round(overall)}% Overall
              </span>
              <span style={{ font: '600 12px var(--font-mono)', color: 'var(--text-secondary)' }}>
                {attendedClasses} / {totalClasses} classes
              </span>
            </div>

            <div className="glass-progress-track" style={{ margin: '8px 0 12px 0' }}>
              <div 
                className="glass-progress-fill" 
                style={{ 
                  width: `${Math.min(100, Math.max(0, overall))}%`,
                  background: overall >= 75 
                    ? 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-safe) 100%)' 
                    : 'linear-gradient(90deg, var(--status-warning) 0%, var(--status-critical) 100%)'
                }} 
              />
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 8, 
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: standing.bg,
              border: `1px solid rgba(255,255,255,0.02)`,
            }}>
              <Activity size={14} color={standing.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {standing.desc}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Announcements scroll ─────────────────────────────────────────────────────
function AnnouncementsScroll() {
  const navigate = useNavigate();
  const { data: announcements = [], isLoading } = useAnnouncements({ limit: 12 });
  const visible = announcements.filter(a => !isExpired(a.deadline));

  if (isLoading) return <WidgetSkeleton />;

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Announcements</span>
        <button className="section-link" onClick={() => navigate('/app/announcements')}>View all →</button>
      </div>
      {visible.length === 0 ? (
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={24} color="var(--text-secondary)" />
          </div>
          <div>
            <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>No news is good news</p>
            <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>You're caught up on announcements.</p>
          </div>
        </div>
      ) : (
        <div className="carousel">
          {visible.slice(0, 5).map(ann => {
            const cls = deadlineBadgeClass(ann.deadline);
            const label = deadlineLabel(ann.deadline);
            const borderColor = cls === 'badge-critical' ? 'var(--status-critical)' : cls === 'badge-warning' ? 'var(--status-warning)' : cls === 'badge-safe' ? 'var(--status-safe)' : 'var(--status-info)';
            return (
              <div
                key={ann.id}
                className="card"
                style={{ minWidth: 160, maxWidth: 180, borderColor, cursor: 'pointer' }}
                onClick={() => navigate('/app/announcements')}
              >
                <div style={{ marginBottom: 8, width: 32, height: 32, borderRadius: 8, background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={16} color="var(--accent-primary)" />
                </div>
                <p style={{ font: '600 13px var(--font-body)', color: 'var(--text-primary)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ann.title}
                </p>
                {ann.deadline ? (
                  <span className={`badge ${cls}`}>{label}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Active Poll banner ───────────────────────────────────────────────────────
function PollBanner() {
  const navigate = useNavigate();
  const { data: polls = [] } = usePolls();
  const [now] = useState(() => Date.now());
  const poll = polls.find(p => p.status === 'active' && !isExpired(p.closesAt));
  if (!poll) return null;

  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const closes = new Date(poll.closesAt).getTime() - now;
  const closesD = Math.floor(closes / 86400000);
  const closesH = Math.floor((closes % 86400000) / 3600000);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Polls</span>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)' }}>
          Closes in {closesD}d {closesH}h
        </span>
      </div>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/polls')}>
        <p style={{ font: '600 14px var(--font-body)', color: 'var(--text-primary)', marginBottom: 14 }}>{poll.question}</p>
        {poll.options.slice(0, 2).map(opt => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          return (
            <div key={opt.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)' }}>{opt.text}</span>
                <span style={{ font: '600 12px var(--font-mono)', color: 'var(--accent-primary)' }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2, animation: 'barFill 0.8s ease both' }} />
              </div>
            </div>
          );
        })}
        <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)', marginTop: 12 }}>
          {total} students voted · <span style={{ color: 'var(--accent-primary)' }}>Go to Polls →</span>
        </p>
      </div>
    </section>
  );
}

// ── Assignments scroll ───────────────────────────────────────────────────────
function AssignmentsScroll() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useAssignments({ limit: 8 });
  const visible = assignments.filter(a => !isExpired(a.dueDate));

  if (isLoading) return <WidgetSkeleton />;

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Assignments</span>
        <button className="section-link" onClick={() => navigate('/app/assignments')}>View all →</button>
      </div>
      {visible.length === 0 ? (
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PartyPopper size={24} color="var(--status-safe)" />
          </div>
          <div>
            <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>All caught up!</p>
            <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>No active assignments right now.</p>
          </div>
        </div>
      ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visible.slice(0, 8).map(a => {
                const isSubmitted = a.status === 'submitted';
                const cls = isSubmitted ? 'badge-safe' : deadlineBadgeClass(a.dueDate);
                const label = isSubmitted ? 'Submitted' : deadlineLabel(a.dueDate);
                return (
                <div 
                  key={a.id} 
                  className="list-row" 
                  onClick={() => navigate('/app/assignments')} 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: 12 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 10, 
                      background: 'var(--accent-primary-glow)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {a.subject.includes('DBMS') ? <BookOpen size={16} color="var(--accent-primary)" /> : a.subject.includes('OS') ? <Cpu size={16} color="var(--status-safe)" /> : <BookMarked size={16} color="var(--status-warning)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ font: '600 13px var(--font-body)', color: 'var(--text-primary)', marginBottom: 2 }}>{a.title}</div>
                      <div className="truncate" style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)' }}>{a.subject}</div>
                    </div>
                  </div>
                  <span className={`badge ${cls}`} style={{ flexShrink: 0, font: '600 10px var(--font-mono)' }}>{label}</span>
                </div>
              );
            })}
            </div>
          </div>
      )}
    </section>
  );
}

// ── CR Dashboard Station ──
function CRDashboardStation() {
  const navigate = useNavigate();
  const { data: section } = useSection();

  return (
    <section style={{ animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
      <div className="section-header">
        <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px var(--font-mono)', color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
          <ShieldCheck size={13} /> CR COMMAND STATION
        </span>
      </div>
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.07) 0%, rgba(20, 23, 32, 0.85) 100%)',
        border: '1px solid rgba(74, 158, 255, 0.22)',
        boxShadow: 'var(--shadow-glow-blue)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ font: '700 16px var(--font-display)', color: 'var(--text-primary)', marginBottom: 0, letterSpacing: '-0.01em' }}>
              {section?.name || 'Section Hub'}
            </h3>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/app/cr-command')}
            style={{ 
              padding: '6px 12px', 
              minHeight: 'fit-content', 
              fontSize: 12, 
              borderColor: 'rgba(74, 158, 255, 0.3)',
              background: 'rgba(74, 158, 255, 0.05)',
            }}
          >
            Command Center →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button 
            onClick={() => navigate('/app/polls', { state: { openCreate: true } })}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            className="cr-station-btn btn-secondary"
          >
            <BarChart2 size={16} color="var(--status-info)" />
            <span style={{ font: '600 11px var(--font-body)', color: 'var(--text-primary)' }}>New Poll</span>
          </button>

          <button 
            onClick={() => navigate('/app/cr-command', { state: { openBroadcast: true } })}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            className="cr-station-btn btn-secondary"
          >
            <Megaphone size={16} color="var(--status-warning)" />
            <span style={{ font: '600 11px var(--font-body)', color: 'var(--text-primary)' }}>Broadcast</span>
          </button>

          <button 
            onClick={() => navigate('/app/assignments', { state: { openCreate: true } })}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            className="cr-station-btn btn-secondary"
          >
            <ClipboardList size={16} color="var(--status-safe)" />
            <span style={{ font: '600 11px var(--font-body)', color: 'var(--text-primary)' }}>Add Assign</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const authUser = useAppStore(s => s.authUser);
  const notifications = useAppStore(s => s.notifications);
  const role = useAppStore(s => s.role);
  const { data: announcements = [] } = useAnnouncements({ limit: 50 });
  const { data: assignments = [] } = useAssignments();
  const { data: attendance = { subjects: [], overall: 0 } } = useAttendance();
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();

  const firstName = (authUser?.name ?? 'Student').split(' ')[0];
  const unread = notifications.filter(n => !n.read).length;
  const critical = announcements.find(a => a.priority === 'critical' && !isExpired(a.deadline));

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={pageHeaderStyle}>
        <div>
          <p style={{ font: '500 12px var(--font-mono)', color: 'var(--accent-primary)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ClassHub
          </p>
          <h1 style={{ font: '700 24px var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Hey, {firstName} 👋
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            id="notification-btn"
            aria-label="Notifications"
            onClick={() => setShowNotifs(true)}
            style={iconButtonStyle}
          >
            <Bell size={20} />
            {unread > 0 && (
              <span style={notificationBadgeStyle}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button id="announcements-btn" aria-label="Announcements" onClick={() => navigate('/app/announcements')} style={iconButtonStyle}>
            <MessageSquare size={20} />
          </button>
        </div>
      </header>

      <main className="page-content">
        {critical ? <CriticalBanner ann={critical} /> : null}
        {role === 'cr' && <CRDashboardStation />}
        
        {/* Top status row: Attendance + Next assignment */}
        <div className="top-status-row" style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>
          {/* Custom Premium Attendance Status Card */}
          <div 
            style={{ 
              flex: 1, 
              minWidth: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => navigate('/app/attendance')}
          >
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: '50%', 
              background: 'rgba(96, 165, 250, 0.1)', 
              border: '1px solid rgba(96, 165, 250, 0.15)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0
            }}>
              <Percent size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 9px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Attendance</div>
              <div style={{ font: '700 16px var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {Math.round(attendance?.overall ?? 0)}%
              </div>
              <div style={{ 
                font: '600 10px var(--font-mono)', 
                color: (attendance?.overall ?? 0) >= 75 ? 'var(--status-safe)' : 'var(--status-critical)',
                marginTop: 2 
              }}>
                {(attendance?.subjects ?? []).reduce((sum, s) => sum + s.present, 0)}/{(attendance?.subjects ?? []).reduce((sum, s) => sum + s.total, 0)} classes
              </div>
            </div>
          </div>

          {/* Custom Premium Next Assignment Card */}
          <div 
            style={{ 
              flex: 1, 
              minWidth: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => navigate('/app/assignments')}
          >
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: '50%', 
              background: 'rgba(251, 191, 36, 0.1)', 
              border: '1px solid rgba(251, 191, 36, 0.15)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--status-warning)',
              flexShrink: 0
            }}>
              <Calendar size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 9px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Next Deadline</div>
              {(() => {
                const a = (assignments ?? []).filter((assignment) => !isExpired(assignment.dueDate))[0];
                if (a) {
                  return (
                    <>
                      <div className="truncate" style={{ font: '700 13px var(--font-body)', color: 'var(--text-primary)', lineHeight: 1.2 }} title={a.title}>
                        {a.title}
                      </div>
                      <span className={`badge ${deadlineBadgeClass(a.dueDate)}`} style={{ fontSize: 8, padding: '2px 5px', marginTop: 2, display: 'inline-block', font: '600 8px var(--font-mono)' }}>
                        {deadlineLabel(a.dueDate)}
                      </span>
                    </>
                  );
                }
                return (
                  <>
                    <div style={{ font: '700 13px var(--font-body)', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      All Clear
                    </div>
                    <div style={{ font: '500 9px var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                      No assignments
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <ScheduleWidget />
        <AttendanceWidget />
        <AnnouncementsScroll />
        <PollBanner />
        <AssignmentsScroll />
      </main>

      {showNotifs ? <NotificationSheet onClose={() => setShowNotifs(false)} /> : null}

      <NavBar />
    </div>
  );
}
