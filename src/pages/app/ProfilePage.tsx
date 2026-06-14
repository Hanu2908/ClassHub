import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ChevronRight, Bell, Trash2, Download, Calculator, AlertTriangle, LogOut, ExternalLink, MessageSquare, Calendar, Plus, Users, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '../../components/NavBar';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import { useSection } from '../../hooks/useSectionMembers';
import { supabase } from '../../lib/supabase';
import { isPushSupported, getPushPermission, hasActiveSubscription, subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { signOutGlobal } from '../../components/AuthProvider';
import { useUserTags, useDeleteTag, MAX_ACTIVE_TAGS } from '../../hooks/useUserTags';
import { TagPill } from '../../components/TagPill';
import { AddTagSheet } from '../../components/AddTagSheet';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { authUser, role, hub, signOut, deferredPrompt, setDeferredPrompt, refreshProfile } = useAppStore();
  const { data: section } = useSection();

  const subBatch = authUser?.subBatch;
  const sectionId = authUser?.sectionId;

  const { data: counsellor = null } = useQuery({
    queryKey: ['my-counsellor', sectionId, subBatch],
    queryFn: async () => {
      if (!sectionId || !subBatch) return null;
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          teacher:teacher_id (name, email)
        `)
        .eq('section_id', sectionId)
        .eq('is_counsellor_for_batch', subBatch)
        .maybeSingle();
      if (error) throw error;
      return (data?.teacher as { name: string; email: string }) || null;
    },
    enabled: !!sectionId && !!subBatch,
  });
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showAddTagSheet, setShowAddTagSheet] = useState(false);

  // Tags
  const { data: myTags = [] } = useUserTags();
  const deleteTag = useDeleteTag();

  // Check push subscription state on mount and sync with global profile setting
  useEffect(() => {
    if (isPushSupported()) {
      hasActiveSubscription().then((active) => {
        setNotificationsOn(active && !!authUser?.notificationsEnabled);
      });
    }
  }, [authUser?.notificationsEnabled]);

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

  const displayName = authUser?.name ?? 'Student';
  const displayEmail = authUser?.email ?? '';
  const displayAvatar = authUser?.avatarUrl;
  const displayRole = role;

  const hubCode = section?.inviteCode ?? hub?.hubCode ?? '—';
  const sectionName = section?.name ?? hub?.section ?? '—';
  const institution = section?.college ?? hub?.institution ?? 'SKIT, Jaipur';
  const classRoll = authUser?.sectionRoll ?? hub?.classRoll ?? '—';
  const universityRoll = authUser?.universityRoll ?? hub?.universityRoll ?? '—';

  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(hubCode);
    toast.success('Hub code copied!');
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      const { error, data } = await supabase.functions.invoke('delete-account');
      if (error) {
        // Try to extract the real server error message from the response body
        let detail = error.message;
        let isPartial = false;
        try {
          const body = typeof (error as any).context?.json === 'function'
            ? await (error as any).context.json()
            : null;
          if (body?.error) detail = body.error;
          if (body?.detail) detail += `: ${body.detail}`;
          if (body?.partial) isPartial = true;
        } catch { /* ignore parse errors */ }
        if (isPartial) {
          // public.users deleted but auth.users persists — sign out anyway, warn user
          await signOutGlobal(navigate);
          toast.error('Account data deleted, but full removal needs admin action. Contact support.');
          return;
        }
        throw new Error(detail);
      }
      if (data && !data.success) throw new Error(data.error ?? 'Unknown error');
      // Clear all local state and Supabase session, then redirect
      await signOutGlobal(navigate);
      toast.success('Account deleted successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Delete failed: ${msg}`);
      console.error('[DeleteAccount]', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleLeaveHub = async () => {
    setLeaving(true);
    try {
      const { error } = await supabase.rpc('leave_section_hub' as any);
      if (error) throw error;
      // Refresh profile from DB so Zustand reflects the detached state (no section)
      await refreshProfile();
      // Clear hub cache and navigate to onboarding — Supabase session stays alive
      signOut(); // reset local Zustand hub/offlineCache state only
      navigate('/onboarding/choice');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to leave hub: ${msg}`);
      console.error('[LeaveHub]', err);
    } finally {
      setLeaving(false);
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

  const handleToggleCommuterStatus = async () => {
    if (!authUser) return;
    const isDemoMode = import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true';
    const nextStatus = !authUser.dayScholar;

    if (isDemoMode) {
      // Offline/Demo bypass: write directly to local Zustand store
      useAppStore.setState((s) => {
        if (!s.authUser) return s;
        const updatedAuth = { ...s.authUser, dayScholar: nextStatus };
        return {
          authUser: updatedAuth,
          user: s.user ? { ...s.user } : null
        };
      });
      toast.success(`Status updated to ${nextStatus ? 'Day Scholar' : 'Hosteler'}! [Demo]`);
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ day_scholar: nextStatus })
        .eq('id', authUser.id);

      if (error) {
        throw new Error(error.message || 'Database update failed');
      }

      await useAppStore.getState().refreshProfile();
      toast.success(`Status updated to ${nextStatus ? 'Day Scholar' : 'Hosteler'}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update status: ${msg}`);
    }
  };

  const handleToggleBatch = async () => {
    if (!authUser) return;
    const isDemoMode = import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true';
    const nextBatch = subBatch === '1' ? '2' : '1';

    if (isDemoMode) {
      // Offline/Demo bypass: write directly to local Zustand store
      useAppStore.setState((s) => {
        if (!s.authUser) return s;
        const updatedAuth = { ...s.authUser, subBatch: nextBatch };
        return {
          authUser: updatedAuth,
          user: s.user ? { ...s.user } : null
        };
      });
      toast.success(`Batch updated to ${sectionName}${nextBatch}! [Demo]`);
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ sub_batch: nextBatch })
        .eq('id', authUser.id);

      if (error) {
        throw new Error(error.message || 'Database update failed');
      }

      await useAppStore.getState().refreshProfile();
      toast.success(`Batch updated to ${sectionName}${nextBatch}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update batch: ${msg}`);
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

      <main className="page-content">
        {/* Avatar + identity */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="avatar" style={{ margin: '0 auto 16px' }} />
          ) : (
            <div className="avatar-initials" style={{ margin: '0 auto 16px' }}>{initials}</div>
          )}
          <h2 className="t-feature" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
            {displayName}
          </h2>
          <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            {displayEmail}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${displayRole === 'cr' ? 'badge-warning' : displayRole === 'teacher' ? 'badge-safe' : 'badge-info'}`}>
              {displayRole === 'cr' ? '⭐ CR' : displayRole === 'teacher' ? '👨‍🏫 Teacher' : 'Student'}
            </span>
            <span className="badge badge-info">{sectionName}</span>
            {displayRole !== 'teacher' && (
              <span className="t-mono" style={{ color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-pill)' }}>
                Roll {classRoll}
              </span>
            )}
          </div>
        </div>

        {/* My Tags */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>MY TAGS</p>
          <div className="card" style={{ padding: '16px' }}>
            {myTags.length === 0 ? (
              <p className="t-caption" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                No tags yet — add tags to let your section know.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {myTags.map(tag => (
                  <TagPill
                    key={tag.id}
                    tagText={tag.tagText}
                    expiresAt={tag.expiresAt}
                    showExpiry
                    onRemove={() => {
                      deleteTag.mutate(tag.id, {
                        onSuccess: () => toast.info('Tag removed'),
                        onError: (err) => toast.error(`Failed: ${err.message}`),
                      });
                    }}
                  />
                ))}
              </div>
            )}
            <button
              id="add-tag-btn"
              onClick={() => setShowAddTagSheet(true)}
              disabled={myTags.length >= MAX_ACTIVE_TAGS}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: myTags.length >= MAX_ACTIVE_TAGS ? 'var(--text-muted)' : 'var(--accent-primary)',
                background: 'rgba(74, 158, 255, 0.06)',
                border: '1px dashed rgba(74, 158, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
                cursor: myTags.length >= MAX_ACTIVE_TAGS ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Plus size={14} />
              <span>{myTags.length >= MAX_ACTIVE_TAGS ? `Max ${MAX_ACTIVE_TAGS} tags reached` : 'Add Tag'}</span>
            </button>
          </div>
        </div>

        {/* Hub info */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>HUB INFO</p>
          <div className="card" style={{ padding: 0 }}>
            {[
              { label: 'Hub Code', value: hubCode, action: <button id="copy-hub-code" onClick={handleCopy} className="t-label" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}><Copy size={13} /> Copy</button> },
              { 
                label: 'Section', 
                value: sectionName,
                action: (
                  <button 
                    id="view-members-btn" 
                    onClick={() => navigate('/app/members')} 
                    className="t-label" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Users size={13} /> View
                  </button>
                )
              },
              { label: 'Institution', value: institution },
              ...(role !== 'teacher' ? [
                { label: 'University Roll', value: universityRoll },
                { 
                  label: 'Status', 
                  value: authUser?.dayScholar ? 'DS 🚌' : 'Hostel 🏠', 
                  action: (
                    <button 
                      id="toggle-commute-status" 
                      onClick={handleToggleCommuterStatus} 
                      className="t-label" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Change
                    </button>
                  )
                },
                { 
                  label: 'Batch', 
                  value: subBatch ? `${sectionName}${subBatch}` : 'Not Selected', 
                  action: (
                    <button 
                      id="toggle-sub-batch" 
                      onClick={handleToggleBatch} 
                      className="t-label" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Change
                    </button>
                  )
                }
              ] : [])
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
              }}>
                <span className="t-body" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="t-mono" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                  {row.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Counsellor Section */}
        {counsellor && (
          <div>
            <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>BATCH COUNSELLOR</p>
            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{counsellor.name}</h3>
                <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>Batch {sectionName || ''}{subBatch} Counsellor</p>
              </div>
              <a
                href={`mailto:${counsellor.email}?subject=ClassHub - Inquiry from student (${authUser?.name}, Roll ${classRoll})&body=Respected Professor,%0D%0A%0D%0A`}
                className="t-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--accent-primary-glow)',
                  border: '1px solid rgba(74, 158, 255, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-primary)',
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '12px',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Mail size={14} /> Contact
              </a>
            </div>
          </div>
        )}

        {/* TOOLS */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>TOOLS</p>
          <div className="card" style={{ padding: 0 }}>
            {authUser?.isDeveloper && (
              <button
                id="dev-console-btn"
                onClick={() => navigate('/app/dev-console')}
                className="list-row"
                style={{ width: '100%', borderBottom: '1px solid var(--border-default)', borderRadius: 0 }}
              >
                <AlertTriangle size={18} color="#C084FC" />
                <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)', textAlign: 'left' }}>Developer Console</span>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            )}
            <button id="cgpa-calc-btn" className="list-row" style={{ width: '100%', borderBottom: '1px solid var(--border-default)', borderRadius: 0 }} onClick={() => navigate('/app/gpa')}>
              <Calculator size={18} color="var(--accent-primary)" />
              <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)', textAlign: 'left' }}>CGPA Calculator</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
            <button
              id="exams-hub-btn"
              onClick={() => navigate('/app/exams')}
              className="list-row"
              style={{ width: '100%', borderBottom: '1px solid var(--border-default)', borderRadius: 0 }}
            >
              <Calendar size={18} color="#ec4899" />
              <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)', textAlign: 'left' }}>Exams Hub</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
            <button
              id="skit-exam-portal-btn"
              onClick={() => window.open('https://skitexam.com/', '_blank', 'noopener,noreferrer')}
              className="list-row"
              style={{ width: '100%', borderBottom: '1px solid var(--border-default)', borderRadius: 0 }}
            >
              <ExternalLink size={18} color="var(--accent-primary)" />
              <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)', textAlign: 'left' }}>SKIT Exam Portal</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
            <button
              id="resource-hub-btn"
              onClick={() => navigate('/app/resource-hub')}
              className="list-row"
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 0 }}
            >
              <ExternalLink size={18} color="var(--status-safe)" />
              <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)', textAlign: 'left' }}>Resource Hub</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        {/* PWA Install */}
        {deferredPrompt && (
          <div>
            <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>GET THE APP</p>
            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(145deg, rgba(74,158,255,0.1) 0%, rgba(74,158,255,0.02) 100%)', border: '1px solid rgba(74,158,255,0.2)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Download size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>Level up your experience</h3>
                <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>Install ClassHub for faster access and offline features.</p>
              </div>
              <button 
                onClick={handleInstallApp} className="t-button" style={{ background: 'var(--text-primary)', color: 'var(--bg-base)', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 14px', cursor: 'pointer', flexShrink: 0 }}
              >
                Install
              </button>
            </div>
          </div>
        )}

        {/* Settings */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>SETTINGS</p>
          <div className="card" style={{ padding: 0 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: pushSupported && !pushBlocked ? 'pointer' : 'default', opacity: pushSupported ? 1 : 0.5 }}
              onClick={handleToggleNotifications}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={16} color="var(--text-secondary)" />
                <div>
                  <span className="t-body" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                  {pushBlocked && (
                    <p className="t-mono-sm" style={{ color: 'var(--status-critical)', marginTop: 2 }}>Blocked in browser settings</p>
                  )}
                  {!pushSupported && (
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Not supported in this browser</p>
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

            {/* Feedback & Bug Trigger */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', borderTop: '1px solid var(--border-default)' }}
              onClick={() => setShowFeedbackSheet(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MessageSquare size={16} color="var(--text-secondary)" />
                <span className="t-body" style={{ color: 'var(--text-primary)' }}>Send Feedback / Report Bug</span>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>
        </div>

        {/* Account — Sign Out */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>ACCOUNT</p>
          <button
            id="sign-out-btn"
            className="list-row"
            style={{ width: '100%' }}
            onClick={() => { signOut(); navigate('/'); }}
          >
            <LogOut size={18} color="var(--status-critical)" />
            <span className="t-body-medium" style={{ flex: 1, color: 'var(--status-critical)', textAlign: 'left' }}>Sign Out</span>
          </button>
        </div>

        {/* Danger zone */}
        <div>
          <p className="t-label" style={{ color: 'var(--status-critical)', marginBottom: 8, paddingLeft: 4 }}>DANGER ZONE</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!showLeaveConfirm ? (
              <button id="leave-hub-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-warning)' }}
                onClick={() => setShowLeaveConfirm(true)}>
                <Trash2 size={15} /> Leave Hub
              </button>
            ) : (
              <div style={{ background: 'var(--status-critical-bg)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>
                  Are you sure? You'll need a new hub code to rejoin.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button id="confirm-leave-btn" className="t-button"
                    disabled={leaving}
                    style={{ flex: 1, padding: '10px', background: 'var(--status-critical)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: leaving ? 'not-allowed' : 'pointer', opacity: leaving ? 0.7 : 1 }}
                    onClick={handleLeaveHub}>{leaving ? 'Leaving…' : 'Leave'}</button>
                  <button id="cancel-leave-btn" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>Cancel</button>
                </div>
              </div>
            )}

            {/* Delete Account — two-step confirmation */}
            {!showDeleteConfirm ? (
              <button id="delete-account-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-critical)' }}
                onClick={() => setShowDeleteConfirm(true)}>
                <AlertTriangle size={15} /> Delete Account
              </button>
            ) : (
              <div style={{ background: 'var(--status-critical-bg)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                  This will permanently delete your account and all your data.
                </p>
                <p className="t-caption" style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Type <strong style={{ color: 'var(--status-critical)' }}>DELETE</strong> to confirm.
                </p>
                <input
                  id="delete-confirm-input"
                  className="input"
                  style={{ marginBottom: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
                  placeholder="Type DELETE"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    id="confirm-delete-btn"
                    disabled={deleteInput !== 'DELETE' || deleting} className="t-button" style={{ flex: 1, padding: '10px',
                      background: deleteInput === 'DELETE' ? 'var(--status-critical)' : 'var(--bg-elevated)',
                      color: deleteInput === 'DELETE' ? '#fff' : 'var(--text-muted)',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                      opacity: deleting ? 0.6 : 1 }}
                    onClick={handleDeleteAccount}
                  >
                    {deleting ? 'Deleting…' : 'Delete Forever'}
                  </button>
                  <button id="cancel-delete-btn" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <NavBar />
      <FeedbackSheet open={showFeedbackSheet} onClose={() => setShowFeedbackSheet(false)} />
      <AddTagSheet open={showAddTagSheet} onClose={() => setShowAddTagSheet(false)} />
    </div>
  );
}
