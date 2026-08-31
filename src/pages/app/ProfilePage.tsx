import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Bell, Trash2, Download, Calculator, AlertTriangle, LogOut, ExternalLink, MessageSquare, Calendar, Plus, Users, Mail, Loader2, Heart, Star, BookOpen, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '../../components/NavBar';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import { useSection, useSectionMembers } from '../../hooks/useSectionMembers';
import { supabase } from '../../lib/supabase';
import { isPushSupported, getPushPermission, hasActiveSubscription, subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { signOutGlobal } from '../../components/AuthProvider';
import { useUserTags, useDeleteTag, MAX_ACTIVE_TAGS } from '../../hooks/useUserTags';
import { TagPill } from '../../components/TagPill';
import { AddTagSheet } from '../../components/AddTagSheet';
import { BottomSheet } from '../../components/BottomSheet';
import { CopyButton } from '../../components/CopyButton';
import { logEvent } from '../../lib/analytics';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { authUser, role, hub, clearHubState, deferredPrompt, setDeferredPrompt, refreshProfile } = useAppStore();
  const { data: section } = useSection();
  const { data: members = [] } = useSectionMembers();

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
  const [showDangerZone, setShowDangerZone] = useState(false);
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
      clearHubState(); // reset local Zustand hub/offlineCache state only
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
              <span className="t-mono" style={{ color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span>Roll {classRoll}</span>
                {classRoll && classRoll !== '—' && (
                  <CopyButton
                    text={classRoll}
                    ariaLabel="Copy class roll number"
                    successMessage="Class roll number copied!"
                    iconSize={11}
                  />
                )}
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
                <AnimatePresence mode="popLayout">
                  {myTags.map(tag => (
                    <motion.div
                      key={tag.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TagPill
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
                    </motion.div>
                  ))}
                </AnimatePresence>
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

        {/* 1. ACADEMIC & HUB */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
            <p className="t-label" style={{ color: 'var(--text-muted)', margin: 0 }}>ACADEMIC & HUB</p>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {/* Hub Header Info & Code */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 className="t-card-title" style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      {sectionName || 'Class Hub'}
                    </h3>
                  </div>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {authUser?.branch ? `${authUser.branch} • ` : ''}{institution}
                  </p>
                </div>

                {/* Hub Code with Copy */}
                <CopyButton
                  text={hubCode}
                  label={hubCode}
                  ariaLabel="Copy Hub Code"
                  successMessage="Hub code copied!"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0
                  }}
                />
              </div>

              {/* Side-by-side action tiles (Directory & Curriculum) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  id="view-members-btn"
                  onClick={() => navigate('/app/members')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74, 158, 255, 0.4)'; e.currentTarget.style.background = 'rgba(74, 158, 255, 0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-primary-glow)',
                      border: '1px solid rgba(74, 158, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)',
                      flexShrink: 0
                    }}>
                      <Users size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Directory
                      </p>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>
                        {members.length > 0 ? `${members.filter(m => m.role !== 'teacher').length} members` : 'Section roster'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </button>

                <button
                  id="view-subjects-profile-btn"
                  onClick={() => navigate('/app/cr/subjects')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)'; e.currentTarget.style.background = 'rgba(167, 139, 250, 0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(167, 139, 250, 0.15)',
                      border: '1px solid rgba(167, 139, 250, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#A78BFA',
                      flexShrink: 0
                    }}>
                      <BookOpen size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Curriculum
                      </p>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>
                        Subjects & labs
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </button>
              </div>
            </div>

            {/* Academic & Preference Rows */}
            <div style={{ borderTop: '1px solid var(--border-default)' }}>
              {role !== 'teacher' && (
                <>
                  {/* Batch Assignment */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
                  }}>
                    <div>
                      <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Batch Assignment</p>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Practical lab subgroup</p>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 14, padding: 2, border: '1px solid var(--border-default)' }}>
                      <button 
                        id="batch-g1-btn" 
                        onClick={() => subBatch !== '1' && handleToggleBatch()}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: '12px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: subBatch === '1' ? 'var(--accent-primary)' : 'transparent',
                          color: subBatch === '1' ? '#fff' : 'var(--text-muted)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        G1
                      </button>
                      <button 
                        id="batch-g2-btn" 
                        onClick={() => subBatch !== '2' && handleToggleBatch()}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: '12px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: subBatch === '2' ? 'var(--accent-primary)' : 'transparent',
                          color: subBatch === '2' ? '#fff' : 'var(--text-muted)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        G2
                      </button>
                    </div>
                  </div>

                  {/* Commute Status */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
                  }}>
                    <div>
                      <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Commute Status</p>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Transit mode filter</p>
                    </div>
                    <button 
                      id="toggle-commute-status" 
                      onClick={handleToggleCommuterStatus} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid var(--border-default)',
                        background: authUser?.dayScholar ? 'rgba(96, 165, 250, 0.12)' : 'rgba(167, 139, 250, 0.12)',
                        color: authUser?.dayScholar ? '#60A5FA' : '#A78BFA',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <span>{authUser?.dayScholar ? '🚌 Day Scholar' : '🏠 Hosteller'}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▾</span>
                    </button>
                  </div>

                  {/* Registered Phone */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
                  }}>
                    <div>
                      <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Registered Phone</p>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Contact number for section</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="t-mono" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                        {authUser?.phone ? `+91 ${authUser.phone}` : 'Not Provided'}
                      </span>
                      <button 
                        id="change-phone-btn" 
                        onClick={handleUpdatePhone} 
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--accent-primary)',
                          padding: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Change Phone Number"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* University Roll */}
              {role !== 'teacher' && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderBottom: counsellor ? '1px solid var(--border-default)' : 'none',
                }}>
                  <span className="t-body" style={{ color: 'var(--text-secondary)' }}>University Roll</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {universityRoll || '—'}
                    </span>
                    {universityRoll && universityRoll !== '—' && (
                      <CopyButton
                        text={universityRoll}
                        ariaLabel="Copy university roll number"
                        successMessage="University roll copied!"
                        iconSize={12}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Batch Counsellor Row */}
              {counsellor && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                }}>
                  <div>
                    <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>
                      Batch Counsellor
                    </p>
                    <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>
                      {counsellor.name} ({sectionName || ''}{subBatch})
                    </p>
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
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--accent-primary)',
                      padding: '6px 12px',
                      fontWeight: 600,
                      fontSize: '11.5px',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Mail size={13} /> Contact
                  </a>
                </div>
              )}
            </div>
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
                              color: sub.accent, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)'
                            }}>{sub.code}</span>
                            <span className="badge badge-info" style={{ fontSize: 12, padding: '1px 6px' }}>{sec?.name || 'Unknown Section'}</span>
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

        {/* 2. QUICK TOOLS */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>TOOLS</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 2-Column Interactive Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}>
              {/* Tool 1: CGPA Calculator */}
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

              {/* Tool 2: Exams Hub */}
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

              {/* Tool 3: Resource Hub */}
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

              {/* Tool 4: SKIT Exam Portal */}
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

            {/* Developer Console (Highlighted row for developers) */}
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

        {/* 3. PREFERENCES & ACCOUNT */}
        <div>
          <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>PREFERENCES & ACCOUNT</p>
          
          <div className="card" style={{ padding: 0 }}>
            {/* PWA Install Banner if Available */}
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

            {/* Collapsible Danger Zone Toggle */}
            <div style={{ borderTop: '1px solid var(--border-default)' }}>
              <button
                type="button"
                className="settings-danger-toggle"
                onClick={() => setShowDangerZone(prev => !prev)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={15} color="var(--text-muted)" />
                  <span className="t-caption" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Danger Zone Options
                  </span>
                </div>
                <ChevronDown
                  size={15}
                  color="var(--text-muted)"
                  style={{
                    transform: showDangerZone ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition-fast)'
                  }}
                />
              </button>

              {showDangerZone && (
                <div style={{ padding: 16, background: 'rgba(255, 68, 68, 0.05)', borderTop: '1px solid rgba(255, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              )}
            </div>
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
                          color: subject.accent, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)'
                        }}>{subject.code}</span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sem {subject.semester}</span>
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
                        <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Apply globally to all my sections</span>
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
