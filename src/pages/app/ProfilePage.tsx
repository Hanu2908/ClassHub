import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ChevronRight, Bell, Trash2, Download, Calculator, AlertTriangle, LogOut, ExternalLink, MessageSquare, Calendar, Plus, Users, Mail, Loader2, Heart, Star } from 'lucide-react';
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
import { BottomSheet } from '../../components/BottomSheet';
import { logEvent } from '../../lib/analytics';

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
  const [showLinkSubjectsSheet, setShowLinkSubjectsSheet] = useState(false);
  const [showJoinSectionDialog, setShowJoinSectionDialog] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningSection, setJoiningSection] = useState(false);

  const { data: myLinkedSubjects = [], refetch: refetchLinked } = useQuery({
    queryKey: ['my-linked-subjects', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          subject_id,
          section_id,
          sections:section_id (name),
          subjects:subject_id (code, name, accent)
        `)
        .eq('teacher_id', authUser.id);
      if (error) throw error;
      return (data || []).filter(item => item.subject_id !== null);
    },
    enabled: !!authUser?.id && role === 'teacher',
  });

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

  const handleUpdatePhone = async () => {
    if (!authUser) return;
    const currentPhone = authUser.phone || '';
    const newPhone = prompt('Enter your 10-digit Indian phone number:', currentPhone);
    if (newPhone === null) return;
    const trimmed = newPhone.trim();
    if (role === 'student' && !trimmed) {
      toast.error('Phone number is required for students');
      return;
    }
    if (trimmed && !/^[6-9]\d{9}$/.test(trimmed)) {
      toast.error('Enter a valid 10-digit Indian phone number (starting with 6-9)');
      return;
    }
    
    const isDemoMode = import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true';
    if (isDemoMode) {
      useAppStore.setState((s) => {
        if (!s.authUser) return s;
        return {
          authUser: { ...s.authUser, phone: trimmed || null }
        };
      });
      toast.success('Phone number updated successfully! [Demo]');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ phone: trimmed || null })
        .eq('id', authUser.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Phone number updated successfully!');
    } catch (err: any) {
      toast.error('Failed to update phone number: ' + err.message);
    }
  };

  const handleJoinSection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteCodeInput.trim() || inviteCodeInput.trim().length < 6) {
      toast.error('Enter a valid invite code (min 6 characters)');
      return;
    }

    setJoiningSection(true);
    try {
      const code = inviteCodeInput.trim().toUpperCase();

      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        toast.success('Joined section successfully! [Demo]');
        setShowJoinSectionDialog(false);
        setInviteCodeInput('');
        return;
      }

      const { data, error } = await supabase.rpc('join_section_as_teacher', {
        invite: code,
      });

      if (error) throw error;

      toast.success('Joined section successfully! 👨‍🏫');
      
      await refreshProfile();
      refetchLinked();
      
      setShowJoinSectionDialog(false);
      setInviteCodeInput('');
      
      if (data) {
        setTimeout(() => {
          setShowLinkSubjectsSheet(true);
        }, 300);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to join section');
    } finally {
      setJoiningSection(false);
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
            {authUser?.branch && (
              <span className="badge badge-info">{authUser.branch}</span>
            )}
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
              ...(authUser?.branch ? [
                { label: 'Branch', value: authUser.branch }
              ] : []),
              { 
                label: 'Phone Number', 
                value: authUser?.phone ? `+91 ${authUser.phone}` : 'Not Provided',
                action: (
                  <button 
                    id="change-phone-btn" 
                    onClick={handleUpdatePhone} 
                    className="t-label" 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Change
                  </button>
                )
              },
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

        {/* Linked Courses (Teacher only) */}
        {role === 'teacher' && (
          <div>
            <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>LINKED COURSES</p>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myLinkedSubjects.length === 0 ? (
                <p className="t-caption" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                  No subjects linked to your account yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myLinkedSubjects.map((item: any) => {
                    const sub = item.subjects;
                    const sec = item.sections;
                    if (!sub) return null;
                    return (
                      <div key={item.subject_id + '-' + item.section_id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              padding: '1px 5px', borderRadius: 4, background: `${sub.accent}20`,
                              color: sub.accent, fontSize: 10, fontWeight: 600, fontFamily: 'monospace'
                            }}>{sub.code}</span>
                            <span className="badge badge-info" style={{ fontSize: 9, padding: '1px 6px' }}>{sec?.name || 'Unknown Section'}</span>
                          </div>
                          <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 4 }}>{sub.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  id="manage-linkings-btn"
                  onClick={() => setShowLinkSubjectsSheet(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    background: 'rgba(74, 158, 255, 0.06)',
                    border: '1px dashed rgba(74, 158, 255, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Plus size={14} />
                  <span>Link Subjects</span>
                </button>
                <button
                  id="join-section-profile-btn"
                  onClick={() => setShowJoinSectionDialog(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    background: 'rgba(74, 158, 255, 0.06)',
                    border: '1px dashed rgba(74, 158, 255, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Plus size={14} />
                  <span>Join Section</span>
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* More */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>MORE</p>
          <div className="card" style={{ padding: 0 }}>
            {/* Star on GitHub */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => window.open('https://github.com/Hanu2908/ClassHub', '_blank', 'noopener,noreferrer')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Star size={16} color="var(--text-primary)" />
                <span className="t-body" style={{ color: 'var(--text-primary)' }}>Star on GitHub</span>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Ko-fi Support */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', borderTop: '1px solid var(--border-default)' }}
              onClick={() => window.open('https://ko-fi.com/himanshuhanu', '_blank', 'noopener,noreferrer')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Heart size={16} color="#FF5E5B" />
                <span className="t-body" style={{ color: 'var(--text-primary)' }}>Support on Ko-fi</span>
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
            onClick={() => signOutGlobal(navigate)}
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
      {role === 'teacher' && authUser && sectionId && (
        <LinkSubjectsSheet
          open={showLinkSubjectsSheet}
          onClose={() => setShowLinkSubjectsSheet(false)}
          teacherId={authUser.id}
          sectionId={sectionId}
          linkedSubjects={myLinkedSubjects}
          refetchLinked={refetchLinked}
        />
      )}
      {showJoinSectionDialog && (
        <BottomSheet
          open={showJoinSectionDialog}
          onClose={() => { setShowJoinSectionDialog(false); setInviteCodeInput(''); }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} style={{ color: 'var(--accent-primary)' }} />
              <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Join New Section Hub</span>
            </div>
          }
        >
          <form onSubmit={handleJoinSection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Enter the Teacher Invite Code provided by the Class Representative (CR) of the section you want to join.
            </p>

            <div>
              <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Teacher Invite Code
              </label>
              <input
                type="text"
                placeholder="e.g. T-P2WXYZ"
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                className="input mono"
                maxLength={10}
                style={{
                  letterSpacing: inviteCodeInput ? '0.15em' : 'normal',
                  fontSize: inviteCodeInput ? '16px' : '13px',
                  textAlign: 'center',
                  minHeight: '44px',
                  padding: '8px 12px',
                }}
                required
                disabled={joiningSection}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowJoinSectionDialog(false); setInviteCodeInput(''); }}
                disabled={joiningSection}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={joiningSection || !inviteCodeInput.trim()}
              >
                {joiningSection ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Join
              </button>
            </div>
          </form>
        </BottomSheet>
      )}
    </div>
  );
}

interface LinkSubjectsSheetProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  sectionId: string;
  linkedSubjects: any[];
  refetchLinked: () => void;
}

function LinkSubjectsSheet({ open, onClose, teacherId, sectionId, linkedSubjects, refetchLinked }: LinkSubjectsSheetProps) {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [globalChecked, setGlobalChecked] = useState<Record<string, boolean>>({});

  const { data: sectionSubjects = [] } = useQuery({
    queryKey: ['subjects-for-linking', sectionId],
    queryFn: async () => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('section_id', sectionId)
        .order('code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId && open,
  });

  const handleToggleSubject = async (subjectId: string, subjectCode: string, currentLinked: boolean) => {
    setLoadingMap(prev => ({ ...prev, [subjectId]: true }));
    try {
      const applyAll = !!globalChecked[subjectId];

      if (currentLinked) {
        // Unlink
        // 1. Delete for current section
        const { error: delErr } = await supabase
          .from('section_teachers')
          .delete()
          .eq('section_id', sectionId)
          .eq('teacher_id', teacherId)
          .eq('subject_id', subjectId);
        if (delErr) throw delErr;

        // 2. If applyAll, find sections taught by teacher and delete subject with same code
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== sectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const matchSubjectIds = matchSubjects.map(ms => ms.id);
              await supabase
                .from('section_teachers')
                .delete()
                .eq('teacher_id', teacherId)
                .in('subject_id', matchSubjectIds);
            }
          }
        }
        toast.success('Subject unlinked ✓');
      } else {
        // Link
        // 1. Insert for current section
        const { error: insErr } = await supabase
          .from('section_teachers')
          .insert({
            section_id: sectionId,
            teacher_id: teacherId,
            subject_id: subjectId
          });
        if (insErr) throw insErr;

        // 2. If applyAll, find sections taught by teacher and insert subject with same code
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== sectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const insertRows = matchSubjects.map(ms => ({
                section_id: ms.section_id,
                teacher_id: teacherId,
                subject_id: ms.id
              }));
              await supabase.from('section_teachers').insert(insertRows);
            }
          }
        }
        toast.success('Subject linked ✓');
      }
      refetchLinked();
    } catch (err: any) {
      toast.error('Failed to link subject: ' + err.message);
    } finally {
      setLoadingMap(prev => ({ ...prev, [subjectId]: false }));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Link Subjects">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sectionSubjects.length === 0 ? (
          <p className="t-body" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
            No subjects found in this section.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
            {sectionSubjects.map(subject => {
              const isLinked = linkedSubjects.some(ls => ls.subject_id === subject.id);
              const isLoading = !!loadingMap[subject.id];
              const isGlobal = !!globalChecked[subject.id];

              return (
                <div key={subject.id} style={{
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: isLoading ? 0.6 : 1,
                  pointerEvents: isLoading ? 'none' : 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isLinked}
                      disabled={isLoading}
                      onChange={() => handleToggleSubject(subject.id, subject.code, isLinked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          padding: '1px 5px', borderRadius: 4, background: `${subject.accent}20`,
                          color: subject.accent, fontSize: 10, fontWeight: 600, fontFamily: 'monospace'
                        }}>{subject.code}</span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sem {subject.semester}</span>
                      </div>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>{subject.name}</p>
                    </div>
                  </div>

                  {isLinked && (
                    <div style={{
                      paddingTop: 6,
                      borderTop: '1px dashed var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isGlobal}
                          onChange={() => setGlobalChecked(prev => ({ ...prev, [subject.id]: !prev[subject.id] }))}
                          style={{ width: 13, height: 13, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                        />
                        <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Apply globally to all my sections</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%', padding: '12px' }}
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
