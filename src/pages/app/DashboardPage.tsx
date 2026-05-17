import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, ChevronRight, AlertTriangle, Megaphone, BookOpen, Cpu, BookMarked, X } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { DonutRing, deadlineBadgeClass, deadlineLabel, timeAgo } from '../../components/Shared';
import { useAppStore, isExpired } from '../../store/appStore';
import { mockUser, mockHub } from '../../data/mockData';
import { BottomSheet } from '../../components/BottomSheet';

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

// ── Notification sheet ──────────────────────────────────────────────────────
function NotificationSheet({ onClose }: { onClose: () => void }) {
  const { notifications, markAllNotificationsRead, clearNotification } = useAppStore();

  const now = Date.now();
  const visibleNotifications = notifications.filter(n => {
    if (!n.read || !n.readAt) return true;
    const readTime = new Date(n.readAt).getTime();
    return now - readTime < 48 * 60 * 60 * 1000;
  });

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
                background: 'none', border: 'none', cursor: 'pointer',
                font: '500 12px var(--font-body)', color: 'var(--accent-primary)',
                padding: '0 0 12px', display: 'block',
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
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }} />
                  )}
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
function CriticalBanner({ ann }: { ann: any }) {
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

// ── Schedule widget ──────────────────────────────────────────────────────────
function ScheduleWidget() {
  const navigate = useNavigate();
  const schedule = useAppStore(s => s.schedule);
  const key = todayKey();
  const classes = schedule[key] ?? [];
  const now = new Date();

  const current = classes.find((c: any) => {
    const start = parseTime(c.startTime);
    const end = parseTime(c.endTime);
    return start <= now && now <= end;
  });

  const upcoming = classes
    .filter((c: any) => parseTime(c.startTime) > now)
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  const display: any[] = current ? [current, upcoming[0]].filter(Boolean) : upcoming.slice(0, 2);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Today's Schedule</span>
        <button className="section-link" onClick={() => navigate('/app/schedule')}>View all →</button>
      </div>
      <div className="card" style={{ padding: '4px 0' }}>
        {display.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', font: '400 14px var(--font-body)', color: 'var(--text-muted)' }}>
            No classes scheduled today 🎉
          </p>
        ) : display.map((cls: any, i: number) => {
          const isNow = current?.id === cls.id;
          return (
            <div key={cls.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderBottom: i < display.length - 1 ? '1px solid var(--border-default)' : 'none',
            }}>
              <div style={{
                width: 8, height: 8, flexShrink: 0,
                background: isNow ? 'var(--status-safe)' : 'var(--accent-primary)',
                boxShadow: isNow ? '0 0 8px var(--status-safe)' : undefined,
                animation: isNow ? 'nowPulse 2s ease-in-out infinite' : undefined,
                borderRadius: '50%',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="truncate" style={{ font: '600 14px var(--font-body)', color: 'var(--text-primary)', marginBottom: 2 }}>
                  {cls.subject}
                </p>
                <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-muted)' }}>
                  {cls.code} · {cls.room} · {cls.startTime}
                </p>
              </div>
              {isNow ? (
                <span className="badge badge-info" style={{ animation: 'nowPulse 2s ease-in-out infinite' }}>NOW</span>
              ) : (
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {hoursUntil(cls.startTime)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Attendance pills ─────────────────────────────────────────────────────────
function AttendancePills() {
  const navigate = useNavigate();
  const subjects = useAppStore(s => s.attendanceSubjects);
  const overall = useAppStore(s => s.attendanceOverall);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Attendance</span>
        <button className="section-link" onClick={() => navigate('/app/attendance')}>Update →</button>
      </div>
      <div className="carousel" style={{ paddingBottom: 8 }}>
        <div
          className="card"
          style={{ minWidth: 90, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => navigate('/app/attendance')}
        >
          <DonutRing percentage={overall} size={52}>
            <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-primary)' }}>
              {overall.toFixed(0)}%
            </span>
          </DonutRing>
          <p style={{ font: '400 10px var(--font-body)', color: 'var(--text-muted)', textAlign: 'center' }}>Overall</p>
        </div>
        {subjects.map(sub => (
          <div
            key={sub.code}
            className="card"
            style={{ minWidth: 90, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => navigate('/app/attendance')}
          >
            <DonutRing percentage={sub.percentage} size={52}>
              <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-primary)' }}>
                {sub.percentage.toFixed(0)}%
              </span>
            </DonutRing>
            <p className="truncate" style={{ font: '400 10px var(--font-body)', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 76 }}>
              {sub.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Announcements scroll ─────────────────────────────────────────────────────
function AnnouncementsScroll() {
  const navigate = useNavigate();
  const announcements = useAppStore(s => s.announcements);
  const visible = announcements.filter(a => !isExpired(a.deadline));

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Announcements</span>
        <button className="section-link" onClick={() => navigate('/app/announcements')}>View all →</button>
      </div>
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
              <span className={`badge ${cls}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Active Poll banner ───────────────────────────────────────────────────────
function PollBanner() {
  const navigate = useNavigate();
  const polls = useAppStore(s => s.polls);
  const poll = polls.find(p => p.status === 'active' && !isExpired(p.closesAt));
  if (!poll) return null;

  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const closes = new Date(poll.closesAt).getTime() - Date.now();
  const closesD = Math.floor(closes / 86400000);
  const closesH = Math.floor((closes % 86400000) / 3600000);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Campus Poll</span>
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
  const submissions = useAppStore(s => s.submissions);
  const assignments = useAppStore(s => s.assignments);
  const visible = assignments.filter(a => !isExpired(a.dueDate));

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Assignments</span>
        <button className="section-link" onClick={() => navigate('/app/assignments')}>View all →</button>
      </div>
      <div className="carousel">
        {visible.slice(0, 5).map(a => {
          const isSubmitted = !!submissions[a.id] || a.status === 'submitted';
          const cls = isSubmitted ? 'badge-safe' : deadlineBadgeClass(a.dueDate);
          const label = isSubmitted ? 'Submitted' : deadlineLabel(a.dueDate);
          return (
            <div
              key={a.id}
              className="card"
              style={{ minWidth: 150, maxWidth: 170, cursor: 'pointer' }}
              onClick={() => navigate('/app/assignments')}
            >
              <div style={{ fontSize: 24, marginBottom: 8, width: 36, height: 36, borderRadius: 10, background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a.subject.includes('DBMS') ? <BookOpen size={18} color="var(--accent-primary)" /> : a.subject.includes('OS') ? <Cpu size={18} color="var(--status-safe)" /> : <BookMarked size={18} color="var(--status-warning)" />}
              </div>
              <p style={{ font: '600 13px var(--font-body)', color: 'var(--text-primary)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {a.title}
              </p>
              <span className={`badge ${cls}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAppStore(s => s.user);
  const announcements = useAppStore(s => s.announcements);
  const notifications = useAppStore(s => s.notifications);
  const [showNotifs, setShowNotifs] = useState(false);
  const name = user?.name ?? mockUser.name;
  const firstName = name.split(' ')[0];
  const navigate = useNavigate();

  const unread = notifications.filter(n => !n.read).length;
  const critical = announcements.find(a => a.priority === 'critical' && !isExpired(a.deadline));

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,15,20,0.95)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-default)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-muted)' }}>{mockHub.hubCode} · {mockHub.section}</p>
          <h1 style={{ font: '700 22px var(--font-display)', color: 'var(--text-primary)' }}>
            Hey, {firstName} 👋
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Bell with unread badge */}
          <button
            id="notification-btn"
            aria-label="Notifications"
            onClick={() => setShowNotifs(true)}
            style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', position: 'relative' }}
          >
            <Bell size={20} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--status-critical)',
                font: '600 9px var(--font-mono)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--bg-base)',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button id="announcements-btn" aria-label="Announcements" onClick={() => navigate('/app/announcements')} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
            <MessageSquare size={20} />
          </button>
        </div>
      </header>

      <main className="page-content">
        {critical && <CriticalBanner ann={critical} />}
        <ScheduleWidget />
        <AttendancePills />
        <AnnouncementsScroll />
        <PollBanner />
        <AssignmentsScroll />
      </main>

      {showNotifs && <NotificationSheet onClose={() => setShowNotifs(false)} />}

      <NavBar />
    </div>
  );
}
