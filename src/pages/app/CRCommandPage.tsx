import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, Bell, Send,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, BarChart2, Megaphone,
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import { mockStudents, mockClassAttendance, mockSubmissions } from '../../data/mockData';
import { showToast } from '../../components/Toast';
import { DonutRing } from '../../components/Shared';

// ── Attendance color helper ───────────────────────────────────────────────────
function attendColor(pct: number) {
  const r = Math.round(pct);
  if (r >= 85) return 'var(--status-safe)';
  if (r >= 75) return 'var(--status-warning)';
  return 'var(--status-critical)';
}

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
      {count !== undefined && (
        <span style={{
          font: '600 12px var(--font-mono)', color: 'var(--accent-primary)',
          background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── 1. Submission Tracker ─────────────────────────────────────────────────────
type SubFilter = 'submitted' | 'not_submitted';

function SubmissionTracker() {
  const assignments = useAppStore(s => s.assignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>('not_submitted');
  const [expanded, setExpanded] = useState(true);

  const studentSubmissions = useAppStore(s => s.studentSubmissions);
  const toggleStudentSubmission = useAppStore(s => s.toggleStudentSubmission);
  const addNotification = useAppStore(s => s.addNotification);

  const visible = assignments.filter(a => !isExpired(a.dueDate));
  const selected = visible.find(a => a.id === selectedAssignmentId) ?? visible[0];

  const submittedIds = new Set<string>(
    selectedAssignmentId
      ? (studentSubmissions[selectedAssignmentId] ?? mockSubmissions[selectedAssignmentId] ?? [])
      : (studentSubmissions[selected?.id ?? ''] ?? mockSubmissions[selected?.id ?? ''] ?? [])
  );

  const filtered = mockStudents.filter(s =>
    subFilter === 'submitted'
      ? submittedIds.has(s.id)
      : !submittedIds.has(s.id)
  );

  const submittedCount = mockStudents.filter(s => submittedIds.has(s.id)).length;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <SectionHead
          icon={<ClipboardList size={16} color="var(--accent-primary)" />}
          title="Submission Tracker"
          count={submittedCount}
        />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded && (
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
                  <p style={{ font: '700 18px var(--font-display)', color: 'var(--status-critical)' }}>{mockStudents.length - submittedCount}</p>
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
                    {f === 'submitted' ? `✓ Submitted (${submittedCount})` : `✗ Pending (${mockStudents.length - submittedCount})`}
                  </button>
                ))}
              </div>

              {subFilter === 'not_submitted' && filtered.length > 0 && (
                <button
                  onClick={() => {
                    addNotification({
                      title: `Incomplete: ${selected?.title}`,
                      body: `Please complete and submit the assignment for ${selected?.subject} before the deadline.`,
                      type: 'assignment'
                    });
                    showToast('Notification sent to pending students', 'success');
                  }}
                  style={{
                    width: '100%', padding: '10px', marginBottom: 10,
                    background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)',
                    borderRadius: 8, color: 'var(--accent-primary)', font: '600 13px var(--font-body)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <Bell size={14} /> Notify Pending Students
                </button>
              )}

              {/* Student list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '16px', font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>
                    No students in this category
                  </p>
                ) : filtered.map(st => {
                  const submitted = submittedIds.has(st.id);
                  return (
                    <div key={st.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8,
                      background: submitted ? 'rgba(52,201,123,0.05)' : 'rgba(255,68,68,0.04)',
                      border: `1px solid ${submitted ? 'rgba(52,201,123,0.15)' : 'rgba(255,68,68,0.12)'}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ font: '600 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.classRoll}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>{st.name}</p>
                        <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.universityRoll}</p>
                      </div>
                      {submitted ? (
                        <button onClick={() => selected && toggleStudentSubmission(selected.id, st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <CheckCircle2 size={16} color="var(--status-safe)" />
                        </button>
                      ) : (
                        <button onClick={() => selected && toggleStudentSubmission(selected.id, st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <XCircle size={16} color="var(--status-critical)" />
                        </button>
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
      )}
    </div>
  );
}

// ── 2. Class Attendance Overview ──────────────────────────────────────────────
function ClassAttendance() {
  const [expanded, setExpanded] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);

  const selectedRecord = selectedStudentId
    ? mockClassAttendance.find(r => r.studentId === selectedStudentId) ?? null
    : null;
  const selectedStudent = selectedStudentId
    ? mockStudents.find(s => s.id === selectedStudentId) ?? null
    : null;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setExpanded(e => !e)}>
          <SectionHead icon={<Users size={16} color="var(--accent-primary)" />} title="Class Attendance" count={mockStudents.length} />
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 4 }}>
              <button 
                onClick={() => setSortAsc(prev => prev === null ? true : prev ? false : null)}
                style={{ 
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer', padding: '4px 10px',
                  font: '500 11px var(--font-body)', color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                Sort: {sortAsc === null ? 'Default' : sortAsc ? 'Lowest %' : 'Highest %'}
              </button>
            </div>
            {[...mockStudents].sort((a, b) => {
              if (sortAsc === null) return 0;
              const aPct = mockClassAttendance.find(r => r.studentId === a.id)?.overall ?? 0;
              const bPct = mockClassAttendance.find(r => r.studentId === b.id)?.overall ?? 0;
              return sortAsc ? aPct - bPct : bPct - aPct;
            }).map(st => {
              const rec = mockClassAttendance.find(r => r.studentId === st.id);
              const pct = rec?.overall ?? 0;
              const color = attendColor(pct);
              return (
                <div
                  key={st.id}
                  onClick={() => setSelectedStudentId(st.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-muted)' }}>{st.classRoll}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>{st.name}</p>
                    <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)' }}>{st.universityRoll}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ font: '700 14px var(--font-mono)', color }}>{pct.toFixed(0)}%</span>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subject-wise sheet */}
      {selectedStudent && selectedRecord && (
        <BottomSheet
          onClose={() => setSelectedStudentId(null)}
          title={`${selectedStudent.name} — Attendance`}
        >
          <div style={{ paddingBottom: 20 }}>
            {/* Overall donut */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 4px 20px', borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
              <DonutRing percentage={selectedRecord.overall} size={64}>
                <span style={{ font: '700 13px var(--font-mono)', color: attendColor(selectedRecord.overall) }}>
                  {selectedRecord.overall.toFixed(0)}%
                </span>
              </DonutRing>
              <div>
                <p style={{ font: '600 16px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>{selectedStudent.name}</p>
                <p style={{ font: '400 12px var(--font-mono)', color: 'var(--text-muted)' }}>Roll #{selectedStudent.classRoll} · {selectedStudent.universityRoll}</p>
                <p style={{ font: '500 12px var(--font-body)', color: attendColor(selectedRecord.overall), marginTop: 4 }}>
                  {selectedRecord.overall >= 85 ? 'Safe attendance' : selectedRecord.overall >= 75 ? 'Caution zone' : 'Danger — below 75%'}
                </p>
              </div>
            </div>

            {/* Per-subject list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRecord.subjects.map(sub => {
                const color = attendColor(sub.percentage);
                const barW = `${Math.round(sub.percentage)}%`;
                return (
                  <div key={sub.code} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>{sub.name}</p>
                        <p style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)' }}>{sub.code} · {sub.type}</p>
                      </div>
                      <span style={{ font: '700 14px var(--font-mono)', color }}>{sub.percentage.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: barW, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

function SendNotificationSheet({ onClose }: { onClose: () => void }) {
  const { addNotification } = useAppStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    font: '400 14px var(--font-body)', outline: 'none',
  };

  const handleSend = () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!body.trim())  { showToast('Message body is required', 'error'); return; }
    if (target === 'selected' && selectedIds.size === 0) { showToast('Select at least one student', 'error'); return; }
    setSending(true);
    setTimeout(() => {
      addNotification({ title: title.trim(), body: body.trim(), type: 'cr_broadcast' });
      showToast(target === 'all' ? 'Notification sent to all students' : `Notification sent to ${selectedIds.size} students`, 'success');
      setSending(false);
      onClose();
    }, 600);
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <BottomSheet onClose={onClose} title="Send Notification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input
            id="notif-title"
            style={inputStyle}
            placeholder="e.g. Important update"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea
            id="notif-body"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            placeholder="Write your message to the class…"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Recipients</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setTarget('all')}
              style={{
                flex: 1, padding: '8px', borderRadius: 'var(--radius-md)',
                background: target === 'all' ? 'rgba(74,158,255,0.1)' : 'var(--bg-elevated)',
                border: `1px solid ${target === 'all' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                color: target === 'all' ? 'var(--accent-primary)' : 'var(--text-muted)',
                font: '500 13px var(--font-body)'
              }}
            >All Students</button>
            <button
              onClick={() => setTarget('selected')}
              style={{
                flex: 1, padding: '8px', borderRadius: 'var(--radius-md)',
                background: target === 'selected' ? 'rgba(74,158,255,0.1)' : 'var(--bg-elevated)',
                border: `1px solid ${target === 'selected' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                color: target === 'selected' ? 'var(--accent-primary)' : 'var(--text-muted)',
                font: '500 13px var(--font-body)'
              }}
            >Select Specific</button>
          </div>

          {target === 'selected' && (
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 8 }}>
              {mockStudents.map(st => (
                <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedIds.has(st.id)} onChange={() => toggleStudent(st.id)} />
                  <span style={{ font: '400 13px var(--font-body)', color: 'var(--text-primary)' }}>{st.name} ({st.classRoll})</span>
                </label>
              ))}
            </div>
          )}
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
          </div>
        </section>

        <SubmissionTracker />
        <ClassAttendance />
        {/* Bottom padding for navbar */}
        <div style={{ height: 8 }} />
      </main>

      {showNotifSheet && <SendNotificationSheet onClose={() => setShowNotifSheet(false)} />}

      <NavBar />
    </div>
  );
}
