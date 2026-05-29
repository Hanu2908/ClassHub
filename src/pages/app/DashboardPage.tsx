import { useState, useMemo, type CSSProperties, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, BarChart2, ClipboardList, Activity, PartyPopper } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore, isExpired } from '../../store/appStore';
import { useAnnouncements, useAssignments, usePolls, useAttendance } from '../../hooks/useSupabaseQuery';
import { useAcknowledge } from '../../hooks/useSupabaseMutations';
import { showToast } from '../../components/Toast';
import { isPushSupported, getPushPermission } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

// Dashboard sub-components
import NotificationSheet from './dashboard/NotificationSheet';
import CriticalAlerts from './dashboard/CriticalAlerts';
import ScheduleWidget from './dashboard/ScheduleWidget';
import AnnouncementsScroll from './dashboard/AnnouncementsScroll';
import PollBanner from './dashboard/PollBanner';
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

// ── Prefetch helper (exported for sub-components) ──
export const prefetchAnnouncementsData = (queryClient: any, sectionId: string | null | undefined, userId: string | null | undefined) => {
  if (!sectionId || !userId) return;

  queryClient.prefetchQuery({
    queryKey: ['announcements', sectionId, userId, 0, 100],
    queryFn: async () => {
      const { data: anns, error: annErr } = await supabase
        .from('announcements')
        .select(`
          id, title, message_content, priority, deadline_at, expires_at, created_at,
          attachments (id, filename, file_size, file_type, storage_path)
        `)
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false })
        .range(0, 99);
      if (annErr) throw annErr;

      let ackIds: string[] = [];
      if (userId && Array.isArray(anns) && anns.length > 0) {
        const announcementIds = anns.map(a => a.id);
        const { data: acks, error: ackErr } = await supabase
          .from('acknowledgments')
          .select('announcement_id')
          .eq('user_id', userId)
          .in('announcement_id', announcementIds);
        if (ackErr) throw ackErr;
        ackIds = (acks ?? []).map(a => a.announcement_id);
      }

      return (anns ?? []).map(a => ({
        id: a.id,
        title: a.title,
        body: a.message_content,
        priority: a.priority as 'critical' | 'general',
        deadline: a.deadline_at,
        postedAt: a.created_at,
        expiresAt: a.expires_at ?? null,
        isAcknowledged: ackIds.includes(a.id),
        attachments: ((a.attachments as any) ?? []).map((att: any) => ({
          id: att.id,
          filename: att.filename,
          fileSize: att.file_size,
          fileType: att.file_type,
          storagePath: att.storage_path,
        })),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: ['section_acknowledgments', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acknowledgments')
        .select('announcement_id, user_id, acknowledged_at');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const notifications = useAppStore(s => s.notifications);
  const role = useAppStore(s => s.role);
  const { data: announcements = [] } = useAnnouncements({ limit: 50 });
  const { data: assignments = [] } = useAssignments();
  const { data: attendance = { subjects: [], overall: 0 } } = useAttendance();
  const { data: polls = [] } = usePolls();
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
    } catch (err) {
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
            {primaryDeadline ? (
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

      {showNotifs ? <NotificationSheet onClose={() => setShowNotifs(false)} /> : null}

      <NavBar />
      <FeedbackSheet open={showFeedbackSheet} onClose={() => setShowFeedbackSheet(false)} />
    </div>
  );
}
