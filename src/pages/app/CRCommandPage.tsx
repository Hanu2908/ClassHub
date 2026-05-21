import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, Bell, Send,
  XCircle, ChevronDown, ChevronUp, BarChart2, Megaphone, BookOpen,
  CheckCircle2, ExternalLink, Copy, Share2, RefreshCw, Lock, Unlock, Loader2
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAssignments, useSectionMembers, useAssignmentSubmissions, useSection } from '../../hooks/useSupabaseQuery';
import type { SectionInfo } from '../../hooks/useSupabaseQuery';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>{title}</p>
      {count !== undefined ? (
        <span style={{
          font: '600 12px var(--font-mono)', color: 'var(--accent-primary)',
          background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        }}>
          {count}
        </span>
      ) : null}
    </div>
  );
}

// ── 1. Submission Tracker ─────────────────────────────────────────────────────
type SubFilter = 'submitted' | 'not_submitted';

function SubmissionTracker() {
  const { data: assignments = [] } = useAssignments({ limit: 200 });
  const { data: members = [] } = useSectionMembers();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>('not_submitted');
  const [hoveredCard, setHoveredCard] = useState<'submitted' | 'pending' | null>(null);
  const [expanded, setExpanded] = useState(true);

  const visible = assignments.filter(a => !isExpired(a.dueDate));
  const selected = visible.find(a => a.id === selectedAssignmentId) ?? visible[0];

  const { data: submissions = [], isLoading } = useAssignmentSubmissions(selected?.id ?? null);

  const submittedMembers = members.filter(m =>
    submissions.some(s => s.studentId === m.id && s.status === 'submitted')
  );
  const pendingMembers = members.filter(m =>
    !submissions.some(s => s.studentId === m.id && s.status === 'submitted')
  );

  const submittedCount = submittedMembers.length;
  const filtered = subFilter === 'submitted' ? submittedMembers : pendingMembers;

  const handleBulkNotify = async () => {
    if (pendingMembers.length === 0) {
      showToast('All students have submitted!', 'info');
      return;
    }
    if (!selected) return;
    showToast('Sending reminders...', 'info');
    try {
      const { data, error } = await supabase.functions.invoke('send-assignment-reminders', {
        body: { assignmentId: selected.id },
      });
      if (error) throw error;
      const { sent, failed } = data;
      if (sent === 0 && failed > 0) {
        showToast('Push delivery failed for all students', 'error');
      } else if (sent > 0 && failed > 0) {
        showToast(`Reminders sent to ${sent} students (${failed} failed)`, 'warning');
      } else if (sent > 0) {
        showToast(`Reminders sent to ${sent} students!`, 'success');
      } else {
        showToast('No pending students found', 'info');
      }
    } catch (err) {
      console.error('[Notify] Bulk remind failed:', err);
      showToast('Failed to send reminders', 'error');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <SectionHead
          icon={<ClipboardList size={16} color="var(--accent-primary)" />}
          title="Submission Tracker"
          count={visible.length > 0 ? pendingMembers.length : undefined}
        />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <>
          {/* Assignment picker */}
          {visible.length > 0 ? (
            <>
              <select
                id="cr-assign-select"
                value={selected?.id ?? ''}
                onChange={e => setSelectedAssignmentId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', marginBottom: 12,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  font: '400 13px var(--font-body)', outline: 'none',
                }}
              >
                {visible.map(a => (
                  <option key={a.id} value={a.id}>{a.title} — {a.subject}</option>
                ))}
              </select>

              {/* Summary bar / Interactive Cards */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div
                  id="cr-tab-submitted"
                  onClick={() => setSubFilter('submitted')}
                  onMouseEnter={() => setHoveredCard('submitted')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: subFilter === 'submitted'
                      ? 'rgba(52,201,123,0.15)'
                      : (hoveredCard === 'submitted' ? 'rgba(52,201,123,0.08)' : 'rgba(52,201,123,0.03)'),
                    border: subFilter === 'submitted'
                      ? '1px solid var(--status-safe)'
                      : '1px solid rgba(52,201,123,0.15)',
                    textAlign: 'center',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: subFilter === 'submitted' || hoveredCard === 'submitted' ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: subFilter === 'submitted'
                      ? '0 6px 16px rgba(52,201,123,0.15)'
                      : (hoveredCard === 'submitted' ? '0 4px 10px rgba(52,201,123,0.06)' : 'none'),
                    userSelect: 'none',
                  }}
                >
                  <p style={{ font: '700 20px var(--font-display)', color: 'var(--status-safe)', transition: 'transform 0.2s' }}>
                    {submittedCount}
                  </p>
                  <p style={{ font: '600 11px var(--font-body)', color: subFilter === 'submitted' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    ✓ Submitted
                  </p>
                </div>

                <div
                  id="cr-tab-pending"
                  onClick={() => setSubFilter('not_submitted')}
                  onMouseEnter={() => setHoveredCard('pending')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: subFilter === 'not_submitted'
                      ? 'rgba(255,68,68,0.12)'
                      : (hoveredCard === 'pending' ? 'rgba(255,68,68,0.06)' : 'rgba(255,68,68,0.02)'),
                    border: subFilter === 'not_submitted'
                      ? '1px solid var(--status-critical)'
                      : '1px solid rgba(255,68,68,0.15)',
                    textAlign: 'center',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: subFilter === 'not_submitted' || hoveredCard === 'pending' ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: subFilter === 'not_submitted'
                      ? '0 6px 16px rgba(255,68,68,0.12)'
                      : (hoveredCard === 'pending' ? '0 4px 10px rgba(255,68,68,0.04)' : 'none'),
                    userSelect: 'none',
                  }}
                >
                  <p style={{ font: '700 20px var(--font-display)', color: 'var(--status-critical)', transition: 'transform 0.2s' }}>
                    {pendingMembers.length}
                  </p>
                  <p style={{ font: '600 11px var(--font-body)', color: subFilter === 'not_submitted' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    ✗ Pending
                  </p>
                </div>
              </div>

              {subFilter === 'not_submitted' && pendingMembers.length > 0 ? (
                <button
                  onClick={handleBulkNotify}
                  style={{
                    width: '100%', padding: '10px', marginBottom: 10,
                    background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)',
                    borderRadius: 8, color: 'var(--accent-primary)', font: '600 13px var(--font-body)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <Bell size={14} /> Notify Pending Students
                </button>
              ) : null}

              {/* Student list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {isLoading ? (
                  <p style={{ textAlign: 'center', padding: '16px', font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>
                    Loading submissions...
                  </p>
                ) : filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '16px', font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>
                    No students in this list
                  </p>
                ) : filtered.map(st => {
                  const subRecord = submissions.find(s => s.studentId === st.id);
                  return (
                    <div key={st.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8,
                      background: subFilter === 'submitted' ? 'rgba(52,201,123,0.04)' : 'rgba(255,68,68,0.04)',
                      border: subFilter === 'submitted' ? '1px solid rgba(52,201,123,0.12)' : '1px solid rgba(255,68,68,0.12)',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ font: '600 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.classRoll ?? '—'}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>{st.name}</p>
                        <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.universityRoll ?? ''}</p>
                      </div>
                      
                      {subFilter === 'submitted' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {subRecord?.submissionLink && (
                            <a
                              href={subRecord.submissionLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                              title="View Submission Link"
                            >
                              <ExternalLink size={14} color="var(--accent-primary)" />
                            </a>
                          )}
                          <CheckCircle2 size={16} color="var(--status-safe)" />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={async () => {
                              showToast(`Nudging ${st.name}...`, 'info');
                              try {
                                const { error } = await supabase.functions.invoke('send-assignment-reminders', {
                                  body: { assignmentId: selected?.id, studentId: st.id },
                                });
                                if (error) throw error;
                                showToast(`Nudged ${st.name}!`, 'success');
                              } catch (err) {
                                console.error('[Notify] Nudge failed:', err);
                                showToast('Failed to nudge', 'error');
                              }
                            }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title={`Nudge ${st.name}`}
                          >
                            <Bell size={14} color="var(--accent-primary)" />
                          </button>
                          <XCircle size={16} color="var(--status-critical)" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: '20px', font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>
              No active assignments
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

// ── 2. Class Attendance Overview ──────────────────────────────────────────────
function ClassAttendance() {
  const { data: members = [] } = useSectionMembers();
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setExpanded(e => !e)}>
          <SectionHead icon={<Users size={16} color="var(--accent-primary)" />} title="Section Members" count={members.length} />
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {expanded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            {members.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>No members in section</p>
            ) : members.map(st => (
              <div
                key={st.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-muted)' }}>{st.classRoll ?? '—'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>{st.name}</p>
                  <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.email}</p>
                </div>
                <span className={`badge ${st.role === 'cr' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 10 }}>
                  {st.role === 'cr' ? 'CR' : 'Student'}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function SendNotificationSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { data: section } = useSection();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    font: '400 14px var(--font-body)', outline: 'none',
  };

  const handleSend = async () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!body.trim())  { showToast('Message body is required', 'error'); return; }
    if (!section?.id) return;
    setSending(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const { data: ann, error: annErr } = await supabase
        .from('announcements')
        .insert({
          title: title.trim(),
          message_content: body.trim(),
          priority: 'critical',
          section_id: section.id,
          author_id: user.id,
        })
        .select('id')
        .single();

      if (annErr) throw annErr;

      const { data: pushData, error: pushErr } = await supabase.functions.invoke('send-critical-announcement', {
        body: { announcementId: ann.id },
      });

      if (pushErr) {
        console.error('[Notify] Push failed but announcement created:', pushErr);
        showToast('Announcement posted! Push delivery failed.', 'warning');
      } else if (pushData) {
        const { sent, failed } = pushData;
        if (sent === 0 && failed > 0) {
          showToast('Announcement posted! Push delivery failed for all.', 'warning');
        } else if (sent > 0 && failed > 0) {
          showToast(`Announcement posted! Push sent to ${sent} (${failed} failed).`, 'success');
        } else if (sent > 0) {
          showToast(`Announcement posted! Push sent to ${sent} students.`, 'success');
        } else {
          showToast('Announcement posted! (No active subscriptions found)', 'success');
        }
      } else {
        showToast('Critical announcement posted and pushed!', 'success');
      }
      onClose();
    } catch (err) {
      console.error('[Notify] Send failed:', err);
      showToast('Failed to send notification', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Send Notification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input id="notif-title" style={inputStyle} placeholder="e.g. Important update" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea id="notif-body" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Write your message to the class…" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <button
          id="send-notif-btn"
          onClick={handleSend}
          disabled={sending}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: sending ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: sending ? 'not-allowed' : 'pointer',
            font: '600 14px var(--font-body)', color: sending ? 'var(--text-muted)' : '#fff',
            transition: 'all 0.2s', marginTop: 10
          }}
        >
          <Send size={15} /> {sending ? 'Sending…' : 'Send Notification'}
        </button>
      </div>
    </BottomSheet>
  );
}

function randomAlpha(n: number) {
  return Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
}

// ── Invite Code Card ──
function InviteCodeCard() {
  const { data: section } = useSection();
  const queryClient = useQueryClient();
  const [obscured, setObscured] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  const inviteCode = section?.inviteCode || '......';

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    showToast('Invite code copied to clipboard!', 'success');
  };

  const shareCode = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join ClassHub!',
          text: `Use this invite code to join Section ${section?.name || ''} on ClassHub: ${inviteCode}`,
        });
      } else {
        throw new Error('Not supported');
      }
    } catch {
      copyCode();
    }
  };

  const rotateCode = async () => {
    if (!section?.id) return;
    setRotating(true);
    try {
      const prefix = inviteCode.slice(0, 2) || 'P2';
      const newCode = prefix + randomAlpha(4);

      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        showToast(`[Demo] Invite code rotated to ${newCode}!`, 'success');
        queryClient.setQueryData(['section', section.id], (prev: SectionInfo | null | undefined) => prev ? { ...prev, inviteCode: newCode } : prev);
        setConfirmOpen(false);
        return;
      }

      const { error } = await supabase
        .from('sections')
        .update({ invite_code: newCode })
        .eq('id', section.id);

      if (error) throw error;

      showToast(`Invite code rotated to ${newCode}!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['section', section.id] });
      setConfirmOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rotate invite code';
      showToast(message, 'error');
    } finally {
      setRotating(false);
    }
  };

  return (
    <>
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.05) 0%, rgba(20, 23, 32, 0.8) 100%)',
        border: '1px solid var(--border-default)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Lock size={16} color="var(--accent-primary)" />
          </div>
          <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>
            Section Invite Code
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginTop: 4,
        }}>
          <span style={{
            font: '700 22px var(--font-mono)',
            letterSpacing: '0.12em',
            color: obscured ? 'var(--text-muted)' : 'var(--accent-primary)',
            transition: 'color 0.2s',
          }}>
            {obscured ? '••••••' : inviteCode}
          </span>
          <button
            onClick={() => setObscured(!obscured)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 6, display: 'flex',
            }}
            title={obscured ? "Show Invite Code" : "Hide Invite Code"}
          >
            {obscured ? <Unlock size={16} /> : <Lock size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button 
            className="btn-secondary" 
            onClick={copyCode} 
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, minHeight: 'fit-content' }}
          >
            <Copy size={14} /> Copy
          </button>
          <button 
            className="btn-secondary" 
            onClick={shareCode} 
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, minHeight: 'fit-content' }}
          >
            <Share2 size={14} /> Share
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setConfirmOpen(true)}
            style={{ 
              padding: '8px 12px', 
              fontSize: 13, 
              minHeight: 'fit-content', 
              borderColor: 'rgba(255, 68, 68, 0.25)', 
              background: 'rgba(255, 68, 68, 0.02)',
              color: 'var(--status-critical)' 
            }}
          >
            <RefreshCw size={14} /> Rotate
          </button>
        </div>
      </div>

      {confirmOpen && (
        <BottomSheet onClose={() => setConfirmOpen(false)} title="Rotate Invite Code?">
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
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <div>
                <p style={{ font: '600 13px var(--font-display)', color: 'var(--status-critical)', marginBottom: 3 }}>
                  WARNING: Permanent Invalidation
                </p>
                <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  This will immediately invalidate the current code. Existing members will remain unaffected, but new students must use the new code to join.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmOpen(false)} 
                style={{ flex: 1, minHeight: 48 }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={rotateCode} 
                disabled={rotating}
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)', 
                  boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
                  minHeight: 48,
                }}
              >
                {rotating ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Rotate Code'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function CRCommandPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const [showNotifSheet, setShowNotifSheet] = useState(!!location.state?.openBroadcast);

  useEffect(() => {
    if (location.state?.openBroadcast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openBroadcast, navigate, location.pathname]);

  // Guard: non-CRs sent home
  if (role !== 'cr') {
    navigate('/app/home', { replace: true });
    return null;
  }

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
            <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>CR Command Center</h1>
          </div>
        </div>
        <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-muted)', paddingLeft: 34 }}>
          Manage submissions, attendance & notifications
        </p>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InviteCodeCard />
        
        {/* Quick Actions */}
        <section>
          <p style={{ font: '600 13px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>QUICK ACTIONS</p>
          <div className="carousel" style={{ paddingBottom: 4 }}>
            <button className="card" onClick={() => navigate('/app/polls', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <BarChart2 size={16} color="var(--status-info)" />
              <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Create Poll</span>
            </button>
            <button className="card" onClick={() => navigate('/app/announcements', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <Megaphone size={16} color="var(--status-warning)" />
              <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Announcement</span>
            </button>
            <button className="card" onClick={() => setShowNotifSheet(true)} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <Bell size={16} color="var(--status-critical)" />
              <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Notification</span>
            </button>
            <button className="card" onClick={() => navigate('/app/assignments', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <ClipboardList size={16} color="var(--status-safe)" />
              <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Add Assignment</span>
            </button>
            <button className="card" onClick={() => navigate('/app/cr/subjects')} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <BookOpen size={16} color="#c084fc" />
              <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Subjects</span>
            </button>
          </div>
        </section>

        <SubmissionTracker />
        <ClassAttendance />

        {/* Danger Zone */}
        <section style={{ marginTop: 16 }}>
          <p style={{ font: '600 13px var(--font-mono)', color: 'var(--status-critical)', marginBottom: 8, letterSpacing: '0.04em' }}>DANGER ZONE</p>
          <div style={{
            padding: 16, borderRadius: 'var(--radius-lg)',
            background: 'rgba(255,68,68,0.04)',
            border: '1px dashed rgba(255,68,68,0.3)',
            display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>Delete Section Hub</p>
                <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)' }}>Permanently remove this hub, all students, and data.</p>
              </div>
              <button
                onClick={() => showToast('Section deletion coming soon', 'info')}
                style={{
                  background: 'rgba(255,68,68,0.1)', color: 'var(--status-critical)',
                  border: '1px solid rgba(255,68,68,0.25)', padding: '8px 12px',
                  borderRadius: 'var(--radius-md)', font: '600 13px var(--font-body)',
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

      {showNotifSheet ? <SendNotificationSheet onClose={() => setShowNotifSheet(false)} /> : null}

      <NavBar />
    </div>
  );
}
