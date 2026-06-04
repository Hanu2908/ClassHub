import { useState, useMemo, type CSSProperties, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, BarChart2, ClipboardList, Activity, PartyPopper, AlertTriangle, Award } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
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
import { useQueryClient } from '@tanstack/react-query';


// Dashboard sub-components
import NotificationSheet from './dashboard/NotificationSheet';
import CriticalAlerts from './dashboard/CriticalAlerts';
import ScheduleWidget from './dashboard/ScheduleWidget';
import AnnouncementsScroll from './dashboard/AnnouncementsScroll';
import PollBanner from './dashboard/PollBanner';
import AssignmentsScroll from './dashboard/AssignmentsScroll';
import CRDashboardStation from './dashboard/CRDashboardStation';
import { prefetchAnnouncementsData } from './dashboard/prefetchHelper';

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
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const { notifications } = useNotifications();
  const role = useAppStore(s => s.role);
  const { data: announcements = [] } = useAnnouncements({ limit: 50 });
  const { data: assignments = [] } = useAssignments();
  const { data: attendance = { subjects: [], overall: 0, lastUpdated: null } } = useAttendance();
  const { data: polls = [] } = usePolls();

  const lastUpdated = attendance?.lastUpdated;
  const isSyncOverdue = useMemo(() => {
    if (!lastUpdated) return true; // never synced is overdue
    /* eslint-disable-next-line react-hooks/purity */
    const diffTime = Date.now() - new Date(lastUpdated).getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 3;
  }, [lastUpdated]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isDiagnoseOpen, setIsDiagnoseOpen] = useState(false);
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

  const outstandingCounts = useMemo(() => ({
    assignments: (assignments ?? []).filter(a => a.status !== 'submitted' && !isExpired(a.dueDate)).length,
    announcements: (announcements ?? []).filter(ann => !ann.isAcknowledged && ann.deadline && !isExpired(ann.deadline)).length,
    polls: (polls ?? []).filter(p => p.status === 'active' && (!p.userVotes || p.userVotes.length === 0) && !isExpired(p.closesAt)).length,
  }), [assignments, announcements, polls]);

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
    const todayStr = new Date().toISOString().split('T')[0];
    return exams
      .filter(e => e.examDate >= todayStr)
      .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  }, [exams]);

  const closestExam = upcomingExams[0] || null;

  const isExamSoon = useMemo(() => {
    if (!closestExam) return false;
    const diffTime = new Date(closestExam.examDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }, [closestExam]);

  const overallPercent = attendance?.overall ?? 0;
  const subjectsList = attendance?.subjects ?? [];
  const overallTotal = subjectsList.reduce((sum, s) => sum + s.total, 0);
  const overallAttended = subjectsList.reduce((sum, s) => sum + s.present, 0);
  const canSkipOverall = overallTotal > 0 ? Math.max(0, Math.floor((overallAttended - 0.75 * overallTotal) / 0.75)) : 0;
  const needToAttendOverall = overallTotal > 0 ? Math.max(0, Math.ceil((0.75 * overallTotal - overallAttended) / 0.25)) : 0;
  const isLowAttendance = overallPercent < 75;

  let statusLabel: string;
  let tierClass: string;
  let statusColor: string;
  if (overallPercent >= 90) { statusLabel = 'Zenith'; tierClass = 'attendance-zenith'; statusColor = 'var(--tier-color)'; }
  else if (overallPercent >= 80) { statusLabel = 'Gold'; tierClass = 'attendance-gold'; statusColor = 'var(--tier-color)'; }
  else if (overallPercent >= 75) { statusLabel = 'Silver'; tierClass = 'attendance-silver'; statusColor = 'var(--tier-color)'; }
  else { statusLabel = 'Warned'; tierClass = 'attendance-warned'; statusColor = 'var(--tier-color)'; }

  const cardBg = `linear-gradient(135deg, var(--tier-bg-glow) 0%, rgba(13, 15, 20, 0.4) 100%)`;
  const borderColor = `var(--tier-border)`;
  const glowColor = `var(--tier-shadow)`;

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={pageHeaderStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
              ClassHub
            </p>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.04em' }}>
              BETA
            </span>
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
          <button id="polls-btn" aria-label="Polls" onClick={() => navigate('/app/polls')} style={iconButtonStyle}>
            <BarChart2 size={20} />
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
            style={{ 
              background: cardBg,
              borderColor: borderColor,
              boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 12px ${glowColor}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Circular progress */}
                <div style={{ position: 'relative', width: isMobile ? 68 : 72, height: isMobile ? 68 : 72, flexShrink: 0 }}>
                  <svg width={isMobile ? 68 : 72} height={isMobile ? 68 : 72} viewBox={isMobile ? "0 0 68 68" : "0 0 72 72"} className={isLowAttendance ? 'animate-pulse' : undefined} style={{ filter: `drop-shadow(0 0 ${isLowAttendance ? (isMobile ? 10 : 8) : (isMobile ? 6 : 4)}px var(--tier-border))` }}>
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
                    color: isLowAttendance ? statusColor : 'var(--text-primary)',
                    fontSize: '16px',
                    fontWeight: 700,
                    animation: isLowAttendance ? 'nowPulse 1s infinite alternate' : undefined,
                  }}>
                    {Math.round(overallPercent)}%
                  </div>
                </div>

                <div>
                  <div className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Attendance</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span className="t-card-title attendance-mobile-scale-title" style={{ color: statusColor }}>
                      {statusLabel} Standing
                    </span>
                    <span className="attendance-mobile-scale-dot" style={{ 
                      width: 6, height: 6, borderRadius: '50%', 
                      background: statusColor, 
                      boxShadow: `0 0 10px ${statusColor}`,
                      animation: isLowAttendance ? 'nowPulse 1s infinite alternate' : 'none'
                    }} />
                  </div>
                </div>
              </div>

              <div className="hero-arrow-btn" aria-hidden="true">
                <Activity size={14} />
              </div>
            </div>

            <div style={{ marginTop: 14, width: '100%' }}>
              <div className="t-mono" style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {overallAttended} <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>/ {overallTotal} classes attended</span>
              </div>
              
              <div className="t-caption" style={{ 
                color: isLowAttendance ? 'var(--status-critical)' : 'var(--text-secondary)', 
                marginTop: 8, lineHeight: 1.4,
                borderLeft: `3px solid ${statusColor}`,
                paddingLeft: '10px'
              }}>
                {isLowAttendance 
                  ? `Alert: You must attend at least ${needToAttendOverall} consecutive classes to recover 75% standing.`
                  : `Status clear! You can skip up to ${canSkipOverall} classes without dropping below 75%.`}
              </div>

              {isSyncOverdue && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open('https://erp.skit.ac.in/reports/student_aggregate', '_blank');
                    navigate('/app/attendance?openERP=true');
                  }}
                  style={{
                    marginTop: 12,
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px dashed rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="sync-overdue-banner"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: 'var(--status-critical)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className="t-mono-sm" style={{ color: 'var(--status-critical)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em' }}>SYNC OVERDUE (3D+)</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        {lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleDateString()}` : 'Never synced with ERP'}
                      </span>
                    </div>
                  </div>
                  <span
                    className="t-mono-sm"
                    style={{
                      padding: '3px 8px',
                      fontSize: '9px',
                      fontWeight: 700,
                      background: 'var(--status-critical)',
                      color: '#fff',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '18px',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    SYNC
                  </span>
                </div>
              )}
            </div>

            {/* Advisor Diagnostics Accordion */}
            {isLowAttendance && subjectsList.length > 0 && (
              <div style={{ marginTop: 12, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsDiagnoseOpen(!isDiagnoseOpen); }}
                  className="diagnose-toggle-btn t-badge"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s ease',
                  }}
                >
                  <span>{isDiagnoseOpen ? 'CLOSE DIAGNOSTICS ▲' : 'DIAGNOSE ISSUES ▼'}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {subjectsList.filter(s => s.percentage < 75).length} Warning Courses
                  </span>
                </button>

                {isDiagnoseOpen && (
                  <div className="diagnose-list animate-fade-in" style={{
                    marginTop: 8, background: 'rgba(13, 15, 20, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: 'var(--radius-sm)', padding: '4px 8px',
                    maxHeight: 120, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}>
                    {subjectsList.map((sub) => {
                      const isSubLow = sub.percentage < 75;
                      const subColor = isSubLow 
                        ? (sub.percentage < 65 ? 'var(--status-critical)' : 'var(--status-warning)') 
                        : 'var(--status-safe)';
                      return (
                        <div key={sub.code} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                        }}>
                          <span className="truncate t-label" style={{ color: 'var(--text-primary)', maxWidth: '60%' }}>
                            {sub.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="t-helper" style={{ color: 'var(--text-muted)' }}>{sub.present}/{sub.total}</span>
                            <span className="t-badge" style={{ color: subColor }}>{Math.round(sub.percentage)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Unified Deadline Hurdle & Quick Links */}
          <div className="hero-panel-right">
            {isExamSoon && closestExam ? (
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
                let deadlineStatusLabel: string;
                let pulseAnimation = 'none';

                if (diffHours <= 24) {
                  barColor = 'linear-gradient(90deg, var(--status-warning) 0%, var(--status-critical) 100%)';
                  urgencyColor = 'var(--status-critical)';
                  deadlineStatusLabel = 'Due Soon';
                  pulseAnimation = 'nowPulse 1.2s infinite alternate';
                } else if (diffHours <= 72) {
                  barColor = 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-warning) 100%)';
                  urgencyColor = 'var(--status-warning)';
                  deadlineStatusLabel = 'Approaching';
                } else {
                  barColor = 'linear-gradient(90deg, #2563EB 0%, var(--accent-primary) 100%)';
                  urgencyColor = 'var(--accent-primary)';
                  deadlineStatusLabel = 'Upcoming';
                }

                const barPercent = Math.min(100, Math.max(0, (diffHours / 168) * 100));
                const PrimaryIcon = primaryDeadline.icon;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Next Deadline
                        </span>
                        <span className={`badge ${primaryDeadline.type === 'assignment' ? 'badge-safe' : primaryDeadline.type === 'poll' ? 'badge-info' : 'badge-critical'} t-badge`} style={{ fontSize: 9, padding: '2px 6px', textTransform: 'uppercase' }}>
                          {primaryDeadline.type}
                        </span>
                      </div>

                      <div className="t-card-title deadline-title-hover" 
                        onClick={() => navigate(primaryDeadline.route)}
                        style={{ color: 'var(--text-primary)', lineHeight: 1.4, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, transition: 'color 0.2s ease' }}
                      >
                        <PrimaryIcon size={16} style={{ color: urgencyColor, flexShrink: 0, marginTop: 3 }} />
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', textWrap: 'balance' }}>
                          {primaryDeadline.type === 'assignment' && primaryDeadline.subject ? primaryDeadline.subject : primaryDeadline.title}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="glass-progress-track" style={{ height: 5, borderRadius: 2.5, margin: '6px 0 8px 0', border: 'none', background: 'rgba(255,255,255,0.03)' }}>
                        <div className="glass-progress-fill" style={{ width: `${barPercent}%`, background: barColor, boxShadow: `0 0 10px ${urgencyColor}30`, borderRadius: 2.5 }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span className={`badge ${deadlineBadgeClass(primaryDeadline.dueDate)} t-badge`} style={{ fontSize: 9, padding: '2px 8px', animation: pulseAnimation }}>
                          {deadlineLabel(primaryDeadline.dueDate)}
                        </span>
                        <span className="t-badge" style={{ color: urgencyColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {deadlineStatusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Hurdle Jump Shortcuts */}
                    <div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className="t-badge" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jump Center</span>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {upcomingExams.length > 0 && (
                          <button 
                            onClick={() => navigate('/app/exams')} 
                            className="hurdle-shortcut-btn glow-crimson" 
                            title={`${upcomingExams.length} upcoming exams`} 
                            style={{ 
                              position: 'relative',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              boxShadow: '0 0 12px rgba(239, 68, 68, 0.15)'
                            }}
                          >
                            <Award size={13} color="var(--status-critical)" style={{ animation: 'nowPulse 1.5s infinite alternate' }} />
                            <span className="shortcut-badge" style={{ background: 'var(--status-critical)' }}>{upcomingExams.length}</span>
                          </button>
                        )}
                        {outstandingCounts.assignments > 0 && (
                          <button onClick={() => navigate('/app/assignments')} className="hurdle-shortcut-btn glow-emerald" title={`${outstandingCounts.assignments} pending assignments`} style={{ position: 'relative' }}>
                            <ClipboardList size={13} />
                            <span className="shortcut-badge">{outstandingCounts.assignments}</span>
                          </button>
                        )}
                        {outstandingCounts.announcements > 0 && (
                          <button onClick={() => navigate('/app/announcements')} onMouseEnter={prefetchAnnouncements} onTouchStart={prefetchAnnouncements} className="hurdle-shortcut-btn glow-violet" title={`${outstandingCounts.announcements} unread announcements`} style={{ position: 'relative' }}>
                            <Megaphone size={13} />
                            <span className="shortcut-badge">{outstandingCounts.announcements}</span>
                          </button>
                        )}
                        {outstandingCounts.polls > 0 && (
                          <button onClick={() => navigate('/app/polls')} className="hurdle-shortcut-btn glow-blue" title={`${outstandingCounts.polls} unanswered polls`} style={{ position: 'relative' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PartyPopper size={20} color="var(--status-safe)" className="animate-float-slow" />
                  </div>
                </div>
                <div>
                  <h4 className="t-card-title" style={{ color: 'var(--status-safe)', letterSpacing: '-0.01em', marginBottom: 4 }}>You're All Clear!</h4>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    No pending assignments, active polls, or unacknowledged deadlines. Enjoy!
                  </p>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span className="t-badge" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jump Center</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {upcomingExams.length > 0 && (
                      <button 
                        onClick={() => navigate('/app/exams')} 
                        className="hurdle-shortcut-btn glow-crimson" 
                        title={`${upcomingExams.length} upcoming exams`}
                        style={{
                          position: 'relative',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          boxShadow: '0 0 12px rgba(239, 68, 68, 0.15)'
                        }}
                      >
                        <Award size={13} color="var(--status-critical)" style={{ animation: 'nowPulse 1.5s infinite alternate' }} />
                        <span className="shortcut-badge" style={{ background: 'var(--status-critical)' }}>{upcomingExams.length}</span>
                      </button>
                    )}
                    <button onClick={() => navigate('/app/assignments')} className="hurdle-shortcut-btn" title="Assignments"><ClipboardList size={13} /></button>
                    <button onClick={() => navigate('/app/announcements')} onMouseEnter={prefetchAnnouncements} onTouchStart={prefetchAnnouncements} className="hurdle-shortcut-btn" title="Announcements"><Megaphone size={13} /></button>
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
    const examDateTime = new Date(`${exam.examDate}T${exam.startTime}`).getTime();
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

  return (
    <div
      onClick={() => navigate('/app/exams')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        width: '100%',
        cursor: 'pointer'
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="t-badge" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Next Exam
          </span>
          <span
            className="badge badge-critical t-badge"
            style={{
              fontSize: 9,
              padding: '2px 8px',
              animation: 'nowPulse 1.2s infinite alternate',
              background: 'var(--status-critical)',
              color: '#fff',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
            }}
          >
            {countdownText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: examGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
            flexShrink: 0
          }}>
            <span className="t-mono" style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {exam.subjectCode.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4 className="t-card-title truncate" style={{ color: 'var(--text-primary)', margin: 0, fontSize: 14 }}>
              {exam.subjectName}
            </h4>
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {exam.examType} • {exam.subjectCode}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Room: <strong style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{exam.activeRoom || 'N/A'}</strong>
          </span>
          <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {preparedCount}/{totalUnits} units
          </span>
        </div>

        {totalUnits > 0 && (
          <div className="glass-progress-track" style={{ height: 5, borderRadius: 2.5, border: 'none', background: 'rgba(255,255,255,0.03)' }}>
            <div
              className="glass-progress-fill"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-safe) 100%)',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
                borderRadius: 2.5
              }}
            />
          </div>
        )}
      </div>

      {/* Hurdle Jump Shortcuts */}
      <div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span className="t-badge" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jump Center</span>
        <span 
          style={{ 
            fontSize: 9, 
            padding: '3px 8px', 
            height: 18, 
            color: 'var(--accent-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4 
          }}
        >
          View Hub →
        </span>
      </div>
    </div>
  );
}

