import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  BarChart2,
  Megaphone,
  Bell,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  Trash2,
  Loader2,
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { CRAttendanceRegisterModal } from '../../components/CRAttendanceRegisterModal';
import { useAppStore } from '../../store/appStore';
import { useSection } from '../../hooks/useSectionMembers';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

import { InviteCodeCard } from './cr-command/InviteCodeCard';
import { TeacherInviteCodeCard } from './cr-command/TeacherInviteCodeCard';
import { BatchDivisionCard } from './cr-command/BatchDivisionCard';
import { SubmissionTracker } from './cr-command/SubmissionTracker';
import { SectionRosterCard } from './cr-command/SectionRosterCard';
import { ManageCRs } from './cr-command/ManageCRs';
import { ManageTeachers } from './cr-command/ManageTeachers';
import { SendNotificationSheet } from './cr-command/SendNotificationSheet';
import { FlashPostSheet } from './cr-command/FlashPostSheet';

export default function CRCommandPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const [showNotifSheet, setShowNotifSheet] = useState(!!location.state?.openBroadcast);
  const [showFlashPostSheet, setShowFlashPostSheet] = useState(!!location.state?.openFlashPost);
  const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deletingHub, setDeletingHub] = useState(false);
  const { data: section } = useSection();

  useEffect(() => {
    if (location.state?.openBroadcast || location.state?.openFlashPost) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openBroadcast, location.state?.openFlashPost, navigate, location.pathname]);

  // Guard: non-CRs sent home
  if (role !== 'cr') {
    navigate('/app/home', { replace: true });
    return null;
  }

  const handleDeleteHub = async () => {
    if (!section?.id) return;
    setDeletingHub(true);
    try {
      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        toast.success('[Demo] Section Hub deleted successfully!');
        useAppStore.getState().clearHubState();
        navigate('/onboarding/choice', { replace: true });
        return;
      }

      const { error } = await supabase.rpc('delete_section_hub', { target_section_id: section.id });
      if (error) throw error;

      toast.success('Section Hub deleted successfully!');
      // Purge all stale cached section data from Zustand while keeping auth session alive
      useAppStore.getState().clearHubState();
      navigate('/onboarding/choice', { replace: true });
    } catch (err: unknown) {
      console.error('[Delete] Hub deletion failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to delete Section Hub';
      toast.error(errMsg);
    } finally {
      setDeletingHub(false);
      setShowDeleteSheet(false);
    }
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button id="cr-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--accent-primary)" />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>CR Command Center</h1>
          </div>
        </div>
        <p className="t-caption" style={{ color: 'var(--text-muted)', paddingLeft: 34 }}>
          Manage submissions, attendance & notifications
        </p>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InviteCodeCard />
        <TeacherInviteCodeCard />
        <BatchDivisionCard />
        
        {/* Quick Actions */}
        <section>
          <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>QUICK ACTIONS</p>
          <div className="carousel" style={{ paddingBottom: 4 }}>
            <button className="card" onClick={() => setShowAttendanceSheet(true)} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content', background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)' }}>
              <UserCheck size={16} color="var(--status-safe)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Take Attendance</span>
            </button>
            <button className="card" onClick={() => navigate('/app/polls', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <BarChart2 size={16} color="var(--status-info)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Create Poll</span>
            </button>
            <button className="card" onClick={() => navigate('/app/announcements', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <Megaphone size={16} color="var(--status-warning)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Announcement</span>
            </button>
            <button className="card" onClick={() => setShowNotifSheet(true)} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <Bell size={16} color="var(--status-critical)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Notification</span>
            </button>
            <button className="card" onClick={() => setShowFlashPostSheet(true)} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <AlertTriangle size={16} color="var(--status-critical)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Flash Post</span>
            </button>
            <button className="card" onClick={() => navigate('/app/assignments', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <ClipboardList size={16} color="var(--status-safe)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Add Assignment</span>
            </button>
            <button className="card" onClick={() => navigate('/app/cr/subjects')} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <BookOpen size={16} color="#c084fc" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Subjects</span>
            </button>
          </div>
        </section>

        <SubmissionTracker />
        <SectionRosterCard onOpenAttendance={() => setShowAttendanceSheet(true)} />

        <ManageCRs />
        <ManageTeachers />

        {/* Danger Zone */}
        <section style={{ marginTop: 16 }}>
          <p className="t-mono" style={{ color: 'var(--status-critical)', marginBottom: 8, letterSpacing: '0.04em' }}>DANGER ZONE</p>
          <div style={{
            padding: 16, borderRadius: 'var(--radius-lg)',
            background: 'rgba(255,68,68,0.04)',
            border: '1px dashed rgba(255,68,68,0.3)',
            display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p className="t-subtitle" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>Delete Section Hub</p>
                <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>Permanently remove this hub, all students, and data.</p>
              </div>
              <button className="t-button"
                onClick={() => setShowDeleteSheet(true)}
                style={{
                  background: 'rgba(255,68,68,0.1)', color: 'var(--status-critical)',
                  border: '1px solid rgba(255,68,68,0.25)', padding: '8px 12px',
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer', flexShrink: 0, transition: 'background var(--transition-fast)'
                }}
              >
                Delete Hub
              </button>
            </div>
          </div>
        </section>

        {/* Bottom padding for navbar */}
        <div style={{ height: 24 }} />
      </main>

      <SendNotificationSheet open={showNotifSheet} onClose={() => setShowNotifSheet(false)} />
      <FlashPostSheet open={showFlashPostSheet} onClose={() => setShowFlashPostSheet(false)} />
      <CRAttendanceRegisterModal open={showAttendanceSheet} onClose={() => setShowAttendanceSheet(false)} />

      <BottomSheet open={showDeleteSheet} onClose={() => setShowDeleteSheet(false)} title="Delete Section Hub?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
          <div style={{
            background: 'rgba(255, 68, 68, 0.05)',
            border: '1.5px solid rgba(255, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <AlertTriangle size={20} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="t-subtitle" style={{ color: 'var(--status-critical)', marginBottom: 4 }}>
                CRITICAL: Absolute Destruction
              </p>
              <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                This action is permanent and cannot be undone. It will completely delete:
              </p>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '6px 0 0 16px', padding: 0, lineHeight: 1.5 }}>
                <li>All subjects and academic slots</li>
                <li>All assignments, sets, and student submissions</li>
                <li>All announcements and attendance logs</li>
                <li>All active polls, votes, and section data</li>
              </ul>
              <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 8 }}>
                You and all other students in this section will be instantly detached and prompted to join or create a new hub.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button 
              className="btn-secondary" 
              onClick={() => setShowDeleteSheet(false)} 
              style={{ flex: 1, minHeight: 48 }}
            >
              Cancel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleDeleteHub} 
              disabled={deletingHub}
              style={{ 
                flex: 1, 
                background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)', 
                boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {deletingHub ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deletingHub ? 'Deleting Hub…' : 'Yes, Delete Hub'}
            </button>
          </div>
        </div>
      </BottomSheet>

      <NavBar />
    </div>
  );
}
