import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, Bell, Send,
  XCircle, ChevronDown, ChevronUp, BarChart2, Megaphone, BookOpen,
  CheckCircle2, ExternalLink
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAssignments, useSectionMembers, useAssignmentSubmissions } from '../../hooks/useSupabaseQuery';

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
  const { data: assignments = [] } = useAssignments();
  const { data: members = [] } = useSectionMembers();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>('not_submitted');
  const [expanded, setExpanded] = useState(true);
  const addNotification = useAppStore(s => s.addNotification);

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

  const handleBulkNotify = () => {
    if (pendingMembers.length === 0) {
      showToast('All students have submitted!', 'info');
      return;
    }
    // Bulk notify
    pendingMembers.forEach(st => {
      addNotification({
        title: `Pending: ${selected?.title}`,
        body: `Hi ${st.name}, please complete and submit your assignment for ${selected?.subject} before the deadline.`,
        type: 'assignment'
      });
    });
    showToast(`Reminders sent to ${pendingMembers.length} pending students!`, 'success');
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

              {/* Summary bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(52,201,123,0.08)', border: '1px solid rgba(52,201,123,0.2)',
                  textAlign: 'center',
                }}>
                  <p style={{ font: '700 18px var(--font-display)', color: 'var(--status-safe)' }}>{submittedCount}</p>
                  <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)' }}>Submitted</p>
                </div>
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)',
                  textAlign: 'center',
                }}>
                  <p style={{ font: '700 18px var(--font-display)', color: 'var(--status-critical)' }}>{pendingMembers.length}</p>
                  <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)' }}>Pending</p>
                </div>
              </div>

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['submitted', 'not_submitted'] as SubFilter[]).map(f => (
                  <button
                    key={f}
                    id={`sub-filter-${f}`}
                    onClick={() => setSubFilter(f)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: 8,
                      background: subFilter === f
                        ? (f === 'submitted' ? 'rgba(52,201,123,0.15)' : 'rgba(255,68,68,0.12)')
                        : 'var(--bg-elevated)',
                      border: `1px solid ${subFilter === f
                        ? (f === 'submitted' ? 'rgba(52,201,123,0.4)' : 'rgba(255,68,68,0.3)')
                        : 'var(--border-default)'}`,
                      color: subFilter === f
                        ? (f === 'submitted' ? 'var(--status-safe)' : 'var(--status-critical)')
                        : 'var(--text-muted)',
                      font: '600 11px var(--font-body)', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {f === 'submitted' ? `✓ Submitted (${submittedCount})` : `✗ Pending (${pendingMembers.length})`}
                  </button>
                ))}
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
                            onClick={() => {
                              addNotification({
                                title: `Reminder: ${selected?.title}`,
                                body: `Hi ${st.name}, please complete and submit the assignment for ${selected?.subject} as soon as possible.`,
                                type: 'assignment'
                              });
                              showToast(`Nudged ${st.name}!`, 'success');
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
  const { addNotification } = useAppStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    font: '400 14px var(--font-body)', outline: 'none',
  };

  const handleSend = () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!body.trim())  { showToast('Message body is required', 'error'); return; }
    setSending(true);
    setTimeout(() => {
      addNotification({ title: title.trim(), body: body.trim(), type: 'cr_broadcast' });
      showToast('Notification sent to all students', 'success');
      setSending(false);
      onClose();
    }, 600);
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

// ── Page shell ────────────────────────────────────────────────────────────────
export default function CRCommandPage() {
  const navigate = useNavigate();
  const role = useAppStore(s => s.role);
  const [showNotifSheet, setShowNotifSheet] = useState(false);

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
