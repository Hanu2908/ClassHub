import { useState, useMemo, type CSSProperties, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, BarChart2, ClipboardList, CheckCircle2, ShieldAlert, Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { NavBar } from '../../components/NavBar';
import { timeUntil } from '../../components/Shared';
import { useAppStore, isExpired } from '../../store/appStore';
import { useAnnouncements, useAcknowledge } from '../../hooks/useAnnouncements';
import { useNotifications } from '../../hooks/useNotifications';
import { useAssignments } from '../../hooks/useAssignments';
import { usePolls } from '../../hooks/usePolls';
import { useAttendance } from '../../hooks/useAttendance';
import { useExams, useStudentExamPrep } from '../../hooks/useExams';
import { toast } from 'sonner';
import { isPushSupported, getPushPermission } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { generateGradient } from '../../lib/utils';
import { trackAppOpened } from '../../lib/analytics';


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
  fontSize: '9px',
  fontWeight: 'bold',
  fontFamily: 'var(--font-mono)',
  lineHeight: 1,
};



// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const authUser = useAppStore(s => s.authUser);

  const { notifications } = useNotifications();
  const role = useAppStore(s => s.role);
  const { data: announcements = [] } = useAnnouncements({ limit: 50, placeholder: true });
  const { data: assignments = [] } = useAssignments({ placeholder: true });
  const { data: attendance = { subjects: [], overall: 0, lastUpdated: null } } = useAttendance({ placeholder: true });
  const { data: polls = [] } = usePolls({ placeholder: true });

  // Fetch counsellor note for the student
  const { data: counsellorNote, refetch: refetchCounsellorNote } = useQuery({
    queryKey: ['student-counsellor-note', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id || role === 'teacher') return null;
      const { data, error } = await supabase
        .from('counsellor_notes')
        .select(`
          id, counsellor_id, note_text, student_response, student_response_updated_at, created_at,
          counsellor:counsellor_id (name)
        `)
        .eq('student_id', authUser.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || null;
    },
    enabled: !!authUser?.id && role !== 'teacher',
  });

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

  useEffect(() => {
    if (authUser?.id && authUser?.sectionId) {
      trackAppOpened(authUser.id, authUser.sectionId);
    }
  }, [authUser]);

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
      toast.success('Urgent post acknowledged ✓');
      const updated = [...dismissedAnnouncements, id];
      setDismissedAnnouncements(updated);
      sessionStorage.setItem('dismissed_critical_announcements', JSON.stringify(updated));
    } catch {
      toast.error('Failed to acknowledge');
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

  const [animatedPercent, setAnimatedPercent] = useState(0);
  const animatedPercentRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // 800ms
    const startVal = animatedPercentRef.current;
    const endVal = overallPercent;

    if (Math.abs(startVal - endVal) < 0.1) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const currentVal = startVal + easeProgress * (endVal - startVal);
      
      animatedPercentRef.current = currentVal;
      setAnimatedPercent(currentVal);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [overallPercent]);

  // Deadline progress bar animation
  const targetDeadlinePercent = useMemo(() => {
    if (shouldShowExam || !primaryDeadline) return 0;
    const dueDate = new Date(primaryDeadline.dueDate).getTime();
    /* eslint-disable-next-line react-hooks/purity */
    const now = Date.now();
    const diffMs = dueDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const horizonHours = 14 * 24;
    return Math.min(100, Math.max(0, Math.sqrt(diffHours / horizonHours) * 100));
  }, [shouldShowExam, primaryDeadline]);

  const [animatedDeadlinePercent, setAnimatedDeadlinePercent] = useState(0);
  const animatedDeadlinePercentRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // 800ms
    const startVal = animatedDeadlinePercentRef.current;
    const endVal = targetDeadlinePercent;

    if (Math.abs(startVal - endVal) < 0.1) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const currentVal = startVal + easeProgress * (endVal - startVal);
      
      animatedDeadlinePercentRef.current = currentVal;
      setAnimatedDeadlinePercent(currentVal);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [targetDeadlinePercent]);

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
        {counsellorNote && (
          <CounsellorAlertCard 
            note={counsellorNote} 
            refetch={refetchCounsellorNote} 
          />
        )}
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
                      {Math.round(animatedPercent)}%
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
                    width: `${Math.min(100, Math.max(0, animatedPercent))}%`, 
                    background: statusColor, 
                    borderRadius: 3,
                    boxShadow: `0 0 10px ${statusColor}40`
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
                        <div style={{ height: '100%', width: `${animatedDeadlinePercent}%`, background: barColor, boxShadow: `0 0 10px ${urgencyColor}40`, borderRadius: 1.5 }} />
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

interface CounsellorAlertCardProps {
  note: {
    id: string;
    counsellor_id: string;
    note_text: string;
    student_response: string | null;
    student_response_updated_at: string | null;
    created_at: string;
    counsellor: { name: string } | null;
  };
  refetch: () => void;
}

function CounsellorAlertCard({ note, refetch }: CounsellorAlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [response, setResponse] = useState(note.student_response || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setResponse(note.student_response || '');
  }, [note.student_response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim()) {
      toast.error('Response cannot be empty');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('counsellor_notes')
        .update({
          student_response: response.trim(),
        } as any)
        .eq('id', note.id);

      if (error) throw error;

      toast.success('Explanation submitted successfully! ✓');
      refetch();
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const counsellorName = note.counsellor?.name || 'Counsellor';
  const hasReplied = !!note.student_response;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            <ShieldAlert size={16} color="var(--status-warning)" />
          </div>
          <div>
            <h4 className="t-card-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Counsellor Remark Received
            </h4>
            <p className="t-caption" style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
              From {counsellorName} • {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: hasReplied ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            color: hasReplied ? 'var(--status-safe)' : 'var(--status-warning)',
            border: `1px solid ${hasReplied ? 'rgba(52, 211, 153, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
          }}>
            {hasReplied ? 'Responded' : 'Action Required'}
          </span>
          <button style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center'
          }}>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ 
          borderTop: '1px solid rgba(245, 158, 11, 0.15)', 
          paddingTop: 12, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 12 
        }}>
          <div style={{
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}>
            <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: 4 }}>
              Counsellor's Remark:
            </p>
            <p className="t-body" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {note.note_text}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: '10px', textTransform: 'uppercase' }}>
                Your Explanation / Response:
              </label>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Provide your explanation or response to the counsellor..."
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                {note.student_response_updated_at && `Last updated: ${new Date(note.student_response_updated_at).toLocaleString()}`}
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !response.trim() || response.trim() === note.student_response}
                className="btn-primary"
                style={{
                  width: 'auto',
                  minHeight: '32px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {hasReplied ? 'Update Response' : 'Submit Response'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

