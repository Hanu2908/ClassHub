import { useState, useMemo, type CSSProperties, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, BarChart2, ClipboardList, CheckCircle2 } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { timeUntil } from '../../components/Shared';
import { useAppStore, isExpired } from '../../store/appStore';
import { useAnnouncements, useAcknowledge } from '../../hooks/useAnnouncements';
import { useNotifications } from '../../hooks/useNotifications';
import { useAssignments } from '../../hooks/useAssignments';
import { usePolls } from '../../hooks/usePolls';
import { useAttendance } from '../../hooks/useAttendance';
import { useExams, useStudentExamPrep } from '../../hooks/useExams';
import { showToast } from '../../components/Toast';
import { isPushSupported, getPushPermission } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';


// Dashboard sub-components
import NotificationSheet from './dashboard/NotificationSheet';
import CriticalAlerts from './dashboard/CriticalAlerts';
import ScheduleWidget from './dashboard/ScheduleWidget';
import AnnouncementsScroll from './dashboard/AnnouncementsScroll';
import AssignmentsScroll from './dashboard/AssignmentsScroll';
import CRDashboardStation from './dashboard/CRDashboardStation';

// ── Shared style constants ──
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
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1.5px solid var(--bg-base)',
};



// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const authUser = useAppStore(s => s.authUser);

  const { notifications } = useNotifications();
  const role = useAppStore(s => s.role);
  const { data: announcements = [] } = useAnnouncements({ limit: 50 });
  const { data: assignments = [] } = useAssignments();
  const { data: attendance = { subjects: [], overall: 0, lastUpdated: null } } = useAttendance();
  const { data: polls = [] } = usePolls();

  const [showNotifs, setShowNotifs] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const navigate = useNavigate();
  const acknowledgeMutation = useAcknowledge();

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
      subject?: string;
    }> = [];

    (assignments ?? []).forEach(a => {
      if (a.status !== 'submitted' && !isExpired(a.dueDate)) {
        list.push({ id: a.id, title: a.title, type: 'assignment', dueDate: a.dueDate, route: '/app/assignments', icon: ClipboardList, subject: a.subject });
      }
    });

    (announcements ?? []).forEach(ann => {
      if (!ann.isAcknowledged && ann.deadline && !isExpired(ann.deadline)) {
        list.push({ id: ann.id, title: ann.title, type: 'announcement', dueDate: ann.deadline, route: '/app/announcements', icon: Megaphone });
      }
    });

    (polls ?? []).forEach(p => {
      const hasVoted = p.userVotes && p.userVotes.length > 0;
      if (p.status === 'active' && !hasVoted && !isExpired(p.closesAt)) {
        list.push({ id: p.id, title: p.question, type: 'poll', dueDate: p.closesAt, route: '/app/polls', icon: BarChart2 });
      }
    });

    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [assignments, announcements, polls]);

  const primaryDeadline = unifiedDeadlines[0] || null;

  // Session storage for dismissed critical announcements
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_critical_announcements') || '[]'); } catch { return []; }
  });

  // Push CTA state
  const [showPushCTA, setShowPushCTA] = useState(() => {
    if (!isPushSupported()) return false;
    if (sessionStorage.getItem('dismissed_push_cta') === 'true') return false;
    return !authUser?.notificationsEnabled || getPushPermission() !== 'granted';
  });

  useEffect(() => {
    if (authUser?.notificationsEnabled && getPushPermission() === 'granted') {
      setShowPushCTA(false);
    }
  }, [authUser?.notificationsEnabled]);

  const activeCritical = useMemo(() => {
    const dismissedSet = new Set(dismissedAnnouncements);
    return announcements.filter(
      (a) => a.priority === 'critical' && 
             a.expiresAt && 
             new Date(a.expiresAt) > new Date() && 
             !a.isAcknowledged &&
             !dismissedSet.has(a.id)
    );
  }, [announcements, dismissedAnnouncements]);

  const handleDismissAnnouncement = (id: string) => {
    const updated = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(updated);
    sessionStorage.setItem('dismissed_critical_announcements', JSON.stringify(updated));
  };

  const handleAcknowledgeAnnouncement = async (id: string) => {
    try {
      await acknowledgeMutation.mutateAsync(id);
      showToast('Urgent post acknowledged ✓', 'success');
      const updated = [...dismissedAnnouncements, id];
      setDismissedAnnouncements(updated);
      sessionStorage.setItem('dismissed_critical_announcements', JSON.stringify(updated));
    } catch {
      showToast('Failed to acknowledge', 'error');
    }
  };

  const handleDismissPushCTA = () => {
    setShowPushCTA(false);
    sessionStorage.setItem('dismissed_push_cta', 'true');
  };

  const firstName = (authUser?.name ?? 'Student').split(' ')[0];
  const unread = notifications.filter(n => !n.read).length;

  // ── Attendance Hero Data ──
  const { data: exams = [] } = useExams();

  const upcomingExams = useMemo(() => {
    /* eslint-disable-next-line react-hooks/purity */
    const now = Date.now();
    return exams
      .filter(e => {
        const [year, month, day] = e.examDate.split('-').map(Number);
        const timeStr = e.endTime || e.startTime;
        const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
        const examEnd = new Date(year, month - 1, day, hours, minutes, seconds);
        if (!e.endTime) {
          // Fallback to start time + 3 hours if end time is not provided
          examEnd.setHours(examEnd.getHours() + 3);
        }
        return examEnd.getTime() > now;
      })
      .sort((a, b) => {
        const [ay, am, ad] = a.examDate.split('-').map(Number);
        const [ahh, amm, ass = 0] = a.startTime.split(':').map(Number);
        const aStart = new Date(ay, am - 1, ad, ahh, amm, ass).getTime();

        const [by, bm, bd] = b.examDate.split('-').map(Number);
        const [bhh, bmm, bss = 0] = b.startTime.split(':').map(Number);
        const bStart = new Date(by, bm - 1, bd, bhh, bmm, bss).getTime();

        return aStart - bStart;
      });
  }, [exams]);

  const closestExam = upcomingExams[0] || null;

  const shouldShowExam = useMemo(() => {
    if (!closestExam) return false;
    if (!primaryDeadline) return true;
    
    const [ey, em, ed] = closestExam.examDate.split('-').map(Number);
    const [ehh, emm, ess = 0] = closestExam.startTime.split(':').map(Number);
    const examTime = new Date(ey, em - 1, ed, ehh, emm, ess).getTime();
    
    const deadlineTime = new Date(primaryDeadline.dueDate).getTime();
    return examTime < deadlineTime;
  }, [closestExam, primaryDeadline]);

  const overallPercent = attendance?.overall ?? 0;
  const isLowAttendance = overallPercent < 75;

  let statusLabel: string;
  let tierClass: string;
  let statusColor: string;
  if (overallPercent >= 90) { statusLabel = 'Zenith'; tierClass = 'attendance-zenith'; statusColor = 'var(--tier-color)'; }
  else if (overallPercent >= 80) { statusLabel = 'Gold'; tierClass = 'attendance-gold'; statusColor = 'var(--tier-color)'; }
  else if (overallPercent >= 75) { statusLabel = 'Silver'; tierClass = 'attendance-silver'; statusColor = 'var(--tier-color)'; }
  else { statusLabel = 'Warned'; tierClass = 'attendance-warned'; statusColor = 'var(--tier-color)'; }



  return (
    <div className="page-shell">
      {/* Header */}
      <header style={pageHeaderStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
              ClassHub
            </p>
          </div>
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
        </div>
      </header>

      <main className="page-content">
        <CriticalAlerts
          items={activeCritical}
          onDismiss={handleDismissAnnouncement}
          onAcknowledge={handleAcknowledgeAnnouncement}
          showPushCTA={showPushCTA}
          onDismissPushCTA={handleDismissPushCTA}
        />
        {role === 'cr' && <CRDashboardStation />}
        
        {/* Dynamic Academic Hero Banner */}
        <div className="academic-hero-container">
          {/* Left Panel: Attendance */}
          <div 
            className={`hero-panel-left clickable-hero-card ${tierClass}`} 
            onClick={() => navigate('/app/attendance')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/app/attendance');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', gap: 14 }}>
              {/* Top Row: Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div>
                  <div className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '10px', marginBottom: 2 }}>
                    Attendance
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="t-mono" style={{ 
                      fontSize: isMobile ? '34px' : '40px', 
                      fontWeight: 800, 
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.03em',
                      textShadow: `0 0 24px ${statusColor}33`,
                      lineHeight: 1
                    }}>
                      {Math.round(overallPercent)}%
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '10px', marginBottom: 6 }}>
                    Current standing
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="attendance-mobile-scale-dot" style={{ 
                      width: 8, height: 8, borderRadius: '50%', 
                      background: statusColor, 
                      boxShadow: `0 0 10px ${statusColor}`,
                      animation: isLowAttendance ? 'nowPulse 1s infinite alternate' : 'none'
                    }} />
                    <span className="t-card-title attendance-mobile-scale-title" style={{ color: statusColor, fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em', margin: 0 }}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Linear Progress Gauge */}
              <div style={{ position: 'relative', width: '100%', marginTop: 2 }}>
                {/* 75% Requirement Indicator Tick */}
                <div style={{ 
                  position: 'absolute', 
                  left: '75%', 
                  top: -8, 
                  height: 22, 
                  width: 1, 
                  background: 'rgba(255, 255, 255, 0.25)', 
                  zIndex: 2,
                  pointerEvents: 'none'
                }} />
                {/* 75% Requirement Label */}
                <div style={{ 
                  position: 'absolute', 
                  left: '75%', 
                  top: -16, 
                  transform: 'translateX(-50%)',
                  fontSize: '8px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  pointerEvents: 'none'
                }}>
                  75% REQ
                </div>

                <div style={{ 
                  height: 6, 
                  width: '100%', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: 3,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, Math.max(0, overallPercent))}%`, 
                    background: statusColor, 
                    borderRadius: 3,
                    boxShadow: `0 0 10px ${statusColor}40`,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Unified Deadline Hurdle & Quick Links */}
          <div className="hero-panel-right">
            {shouldShowExam && closestExam ? (
              <NextExamHeroCard exam={closestExam} navigate={navigate} />
            ) : primaryDeadline ? (
              (() => {
                const dueDate = new Date(primaryDeadline.dueDate).getTime();
                /* eslint-disable-next-line react-hooks/purity */
                const now = Date.now();
                const diffMs = dueDate - now;
                const diffHours = diffMs / (1000 * 60 * 60);

                let barColor: string;
                let urgencyColor: string;
                let pulseAnimation = 'none';

                if (diffHours <= 24) {
                  barColor = 'linear-gradient(90deg, var(--status-warning) 0%, var(--status-critical) 100%)';
                  urgencyColor = 'var(--status-critical)';
                  pulseAnimation = 'nowPulse 1.2s infinite alternate';
                } else if (diffHours <= 72) {
                  barColor = 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-warning) 100%)';
                  urgencyColor = 'var(--status-warning)';
                } else {
                  barColor = 'linear-gradient(90deg, #2563EB 0%, var(--accent-primary) 100%)';
                  urgencyColor = 'var(--accent-primary)';
                }

                // Continuous square-root decay curve anchored to a 14-day horizon (336 hours)
                const horizonHours = 14 * 24;
                const barPercent = Math.min(100, Math.max(0, Math.sqrt(diffHours / horizonHours) * 100));
                const PrimaryIcon = primaryDeadline.icon;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', width: '100%', gap: 14 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '11px' }}>
                          Next Deadline
                        </span>
                        <span
                          className="t-mono-sm"
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: urgencyColor,
                            animation: pulseAnimation
                          }}
                        >
                          {timeUntil(primaryDeadline.dueDate)}
                        </span>
                      </div>

                      <button className="t-card-title deadline-title-hover" 
                        onClick={() => navigate(primaryDeadline.route)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          textAlign: 'left', 
                          padding: 0, 
                          width: '100%', 
                          color: 'var(--text-primary)', 
                          lineHeight: 1.4, 
                          marginTop: 8, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8, 
                          transition: 'color 0.2s ease' 
                        }}
                      >
                        <PrimaryIcon size={16} style={{ color: urgencyColor, flexShrink: 0 }} />
                        <span style={{ 
                          display: '-webkit-box', 
                          WebkitLineClamp: 1, 
                          WebkitBoxOrient: 'vertical', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          fontWeight: 700,
                          fontSize: '15px',
                          color: 'var(--text-primary)'
                        }}>
                          {primaryDeadline.type === 'assignment' && primaryDeadline.subject 
                            ? `[${primaryDeadline.subject}] ${primaryDeadline.title}` 
                            : primaryDeadline.title
                          }
                        </span>
                      </button>
                    </div>

                    <div style={{ marginTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Type: <strong style={{ color: 'var(--text-secondary)' }}>{primaryDeadline.type}</strong>
                        </span>
                      </div>
                      <div style={{ height: 3, borderRadius: 1.5, border: 'none', background: 'rgba(255,255,255,0.03)', width: '100%', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barPercent}%`, background: barColor, boxShadow: `0 0 10px ${urgencyColor}40`, borderRadius: 1.5, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} color="var(--status-safe)" />
                  </div>
                </div>
                <div>
                  <h4 className="t-card-title" style={{ color: 'var(--status-safe)', letterSpacing: '-0.01em', marginBottom: 4 }}>You're All Clear!</h4>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    No pending assignments, active polls, or unacknowledged deadlines. Enjoy!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <ScheduleWidget />
        <AnnouncementsScroll />
        <AssignmentsScroll />

        {/* Footnote Report Link */}
        <div style={{ textAlign: 'center', padding: '24px 0 16px', opacity: 0.4 }}>
          <button
            onClick={() => setShowFeedbackSheet(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              font: '10px var(--font-mono)', color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}
          >
            [ REPORT BUG ]
          </button>
        </div>
      </main>

      <NotificationSheet open={showNotifs} onClose={() => setShowNotifs(false)} />

      <NavBar />
      <FeedbackSheet open={showFeedbackSheet} onClose={() => setShowFeedbackSheet(false)} />
    </div>
  );
}

// Helper to parse date (YYYY-MM-DD) and time (HH:mm:ss) in local timezone
function parseLocalCustomDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

// Harmonious gradient generator helper for subject avatars
function generateGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c1 = `hsl(${Math.abs(hash) % 360}, 85%, 60%)`;
  const c2 = `hsl(${Math.abs(hash * 2) % 360}, 85%, 50%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

// Next Exam Hero Card inner component with dynamic isolated 1-minute ticking countdown timer
function NextExamHeroCard({ exam, navigate }: { exam: any; navigate: (path: string) => void }) {
  const { data: prepData = [] } = useStudentExamPrep(exam.id);
  const [nowTime, setNowTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const countdownText = useMemo(() => {
    const examDateTime = parseLocalCustomDateTime(exam.examDate, exam.startTime).getTime();
    const diffMs = examDateTime - nowTime;
    if (diffMs <= 0) return 'Active';

    const diffMins = Math.floor(diffMs / 60000);
    const mins = diffMins % 60;
    const hours = Math.floor(diffMins / 60) % 24;
    const days = Math.floor(diffMins / 1440);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (days === 0 && mins > 0) parts.push(`${mins}m`);

    return parts.join(' ') || '1m';
  }, [exam, nowTime]);

  const preparedCount = prepData.filter(p => p.isPrepared).length;
  const totalUnits = exam.syllabusUnits?.length || 0;
  const progressPercent = totalUnits > 0 ? (preparedCount / totalUnits) * 100 : 0;
  const examGradient = generateGradient(exam.subjectCode);

  const examDateTime = parseLocalCustomDateTime(exam.examDate, exam.startTime).getTime();
  const diffMs = examDateTime - nowTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  const urgencyColor = diffHours <= 24 ? 'var(--status-critical)' : diffHours <= 72 ? 'var(--status-warning)' : 'var(--text-secondary)';
  const pulseAnimation = diffHours <= 24 ? 'nowPulse 1.2s infinite alternate' : 'none';

  return (
    <div
      onClick={() => navigate('/app/exams')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/app/exams');
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
        cursor: 'pointer',
        gap: 14
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '11px' }}>
            Next Exam
          </span>
          <span
            className="t-mono-sm"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: urgencyColor,
              animation: pulseAnimation
            }}
          >
            {countdownText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: examGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
            flexShrink: 0
          }}>
            <span className="t-mono" style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>
              {exam.subjectCode.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4 className="t-card-title truncate" style={{ color: 'var(--text-primary)', margin: 0, fontSize: 15, fontWeight: 700 }}>
              {exam.subjectName}
            </h4>
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {exam.examType} • {exam.subjectCode}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="t-caption" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Room <strong style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{exam.activeRoom || 'N/A'}</strong>
            {' '}•{' '}
            <span style={{ color: 'var(--text-muted)' }}>{preparedCount} of {totalUnits} units</span>
          </span>
        </div>

        {totalUnits > 0 && (
          <div style={{ height: 3, borderRadius: 1.5, border: 'none', background: 'rgba(255,255,255,0.03)', width: '100%', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-safe) 100%)',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
                borderRadius: 1.5,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

