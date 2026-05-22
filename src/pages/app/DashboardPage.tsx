import { useState, useMemo, type CSSProperties, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, AlertTriangle, Megaphone, BookOpen, Cpu, BookMarked, X, Coffee, PartyPopper, BarChart2, ClipboardList, Activity, Clock, Paperclip } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { deadlineBadgeClass, deadlineLabel, timeAgo } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement, type ScheduleSlot } from '../../store/appStore';
import { BottomSheet } from '../../components/BottomSheet';
import { useSection, useAnnouncements, useAssignments, usePolls, useSchedule, useAttendance } from '../../hooks/useSupabaseQuery';
import { showToast } from '../../components/Toast';
import { isPushSupported, getPushPermission, subscribeToPush } from '../../lib/pushNotifications';


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

function getDynamicRingColor(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const hue = (clamped / 100) * 140;
  return `hsl(${hue}, 85%, 55%)`;
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
  background: 'var(--status-critical)',  color: '#fff',
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

  useEffect(() => {
    if (notifications.some(n => !n.read)) {
      markAllNotificationsRead();
    }
  }, [notifications, markAllNotificationsRead]);

  return (
    <BottomSheet onClose={onClose} title="Notifications">
      <div style={{ paddingBottom: 20 }}>
        {visibleNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
            <Bell size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p className="t-body-medium" style={{ color: 'var(--text-secondary)' }}>No notifications yet</p>
          </div>
        ) : (
          <>
            <button
              onClick={markAllNotificationsRead} className="t-label" style={{ background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                padding: '0 0 12px',
                display: 'block' }}
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
                    <p className="t-subtitle" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</p>
                    <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
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

// ── Premium Critical Alerts Carousel & Push CTA ──────────────────────────────
interface CriticalCarouselProps {
  items: Announcement[];
  onDismiss: (id: string) => void;
}

function CriticalCarousel({ items, onDismiss }: CriticalCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  // Safely bound activeIndex if items list shrinks dynamically during render
  const [prevItemsLength, setPrevItemsLength] = useState(items.length);
  if (items.length !== prevItemsLength) {
    setPrevItemsLength(items.length);
    if (activeIndex >= items.length) {
      setActiveIndex(Math.max(0, items.length - 1));
    }
  }

  if (items.length === 0) return null;

  const current = items[activeIndex];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <>
      <style>{`
        @keyframes pulsate-glow {
          0% {
            box-shadow: inset 0 0 8px rgba(239, 68, 68, 0.08), 0 0 4px rgba(239, 68, 68, 0.02);
          }
          100% {
            box-shadow: inset 0 0 15px rgba(239, 68, 68, 0.22), 0 0 10px rgba(239, 68, 68, 0.12);
          }
        }
        @keyframes pulsate-alert {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.08); opacity: 1; filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.45)); }
        }
        @keyframes pulse-bell {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-10deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(0deg); }
        }
        .dismiss-banner-btn:hover {
          background: rgba(239, 68, 68, 0.3) !important;
          transform: scale(1.1);
        }
        .dismiss-banner-btn:active {
          transform: scale(0.9);
        }
        .push-cta-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(74, 158, 255, 0.35);
        }
        .push-cta-btn:active {
          transform: translateY(1px);
        }
      `}</style>

      <div
        className="critical-carousel-container"
        style={{
          position: 'relative',
          margin: '12px 16px 4px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.07) 0%, rgba(13, 15, 20, 0.9) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.22)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 8px 0 rgba(239, 68, 68, 0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/app/announcements')}
      >
        {/* Pulsating glowing neon border overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-md)',
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 12px rgba(239, 68, 68, 0.12)',
            animation: 'pulsate-glow 4s infinite alternate',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <AlertTriangle
              size={20}
              color="var(--status-critical)"
              style={{
                flexShrink: 0,
                animation: 'pulsate-alert 4s infinite ease-in-out',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span
                className="t-badge" style={{ color: '#ef4444',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' }}
              >
                CRITICAL ALERT {items.length > 1 ? `(${activeIndex + 1}/${items.length})` : ''}
              </span>
            </div>
            <p
              className="truncate t-subtitle" style={{ color: 'var(--text-primary)',
                margin: 0,
                fontWeight: 600,
                letterSpacing: '-0.015em' }}
            >
              {current.title}
            </p>
            {current.body && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  marginTop: '4px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: 0.85
                }}
              >
                {current.body}
              </p>
            )}
            <p
              className="truncate t-mono-sm" style={{ color: 'var(--text-secondary)',
                marginTop: 4,
                margin: '4px 0 0' }}
            >
              {timeAgo(current.postedAt)}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {items.length > 1 && (
              <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handlePrev} className="t-subtitle" style={{ background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    cursor: 'pointer' }}
                >
                  ‹
                </button>
                <button
                  onClick={handleNext} className="t-subtitle" style={{ background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    cursor: 'pointer' }}
                >
                  ›
                </button>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(current.id);
              }}
              style={{
                background: 'rgba(255, 68, 68, 0.15)',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                borderRadius: '50%',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ef4444',
                transition: 'all 0.2s',
              }}
              title="Dismiss for this session"
              className="dismiss-banner-btn"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface PushPermissionCTAProps {
  onDismiss: () => void;
}

function PushPermissionCTA({ onDismiss }: PushPermissionCTAProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return isPushSupported() ? getPushPermission() : 'denied';
  });

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        setPermission('granted');
        showToast('Push notifications successfully enabled!', 'success');
        onDismiss();
      } else {
        showToast('Failed to enable push notifications', 'error');
        setPermission(isPushSupported() ? getPushPermission() : 'denied');
      }
    } catch (err) {
      console.error('[Push] CTA subscribe failed:', err);
      showToast('An error occurred while enabling push notifications', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div
      style={{
        margin: '12px 16px 4px',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.08) 0%, rgba(13, 15, 20, 0.75) 100%)',
        border: '1px solid rgba(74, 158, 255, 0.25)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25), 0 0 10px 0 rgba(74, 158, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.3s ease',
      }}
    >
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        title="Dismiss CTA"
      >
        <X size={15} />
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(74, 158, 255, 0.15)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Bell size={18} style={{ animation: 'pulse-bell 2.5s infinite ease-in-out' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            className="t-subtitle" style={{ color: 'var(--text-primary)',
              margin: '0 0 4px',
              letterSpacing: '-0.01em' }}
          >
            Enable Push Notifications
          </h3>
          <p
            className="t-caption" style={{ color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: '1.45' }}
          >
            {permission === 'denied'
              ? 'Real-time alerts are currently blocked. Please open your browser settings and allow notifications for ClassHub to get instant updates.'
              : 'Never miss an assignment deadline or critical CR announcement. Receive direct, secure nudge notifications in real-time!'}
          </p>
        </div>
      </div>

      {permission !== 'denied' && (
        <button
          onClick={handleEnablePush}
          disabled={isSubscribing} className="t-subtitle push-cta-btn" style={{ alignSelf: 'stretch',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(74, 158, 255, 0.25)' }}
        >
          {isSubscribing ? 'Enabling...' : 'Turn on Notifications'}
        </button>
      )}
    </div>
  );
}

import { getCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/scheduleUtils';

// ── Schedule widget ──────────────────────────────────────────────────────────
function ScheduleWidget() {
  const navigate = useNavigate();
  const key = todayKey();
  const { data: schedule, isLoading } = useSchedule();
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
                  <span className="badge t-badge" style={{ background: catStyle.bg,
                    color: catStyle.color,
                    borderColor: 'rgba(255, 255, 255, 0.05)' }}>
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
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>No news is good news</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>You're caught up on announcements.</p>
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
                <p className="t-button" style={{ color: 'var(--text-primary)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ann.title}
                </p>
                {ann.deadline ? (
                  <span className={`badge ${cls}`}>{label}</span>
                ) : null}
                {ann.attachments && ann.attachments.length > 0 && (
                  <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', width: 'fit-content', marginTop: 4 }}>
                    <Paperclip size={10} /> {ann.attachments.length}
                  </span>
                )}
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

  const closes = new Date(poll.closesAt).getTime() - now;
  const closesD = Math.floor(closes / 86400000);
  const closesH = Math.floor((closes % 86400000) / 3600000);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Polls</span>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
          Closes in {closesD}d {closesH}h
        </span>
      </div>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/polls')}>
        <p className="t-button" style={{ color: 'var(--text-primary)', marginBottom: 14 }}>{poll.question}</p>
        {poll.options.slice(0, 2).map(opt => {
          const pct = poll.voterCount && poll.voterCount > 0 ? Math.min(100, Math.round((opt.votes / poll.voterCount) * 100)) : 0;
          return (
            <div key={opt.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>{opt.text}</span>
                <span className="t-mono" style={{ color: 'var(--accent-primary)' }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2, animation: 'barFill 0.8s ease both' }} />
              </div>
            </div>
          );
        })}
        <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 12 }}>
          {poll.voterCount ?? 0} students voted · <span style={{ color: 'var(--accent-primary)' }}>Go to Polls →</span>
        </p>
      </div>
    </section>
  );
}

// ── Assignments scroll ───────────────────────────────────────────────────────
function AssignmentsScroll() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useAssignments({ limit: 8 });
  const visible = assignments
    .filter(a => !isExpired(a.dueDate) && a.status !== 'submitted')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 2);

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
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>All caught up!</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>No active assignments right now.</p>
          </div>
        </div>
      ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visible.map(a => {
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
                      <div className="truncate t-button" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{a.title}</div>
                      <div className="truncate t-mono-sm" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{a.subject}</span>
                        {a.attachments && a.attachments.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
                            · <Paperclip size={10} style={{ display: 'inline-block' }} /> {a.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${cls} t-badge`} style={{ flexShrink: 0 }}>{label}</span>
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
    <section style={{ animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both', margin: '4px 0 8px' }}>
      <div 
        className="glass-bento"
        style={{
          background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(20, 24, 38, 0.75) 100%)',
          border: '1px solid rgba(96, 165, 250, 0.25)',
          boxShadow: 'var(--shadow-glow-blue), 0 8px 32px rgba(0, 0, 0, 0.4)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className="badge badge-info t-badge" style={{ fontSize: 9, padding: '2px 8px', letterSpacing: '0.04em' }}>
                CR HUB
              </span>
            </div>
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 0, letterSpacing: '-0.015em' }}>
              {section?.name || 'Section Hub'}
            </h3>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/app/cr-command')}
            style={{ 
              padding: '6px 12px', 
              minHeight: 'fit-content', 
              fontSize: 11, 
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderColor: 'rgba(96, 165, 250, 0.35)',
              background: 'rgba(96, 165, 250, 0.08)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Open Command Center"
          >
            COMMAND CENTER →
          </button>
        </div>

        <div className="cr-command-grid">
          <button 
            onClick={() => navigate('/app/polls', { state: { openCreate: true } })}
            className="btn-tactile-cr glow-blue"
            aria-label="Create a new poll"
          >
            <BarChart2 size={18} color="var(--status-info)" style={{ filter: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.3))' }} />
            <span>New Poll</span>
          </button>

          <button 
            onClick={() => navigate('/app/cr-command', { state: { openBroadcast: true } })}
            className="btn-tactile-cr glow-amber"
            aria-label="Send a section broadcast notification"
          >
            <Megaphone size={18} color="var(--status-warning)" style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.3))' }} />
            <span>Broadcast</span>
          </button>

          <button 
            onClick={() => navigate('/app/announcements', { state: { openCreate: true } })}
            className="btn-tactile-cr glow-violet"
            aria-label="Post a new announcement"
          >
            <MessageSquare size={18} color="var(--status-announcement)" style={{ filter: 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.3))' }} />
            <span>Announce</span>
          </button>

          <button 
            onClick={() => navigate('/app/assignments', { state: { openCreate: true } })}
            className="btn-tactile-cr glow-emerald"
            aria-label="Create a new assignment"
          >
            <ClipboardList size={18} color="var(--status-safe)" style={{ filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.3))' }} />
            <span>Add Assign</span>
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
  const { data: polls = [] } = usePolls();
  const [showNotifs, setShowNotifs] = useState(false);
  const [isDiagnoseOpen, setIsDiagnoseOpen] = useState(false);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 440);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 440);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Unified Deadlines Aggregation ──
  const unifiedDeadlines = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: 'assignment' | 'announcement' | 'poll';
      dueDate: string;
      route: string;
      icon: typeof ClipboardList;
    }> = [];

    // 1. Assignments
    (assignments ?? []).forEach(a => {
      if (a.status !== 'submitted' && !isExpired(a.dueDate)) {
        list.push({
          id: a.id,
          title: a.title,
          type: 'assignment',
          dueDate: a.dueDate,
          route: '/app/assignments',
          icon: ClipboardList,
        });
      }
    });

    // 2. Announcements
    (announcements ?? []).forEach(ann => {
      if (!ann.isAcknowledged && ann.deadline && !isExpired(ann.deadline)) {
        list.push({
          id: ann.id,
          title: ann.title,
          type: 'announcement',
          dueDate: ann.deadline,
          route: '/app/announcements',
          icon: Megaphone,
        });
      }
    });

    // 3. Polls
    (polls ?? []).forEach(p => {
      const hasVoted = p.userVotes && p.userVotes.length > 0;
      if (p.status === 'active' && !hasVoted && !isExpired(p.closesAt)) {
        list.push({
          id: p.id,
          title: p.question,
          type: 'poll',
          dueDate: p.closesAt,
          route: '/app/polls',
          icon: BarChart2,
        });
      }
    });

    // Sort chronologically (closest first)
    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [assignments, announcements, polls]);

  const primaryDeadline = unifiedDeadlines[0] || null;

  // Counts of outstanding items for quick jump links
  const outstandingCounts = useMemo(() => {
    return {
      assignments: (assignments ?? []).filter(a => a.status !== 'submitted' && !isExpired(a.dueDate)).length,
      announcements: (announcements ?? []).filter(ann => !ann.isAcknowledged && ann.deadline && !isExpired(ann.deadline)).length,
      polls: (polls ?? []).filter(p => p.status === 'active' && (!p.userVotes || p.userVotes.length === 0) && !isExpired(p.closesAt)).length,
    };
  }, [assignments, announcements, polls]);

  // Session storage for dismissed critical announcements
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('dismissed_critical_announcements') || '[]');
    } catch {
      return [];
    }
  });

  // Push CTA state with session/local dismissal storage
  const [showPushCTA, setShowPushCTA] = useState(() => {
    if (!isPushSupported()) return false;
    if (sessionStorage.getItem('dismissed_push_cta') === 'true') return false;
    return getPushPermission() !== 'granted';
  });

  const activeCritical = useMemo(() => {
    const dismissedSet = new Set(dismissedAnnouncements);
    return announcements.filter(
      (a) => a.priority === 'critical' && !isExpired(a.deadline) && !dismissedSet.has(a.id)
    );
  }, [announcements, dismissedAnnouncements]);

  const handleDismissAnnouncement = (id: string) => {
    const updated = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(updated);
    sessionStorage.setItem('dismissed_critical_announcements', JSON.stringify(updated));
  };

  const handleDismissPushCTA = () => {
    setShowPushCTA(false);
    sessionStorage.setItem('dismissed_push_cta', 'true');
  };

  const firstName = (authUser?.name ?? 'Student').split(' ')[0];
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={pageHeaderStyle}>
        <div>
          <p className="t-mono" style={{ color: 'var(--accent-primary)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ClassHub
          </p>
          <h1 className="t-feature" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
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
        {activeCritical.length > 0 && (
          <CriticalCarousel items={activeCritical} onDismiss={handleDismissAnnouncement} />
        )}
        {showPushCTA && (
          <PushPermissionCTA onDismiss={handleDismissPushCTA} />
        )}
        {role === 'cr' && <CRDashboardStation />}
        
        {/* Dynamic Academic Hero Banner */}
        <div className="academic-hero-container">
          {/* Left Panel: Dynamic Threshold-Aware Attendance */}
          {(() => {
            const overallPercent = attendance?.overall ?? 0;
            const subjectsList = attendance?.subjects ?? [];
            const overallTotal = subjectsList.reduce((sum, s) => sum + s.total, 0);
            const overallAttended = subjectsList.reduce((sum, s) => sum + s.present, 0);

            const canSkipOverall = overallTotal > 0 ? Math.max(0, Math.floor((overallAttended - 0.75 * overallTotal) / 0.75)) : 0;
            const needToAttendOverall = overallTotal > 0 ? Math.max(0, Math.ceil((0.75 * overallTotal - overallAttended) / 0.25)) : 0;

            const isLowAttendance = overallPercent < 75;

            let statusLabel: string;
            if (overallPercent >= 85) {
              statusLabel = 'Elite';
            } else if (overallPercent >= 75) {
              statusLabel = 'Safe';
            } else if (overallPercent >= 65) {
              statusLabel = 'Warning';
            } else {
              statusLabel = 'Critical';
            }

            const clamped = Math.min(100, Math.max(0, overallPercent));
            const dynamicHue = (clamped / 100) * 140; // 0% is red, 50% is orange-yellow, 100% is emerald green
            const statusColor = getDynamicRingColor(overallPercent);
            const dynamicBgColor = `hsla(${dynamicHue}, 85%, 55%, 0.04)`;
            const dynamicBorderColor = `hsla(${dynamicHue}, 85%, 55%, 0.18)`;
            const glowColor = `hsla(${dynamicHue}, 85%, 55%, 0.15)`;
            const cardBg = `linear-gradient(135deg, ${dynamicBgColor} 0%, rgba(13, 15, 20, 0.4) 100%)`;
            const borderColor = dynamicBorderColor;

            return (
              <div 
                className="hero-panel-left clickable-hero-card" 
                onClick={() => navigate('/app/attendance')}
                style={{ 
                  background: cardBg,
                  borderColor: borderColor,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 12px ${glowColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Attendance Indicator */}
                    {!isLowAttendance ? (
                      /* Circular progress for Safe/Elite */
                      <div style={{ position: 'relative', width: isMobile ? 68 : 72, height: isMobile ? 68 : 72, flexShrink: 0 }}>
                        <svg width={isMobile ? 68 : 72} height={isMobile ? 68 : 72} viewBox={isMobile ? "0 0 68 68" : "0 0 72 72"} style={{ filter: `drop-shadow(0 0 ${isMobile ? 6 : 4}px hsla(${dynamicHue}, 85%, 55%, 0.3))` }}>
                          <circle cx={isMobile ? 34 : 36} cy={isMobile ? 34 : 36} r={isMobile ? 28 : 30} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={5} />
                          <circle 
                            cx={isMobile ? 34 : 36} 
                            cy={isMobile ? 34 : 36} 
                            r={isMobile ? 28 : 30} 
                            fill="none" 
                            stroke={statusColor} 
                            strokeWidth={5} 
                            strokeDasharray={isMobile ? "175.93" : "188.50"} 
                            strokeDashoffset={(isMobile ? 175.93 : 188.50) - ((isMobile ? 175.93 : 188.50) * Math.min(100, Math.max(0, overallPercent))) / 100}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${isMobile ? 34 : 36} ${isMobile ? 34 : 36})`}
                            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                          />
                        </svg>
                        <div className="t-mono" style={{ 
                          position: 'absolute', 
                          inset: 0, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'var(--text-primary)',
                          fontSize: '16px',
                          fontWeight: 700,
                        }}>
                          {Math.round(overallPercent)}%
                        </div>
                      </div>
                    ) : (
                      /* High Urgency Glowing Warning Ring for Critical/Warning */
                      <div style={{ position: 'relative', width: isMobile ? 68 : 72, height: isMobile ? 68 : 72, flexShrink: 0 }}>
                        <svg width={isMobile ? 68 : 72} height={isMobile ? 68 : 72} viewBox={isMobile ? "0 0 68 68" : "0 0 72 72"} className="animate-pulse" style={{ filter: `drop-shadow(0 0 ${isMobile ? 10 : 8}px hsla(${dynamicHue}, 85%, 55%, 0.7))` }}>
                          <circle cx={isMobile ? 34 : 36} cy={isMobile ? 34 : 36} r={isMobile ? 28 : 30} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={5} />
                          <circle 
                            cx={isMobile ? 34 : 36} 
                            cy={isMobile ? 34 : 36} 
                            r={isMobile ? 28 : 30} 
                            fill="none" 
                            stroke={statusColor} 
                            strokeWidth={5} 
                            strokeDasharray={isMobile ? "175.93" : "188.50"} 
                            strokeDashoffset={(isMobile ? 175.93 : 188.50) - ((isMobile ? 175.93 : 188.50) * Math.min(100, Math.max(0, overallPercent))) / 100}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${isMobile ? 34 : 36} ${isMobile ? 34 : 36})`}
                          />
                        </svg>
                        <div className="t-mono" style={{ 
                          position: 'absolute', 
                          inset: 0, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: statusColor,
                          fontSize: '16px',
                          fontWeight: 700,
                          animation: 'nowPulse 1s infinite alternate'
                        }}>
                          {Math.round(overallPercent)}%
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Attendance</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span className="t-card-title attendance-mobile-scale-title" style={{ color: statusColor }}>
                          {statusLabel} Standing
                        </span>
                        <span className="attendance-mobile-scale-dot" style={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          background: statusColor, 
                          boxShadow: `0 0 10px ${statusColor}`,
                          animation: isLowAttendance ? 'nowPulse 1s infinite alternate' : 'none'
                        }} />
                      </div>
                    </div>
                  </div>

                  <div 
                    className="hero-arrow-btn"
                    aria-hidden="true"
                  >
                    <Activity size={14} />
                  </div>
                </div>

                <div style={{ marginTop: 14, width: '100%' }}>
                  <div className="t-mono" style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {overallAttended} <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>/ {overallTotal} classes attended</span>
                  </div>
                  
                  <div className="t-caption" style={{                     color: isLowAttendance ? 'var(--status-critical)' : 'var(--text-secondary)', 
                    marginTop: 8, 
                    lineHeight: 1.4,
                    borderLeft: `3px solid ${statusColor}`,
                    paddingLeft: '10px'
                  }}>
                    {isLowAttendance 
                      ? `Alert: You must attend at least ${needToAttendOverall} consecutive classes to recover 75% standing.`
                      : `Status clear! You can skip up to ${canSkipOverall} classes without dropping below 75%.`}
                  </div>
                </div>

                {/* Advisor Diagnostics Accordion (Warning/Critical states) */}
                {isLowAttendance && subjectsList.length > 0 && (
                  <div style={{ marginTop: 12, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDiagnoseOpen(!isDiagnoseOpen);
                      }}
                      className="diagnose-toggle-btn t-badge"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>{isDiagnoseOpen ? 'CLOSE DIAGNOSTICS ▲' : 'DIAGNOSE ISSUES ▼'}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {subjectsList.filter(s => s.percentage < 75).length} Warning Courses
                      </span>
                    </button>

                    {isDiagnoseOpen && (
                      <div className="diagnose-list animate-fade-in" style={{
                        marginTop: 8,
                        background: 'rgba(13, 15, 20, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        maxHeight: 120,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}>
                        {subjectsList.map((sub) => {
                          const isSubLow = sub.percentage < 75;
                          const subColor = isSubLow 
                            ? (sub.percentage < 65 ? 'var(--status-critical)' : 'var(--status-warning)') 
                            : 'var(--status-safe)';
                          return (
                            <div key={sub.code} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '4px 0',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                            }}>
                              <span className="truncate t-label" style={{ color: 'var(--text-primary)', maxWidth: '60%' }}>
                                {sub.name}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="t-helper" style={{ color: 'var(--text-muted)' }}>
                                  {sub.present}/{sub.total}
                                </span>
                                <span className="t-badge" style={{ color: subColor }}>
                                  {Math.round(sub.percentage)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Right Panel: Unified Deadline Hurdle & Quick Links */}
          <div className="hero-panel-right">
            {primaryDeadline ? (
              (() => {
                const dueDate = new Date(primaryDeadline.dueDate).getTime();
                /* eslint-disable-next-line react-hooks/purity */
                const now = Date.now();
                const diffMs = dueDate - now;
                const diffHours = diffMs / (1000 * 60 * 60);

                // Urgency level styles
                let barColor: string;
                let urgencyColor: string;
                let statusLabel: string;
                let pulseAnimation = 'none';

                if (diffHours <= 24) {
                  barColor = 'linear-gradient(90deg, var(--status-warning) 0%, var(--status-critical) 100%)';
                  urgencyColor = 'var(--status-critical)';
                  statusLabel = 'Due Soon';
                  pulseAnimation = 'nowPulse 1.2s infinite alternate';
                } else if (diffHours <= 72) {
                  barColor = 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-warning) 100%)';
                  urgencyColor = 'var(--status-warning)';
                  statusLabel = 'Approaching';
                } else {
                  barColor = 'linear-gradient(90deg, #2563EB 0%, var(--accent-primary) 100%)';
                  urgencyColor = 'var(--accent-primary)';
                  statusLabel = 'Upcoming';
                }

                // Calculate progress bar percentage (capped up to 7 days countdown)
                const barPercent = Math.min(100, Math.max(0, (diffHours / 168) * 100));
                const PrimaryIcon = primaryDeadline.icon;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Next Deadline
                        </span>
                        
                        {/* Type Badge */}
                        <span className={`badge ${primaryDeadline.type === 'assignment' ? 'badge-safe' : primaryDeadline.type === 'poll' ? 'badge-info' : 'badge-critical'} t-badge`} style={{ fontSize: 9, padding: '2px 6px', textTransform: 'uppercase' }}>
                          {primaryDeadline.type}
                        </span>
                      </div>

                      <div className="t-card-title deadline-title-hover" 
                        onClick={() => navigate(primaryDeadline.route)}
                        style={{ 
                          color: 'var(--text-primary)', 
                          lineHeight: 1.4,
                          marginTop: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          transition: 'color 0.2s ease',
                        }}
                      >
                        <PrimaryIcon size={16} style={{ color: urgencyColor, flexShrink: 0, marginTop: 3 }} />
                        <span style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textWrap: 'balance'
                        }}>
                          {primaryDeadline.title}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      {/* Urgency Progress Bar */}
                      <div className="glass-progress-track" style={{ height: 5, borderRadius: 2.5, margin: '6px 0 8px 0', border: 'none', background: 'rgba(255,255,255,0.03)' }}>
                        <div 
                          className="glass-progress-fill" 
                          style={{ 
                            width: `${barPercent}%`, 
                            background: barColor, 
                            boxShadow: `0 0 10px ${urgencyColor}30`,
                            borderRadius: 2.5
                          }} 
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span 
                          className={`badge ${deadlineBadgeClass(primaryDeadline.dueDate)} t-badge`} style={{ fontSize: 9, padding: '2px 8px', animation: pulseAnimation }}
                        >
                          {deadlineLabel(primaryDeadline.dueDate)}
                        </span>
                        <span className="t-badge" style={{ color: urgencyColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Hurdle Jump Shortcuts Panel */}
                    <div style={{ 
                      marginTop: 16, 
                      paddingTop: 10, 
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%'
                    }}>
                      <span className="t-badge" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Jump Center
                      </span>

                      <div style={{ display: 'flex', gap: 10 }}>
                        {outstandingCounts.assignments > 0 && (
                          <button 
                            onClick={() => navigate('/app/assignments')}
                            className="hurdle-shortcut-btn glow-emerald"
                            title={`${outstandingCounts.assignments} pending assignments`}
                            style={{ position: 'relative' }}
                          >
                            <ClipboardList size={13} />
                            <span className="shortcut-badge">{outstandingCounts.assignments}</span>
                          </button>
                        )}

                        {outstandingCounts.announcements > 0 && (
                          <button 
                            onClick={() => navigate('/app/announcements')}
                            className="hurdle-shortcut-btn glow-violet"
                            title={`${outstandingCounts.announcements} unread announcements`}
                            style={{ position: 'relative' }}
                          >
                            <Megaphone size={13} />
                            <span className="shortcut-badge">{outstandingCounts.announcements}</span>
                          </button>
                        )}

                        {outstandingCounts.polls > 0 && (
                          <button 
                            onClick={() => navigate('/app/polls')}
                            className="hurdle-shortcut-btn glow-blue"
                            title={`${outstandingCounts.polls} unanswered polls`}
                            style={{ position: 'relative' }}
                          >
                            <BarChart2 size={13} />
                            <span className="shortcut-badge">{outstandingCounts.polls}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* All Clear Screen */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: '50%', 
                    background: 'var(--status-safe-bg)', 
                    border: '1px solid rgba(52,201,123,0.15)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                  }}>
                    <PartyPopper size={20} color="var(--status-safe)" className="animate-float-slow" />
                  </div>
                </div>

                <div>
                  <h4 className="t-card-title" style={{ color: 'var(--status-safe)', letterSpacing: '-0.01em', marginBottom: 4 }}>
                    You're All Clear!
                  </h4>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    No pending assignments, active polls, or unacknowledged deadlines. Enjoy!
                  </p>
                </div>

                {/* Empty State Jump Shortcuts panel */}
                <div style={{ 
                  marginTop: 10, 
                  paddingTop: 10, 
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
                  <span className="t-badge" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Jump Center
                  </span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate('/app/assignments')} className="hurdle-shortcut-btn" title="Assignments"><ClipboardList size={13} /></button>
                    <button onClick={() => navigate('/app/announcements')} className="hurdle-shortcut-btn" title="Announcements"><Megaphone size={13} /></button>
                    <button onClick={() => navigate('/app/polls')} className="hurdle-shortcut-btn" title="Polls"><BarChart2 size={13} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <ScheduleWidget />
        <AnnouncementsScroll />
        <PollBanner />
        <AssignmentsScroll />
      </main>

      {showNotifs ? <NotificationSheet onClose={() => setShowNotifs(false)} /> : null}

      <NavBar />
    </div>
  );
}
