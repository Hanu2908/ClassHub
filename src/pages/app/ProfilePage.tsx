import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Bell,
  Download,
  Calculator,
  AlertTriangle,
  LogOut,
  ExternalLink,
  MessageSquare,
  Calendar,
  Heart,
  Star,
  BookOpen,
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import { isPushSupported, getPushPermission, hasActiveSubscription, subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { signOutGlobal } from '../../components/AuthProvider';
import { AddTagSheet } from '../../components/AddTagSheet';
import { logEvent } from '../../lib/analytics';
import { useTeacherLinkedSubjects } from '../../hooks/useProfileQueries';

import { ProfileIdentityCard } from './profile/ProfileIdentityCard';
import { ProfileAcademicCard } from './profile/ProfileAcademicCard';
import { ProfileTeacherSectionsCard } from './profile/ProfileTeacherSectionsCard';
import { ProfileDangerZone } from './profile/ProfileDangerZone';
import { LinkSubjectsSheet } from './profile/LinkSubjectsSheet';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { authUser, role, deferredPrompt, setDeferredPrompt } = useAppStore();

  const sectionId = authUser?.sectionId;
  const isTeacher = role === 'teacher';

  const { data: myLinkedSubjects = [], refetch: refetchLinked } = useTeacherLinkedSubjects(authUser?.id, isTeacher);

  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showAddTagSheet, setShowAddTagSheet] = useState(false);
  const [showLinkSubjectsSheet, setShowLinkSubjectsSheet] = useState(false);

  // Check push subscription state on mount and sync with global profile setting
  useEffect(() => {
    if (isPushSupported()) {
      hasActiveSubscription().then((active) => {
        setNotificationsOn(active && !!authUser?.notificationsEnabled);
      });
    }
  }, [authUser?.notificationsEnabled]);

  useEffect(() => {
    if (authUser?.id && authUser?.sectionId) {
      logEvent('profile_viewed', authUser.id, authUser.sectionId);
    }
  }, [authUser]);

  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const pushSupported = isPushSupported();
  const pushBlocked = pushSupported && getPushPermission() === 'denied';

  const handleToggleNotifications = async () => {
    if (!pushSupported || notifLoading) return;
    setNotifLoading(true);
    try {
      if (notificationsOn) {
        await unsubscribeFromPush();
        setNotificationsOn(false);
        toast.info('Notifications disabled');
      } else {
        if (pushBlocked) {
          toast.error('Notifications blocked in browser settings. Please enable them manually.');
          return;
        }
        const ok = await subscribeToPush();
        if (ok) {
          setNotificationsOn(true);
          toast.success('Notifications enabled!');
        } else {
          toast.error('Could not enable notifications');
        }
      }
    } finally {
      setNotifLoading(false);
    }
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>My Profile</h1>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProfileIdentityCard onOpenAddTag={() => setShowAddTagSheet(true)} />
        <ProfileAcademicCard />

        <ProfileTeacherSectionsCard
          linkedSubjects={myLinkedSubjects}
          refetchLinked={refetchLinked}
          onOpenLinkSubjects={() => setShowLinkSubjectsSheet(true)}
        />

        {/* Tools */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>TOOLS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}>
              {/* CGPA Calculator */}
              <button
                id="cgpa-calc-btn"
                onClick={() => navigate('/app/gpa')}
                className="profile-tool-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(74, 158, 255, 0.12)',
                    border: '1px solid rgba(74, 158, 255, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Calculator size={17} color="var(--accent-primary)" />
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, margin: '0 0 2px 0' }}>
                    CGPA Calculator
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, lineHeight: 1.3 }}>
                    Projections & SGPA goal
                  </p>
                </div>
              </button>

              {/* Exams Hub */}
              <button
                id="exams-hub-btn"
                onClick={() => navigate('/app/exams')}
                className="profile-tool-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(236, 72, 153, 0.12)',
                    border: '1px solid rgba(236, 72, 153, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Calendar size={17} color="#ec4899" />
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, margin: '0 0 2px 0' }}>
                    Exams Hub
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, lineHeight: 1.3 }}>
                    Midterm dates & schedule
                  </p>
                </div>
              </button>

              {/* Resource Hub */}
              <button
                id="resource-hub-btn"
                onClick={() => navigate('/app/resource-hub')}
                className="profile-tool-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <BookOpen size={17} color="var(--status-safe)" />
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, margin: '0 0 2px 0' }}>
                    Resource Hub
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, lineHeight: 1.3 }}>
                    Notes, PYQs & syllabus
                  </p>
                </div>
              </button>

              {/* SKIT Exam Portal */}
              <button
                id="skit-exam-portal-btn"
                onClick={() => window.open('https://skitexam.com/', '_blank', 'noopener,noreferrer')}
                className="profile-tool-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(167, 139, 250, 0.12)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ExternalLink size={17} color="#A78BFA" />
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, margin: '0 0 2px 0' }}>
                    SKIT Portal
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, lineHeight: 1.3 }}>
                    Results & notices ↗
                  </p>
                </div>
              </button>
            </div>

            {/* Developer Console */}
            {authUser?.isDeveloper && (
              <button
                id="dev-console-btn"
                onClick={() => navigate('/app/dev-console')}
                className="profile-dev-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(192, 132, 252, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <AlertTriangle size={15} color="#C084FC" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, margin: 0 }}>
                      Developer Console
                    </p>
                    <p className="t-caption" style={{ color: '#C084FC', fontSize: 11, margin: 0 }}>
                      Debug state, triggers & sandbox tools
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} color="var(--text-muted)" />
              </button>
            )}
          </div>
        </div>

        {/* Preferences & Account */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>PREFERENCES & ACCOUNT</p>
          <div className="card" style={{ padding: 0 }}>
            {/* PWA Install Banner */}
            {deferredPrompt && (
              <div className="pwa-settings-banner">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Download size={18} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, margin: 0, fontSize: 13 }}>Install ClassHub PWA</h4>
                  <p className="t-caption" style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 11 }}>Fast access and offline launch</p>
                </div>
                <button 
                  onClick={handleInstallApp}
                  className="t-button"
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-base)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  Install
                </button>
              </div>
            )}

            {/* Notifications Toggle */}
            <div
              className="settings-row"
              style={{ cursor: pushSupported && !pushBlocked ? 'pointer' : 'default', opacity: pushSupported ? 1 : 0.5 }}
              onClick={handleToggleNotifications}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={16} color="var(--text-secondary)" />
                <div>
                  <span className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Push Notifications</span>
                  {pushBlocked && (
                    <p className="t-mono-sm" style={{ color: 'var(--status-critical)', marginTop: 2 }}>Blocked in browser settings</p>
                  )}
                  {!pushSupported && (
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {isIOS 
                        ? 'Add ClassHub to your Home Screen first to enable notifications.' 
                        : 'Not supported in this browser'}
                    </p>
                  )}
                </div>
              </div>
              <div style={{
                width: 44, height: 24, borderRadius: 12,
                background: notificationsOn ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                border: notificationsOn ? 'none' : '1px solid var(--border-default)',
                position: 'relative', transition: 'background 0.2s ease',
                opacity: notifLoading ? 0.6 : 1,
              }}>
                <div style={{
                  position: 'absolute',
                  ...(notificationsOn ? { right: 2 } : { left: 2 }),
                  top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s ease, right 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>

            {/* Feedback & Bug Report */}
            <div
              className="settings-row"
              onClick={() => setShowFeedbackSheet(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MessageSquare size={16} color="var(--text-secondary)" />
                <span className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Send Feedback / Report Bug</span>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Star on GitHub */}
            <div
              className="settings-row"
              onClick={() => window.open('https://github.com/Hanu2908/ClassHub', '_blank', 'noopener,noreferrer')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Star size={16} color="var(--text-secondary)" />
                <span className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Star on GitHub</span>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Ko-fi Support */}
            <div
              className="settings-row"
              onClick={() => window.open('https://ko-fi.com/himanshuhanu', '_blank', 'noopener,noreferrer')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Heart size={16} color="#FF5E5B" />
                <span className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Support Developer</span>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Sign Out */}
            <button
              id="sign-out-btn"
              className="settings-row settings-row-danger"
              onClick={() => signOutGlobal(navigate)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogOut size={16} color="var(--status-critical)" />
                <span className="t-body" style={{ color: 'var(--status-critical)', fontWeight: 600 }}>Sign Out</span>
              </div>
              <ChevronRight size={16} color="var(--status-critical)" style={{ opacity: 0.6 }} />
            </button>

            {/* Danger Zone */}
            <ProfileDangerZone />
          </div>
        </div>
      </main>

      <NavBar />
      <FeedbackSheet open={showFeedbackSheet} onClose={() => setShowFeedbackSheet(false)} />
      <AddTagSheet open={showAddTagSheet} onClose={() => setShowAddTagSheet(false)} />
      {isTeacher && authUser && sectionId && (
        <LinkSubjectsSheet
          open={showLinkSubjectsSheet}
          onClose={() => setShowLinkSubjectsSheet(false)}
          teacherId={authUser.id}
          sectionId={sectionId}
          linkedSubjects={myLinkedSubjects}
          refetchLinked={refetchLinked}
        />
      )}
    </div>
  );
}
