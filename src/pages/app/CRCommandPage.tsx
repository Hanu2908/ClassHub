import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, Bell, Send,
  XCircle, ChevronDown, ChevronUp, BarChart2, Megaphone, BookOpen,
  CheckCircle2, ExternalLink, Copy, Share2, RefreshCw, Lock, Unlock, Loader2,
  AlertTriangle, Trash2
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAssignments, useSectionMembers, useAssignmentSubmissions, useSection, useSectionAttendance } from '../../hooks/useSupabaseQuery';
import type { SectionInfo } from '../../hooks/useSupabaseQuery';
import { useCRToggleSubmission, useCreateAnnouncement } from '../../hooks/useSupabaseMutations';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { SubmissionsSkeleton } from '../../components/LoadingSkeletons';

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <p className="t-card-title" style={{ color: 'var(--text-primary)', flex: 1 }}>{title}</p>
      {count !== undefined ? (
        <span className="t-mono" style={{
          color: 'var(--accent-primary)',
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
  const [expanded, setExpanded] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);

  const visible = assignments.filter(a => !isExpired(a.dueDate));
  const selected = visible.find(a => a.id === selectedAssignmentId) ?? visible[0];

  const { data: submissions = [], isLoading } = useAssignmentSubmissions(selected?.id ?? null);
  const crToggle = useCRToggleSubmission();

  // CR tracker uses cr_verified (CR's own mark), not student's self-reported status
  const submittedMembers = members.filter(m =>
    submissions.some(s => s.studentId === m.id && s.crVerified === true)
  );
  const pendingMembers = members.filter(m =>
    !submissions.some(s => s.studentId === m.id && s.crVerified === true)
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
    <div className="card" style={{ padding: 0 }}>
      <div 
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => { setHeaderHovered(false); setHeaderActive(false); }}
        onTouchStart={() => setHeaderActive(true)}
        onTouchEnd={() => setHeaderActive(false)}
        onMouseDown={() => setHeaderActive(true)}
        onMouseUp={() => setHeaderActive(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          transition: 'background var(--transition-fast)',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          background: headerActive 
            ? 'rgba(255, 255, 255, 0.08)' 
            : (headerHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
        }}
      >
        <SectionHead
          icon={<ClipboardList size={16} color="var(--accent-primary)" />}
          title="Submission Tracker"
          count={visible.length > 0 ? pendingMembers.length : undefined}
        />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
          {/* Assignment picker */}
          {visible.length > 0 ? (
            <>
              <select className="t-body"
                id="cr-assign-select"
                value={selected?.id ?? ''}
                onChange={e => setSelectedAssignmentId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', marginBottom: 12,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  outline: 'none',
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
                  <p className="t-feature" style={{ color: 'var(--status-safe)', transition: 'transform 0.2s' }}>
                    {submittedCount}
                  </p>
                  <p className="t-label" style={{ color: subFilter === 'submitted' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
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
                  <p className="t-feature" style={{ color: 'var(--status-critical)', transition: 'transform 0.2s' }}>
                    {pendingMembers.length}
                  </p>
                  <p className="t-label" style={{ color: subFilter === 'not_submitted' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    ✗ Pending
                  </p>
                </div>
              </div>

              {subFilter === 'not_submitted' && pendingMembers.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    id="cr-btn-send-notif"
                    onClick={handleBulkNotify}
                    style={{
                      padding: '16px 12px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-critical)' }}>
                      <Bell size={18} />
                    </div>
                    <span className="t-label">Remind Pending</span>
                  </button>
                </div>
              ) : null}

              {/* Student list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {isLoading ? (
                  <SubmissionsSkeleton />
                ) : filtered.length === 0 ? (
                  <p className="t-body" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
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
                        <span className="t-badge" style={{ color: 'var(--text-muted)' }}>{st.classRoll ?? '—'}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{st.name}</p>
                        <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>{st.universityRoll ?? ''}</p>
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
                          <button
                            onClick={async () => {
                              if (!selected) return;
                              try {
                                await crToggle.mutateAsync({
                                  assignmentId: selected.id,
                                  studentId: st.id,
                                  crVerified: false,
                                });
                                showToast(`Unmarked ${st.name}`, 'info');
                              } catch {
                                showToast('Failed to update', 'error');
                              }
                            }}
                            style={{
                              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#f59e0b', fontSize: 11, fontWeight: 600, gap: 4,
                            }}
                            title={`Unmark ${st.name} as submitted`}
                          >
                            <XCircle size={12} />
                            Unmark
                          </button>
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
                          <button
                            onClick={async () => {
                              if (!selected) return;
                              try {
                                await crToggle.mutateAsync({
                                  assignmentId: selected.id,
                                  studentId: st.id,
                                  crVerified: true,
                                });
                                showToast(`Marked ${st.name} as submitted ✓`, 'success');
                              } catch {
                                showToast('Failed to update', 'error');
                              }
                            }}
                            style={{
                              background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.25)',
                              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600, gap: 4,
                            }}
                            title={`Mark ${st.name} as submitted`}
                          >
                            <CheckCircle2 size={12} />
                            Mark
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="t-body" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              No active assignments
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── 2. Class Attendance Overview ──────────────────────────────────────────────
function ClassAttendance() {
  const { data: members = [] } = useSectionMembers();
  const { data: attendanceMap = {}, isLoading: isAttendanceLoading } = useSectionAttendance();
  const [expanded, setExpanded] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);

  // Stateful filtering and sorting
  const [filter, setFilter] = useState<'all' | 'below_75' | 'above_75'>('all');
  const [commuteFilter, setCommuteFilter] = useState<'all' | 'ds' | 'hostel'>('all');
  const [sortBy, setSortBy] = useState<'roll' | 'attendance_asc' | 'attendance_desc'>('roll');

  // Map each member with their attendance aggregate
  const membersWithAttendance = members.map(m => {
    const att = attendanceMap[m.id];
    return {
      ...m,
      overallPercentage: att?.overallPercentage ?? null,
      totalHeld: att?.totalHeld ?? 0,
    };
  });

  // Calculate section aggregates
  const validPercent = membersWithAttendance.filter(m => m.overallPercentage !== null);
  const sectionAvg = validPercent.length > 0
    ? validPercent.reduce((sum, m) => sum + m.overallPercentage!, 0) / validPercent.length
    : null;

  const criticalCount = membersWithAttendance.filter(
    m => m.overallPercentage !== null && m.overallPercentage < 75
  ).length;

  const safeCount = membersWithAttendance.filter(
    m => m.overallPercentage !== null && m.overallPercentage >= 75
  ).length;

  const dsCount = membersWithAttendance.filter(m => m.dayScholar === true).length;
  const hostelCount = membersWithAttendance.filter(m => m.dayScholar === false).length;

  // Filter members
  const filteredMembers = membersWithAttendance.filter(m => {
    let matchesAttendance = true;
    if (filter === 'below_75') {
      matchesAttendance = m.overallPercentage !== null && m.overallPercentage < 75;
    } else if (filter === 'above_75') {
      matchesAttendance = m.overallPercentage !== null && m.overallPercentage >= 75;
    }

    let matchesCommute = true;
    if (commuteFilter === 'ds') {
      matchesCommute = m.dayScholar === true;
    } else if (commuteFilter === 'hostel') {
      matchesCommute = m.dayScholar === false;
    }

    return matchesAttendance && matchesCommute;
  });

  // Sort members
  const getRollNumber = (roll: string | null | undefined) => {
    if (!roll) return 999;
    const cleaned = roll.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 999 : num;
  };

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortBy === 'attendance_asc') {
      if (a.overallPercentage === null) return 1;
      if (b.overallPercentage === null) return -1;
      return a.overallPercentage - b.overallPercentage;
    }
    if (sortBy === 'attendance_desc') {
      if (a.overallPercentage === null) return 1;
      if (b.overallPercentage === null) return -1;
      return b.overallPercentage - a.overallPercentage;
    }
    // Default: Roll sort
    const rollA = getRollNumber(a.classRoll);
    const rollB = getRollNumber(b.classRoll);
    return rollA - rollB;
  });

  return (
    <div className="card" style={{ padding: 0 }}>
      <div 
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => { setHeaderHovered(false); setHeaderActive(false); }}
        onTouchStart={() => setHeaderActive(true)}
        onTouchEnd={() => setHeaderActive(false)}
        onMouseDown={() => setHeaderActive(true)}
        onMouseUp={() => setHeaderActive(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          transition: 'background var(--transition-fast)',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          background: headerActive 
            ? 'rgba(255, 255, 255, 0.08)' 
            : (headerHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
        }}
      >
        <SectionHead icon={<Users size={16} color="var(--accent-primary)" />} title="Section Members" count={members.length} />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
          {/* Executive Summary Strip */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 14,
            gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <p className="t-label" style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>Section Average</p>
              <p className="t-subtitle" style={{ color: sectionAvg !== null ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                {sectionAvg !== null ? `${sectionAvg.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div style={{ width: 1, background: 'var(--border-default)' }} />
            <div style={{ flex: 1 }}>
              <p className="t-label" style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>At Debarment Risk</p>
              <p className="t-subtitle" style={{ color: criticalCount > 0 ? 'var(--status-critical)' : 'var(--status-safe)', fontWeight: 600 }}>
                {criticalCount} {criticalCount === 1 ? 'student' : 'students'}
              </p>
            </div>
          </div>

          {/* Interactive Controls & Filters */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap'
            }}>
              {/* Filter Pills */}
              <div className="carousel" style={{ display: 'flex', gap: 6, margin: 0, paddingBottom: 0 }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: filter === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    background: filter === 'all' ? 'var(--accent-primary-glow)' : 'transparent',
                    color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  All ({members.length})
                </button>
                <button
                  onClick={() => setFilter('below_75')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: filter === 'below_75' ? '1px solid var(--status-critical)' : '1px solid var(--border-default)',
                    background: filter === 'below_75' ? 'rgba(248, 113, 113, 0.15)' : 'transparent',
                    color: filter === 'below_75' ? 'var(--status-critical)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Below 75% ({criticalCount})
                </button>
                <button
                  onClick={() => setFilter('above_75')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: filter === 'above_75' ? '1px solid var(--status-safe)' : '1px solid var(--border-default)',
                    background: filter === 'above_75' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                    color: filter === 'above_75' ? 'var(--status-safe)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  75%+ ({safeCount})
                </button>
              </div>

              {/* Sort Picker */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'roll' | 'attendance_asc' | 'attendance_desc')}
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <option value="roll">Sort: Roll No</option>
                <option value="attendance_asc">Sort: Low % First</option>
                <option value="attendance_desc">Sort: High % First</option>
              </select>
            </div>

            {/* Commuter Filter Pills */}
            <div style={{ display: 'flex', gap: 6, margin: 0, paddingBottom: 0 }}>
              <button
                type="button"
                onClick={() => setCommuteFilter('all')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: commuteFilter === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: commuteFilter === 'all' ? 'var(--accent-primary-glow)' : 'transparent',
                  color: commuteFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setCommuteFilter('ds')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: commuteFilter === 'ds' ? '1px solid #60A5FA' : '1px solid var(--border-default)',
                  background: commuteFilter === 'ds' ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                  color: commuteFilter === 'ds' ? '#60A5FA' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                🚌 DS ({dsCount})
              </button>
              <button
                type="button"
                onClick={() => setCommuteFilter('hostel')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: commuteFilter === 'hostel' ? '1px solid #8B5CF6' : '1px solid var(--border-default)',
                  background: commuteFilter === 'hostel' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  color: commuteFilter === 'hostel' ? '#8B5CF6' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                🏠 Hostel ({hostelCount})
              </button>
            </div>
          </div>

          {/* Members List Container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 280,
            overflowY: 'auto'
          }}>
            {isAttendanceLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: 10 }}>
                <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />
                <p className="t-body" style={{ color: 'var(--text-muted)' }}>Loading attendance details...</p>
              </div>
            ) : sortedMembers.length === 0 ? (
              <p className="t-body" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                {filter === 'below_75' ? 'No students below 75% attendance!' : 'No members found'}
              </p>
            ) : sortedMembers.map(st => {
              const pct = st.overallPercentage;
              return (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span className="t-badge" style={{ color: 'var(--text-muted)' }}>{st.classRoll ?? '—'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0 }}>{st.name}</p>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1.5px 5px',
                        borderRadius: 4,
                        letterSpacing: '0.02em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        background: st.dayScholar ? 'rgba(96, 165, 250, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                        color: st.dayScholar ? '#60A5FA' : '#a78bfa',
                        border: st.dayScholar ? '1px solid rgba(96, 165, 250, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                        userSelect: 'none',
                      }}>
                        {st.dayScholar ? 'DS 🚌' : 'Hostel 🏠'}
                      </span>
                    </div>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{st.universityRoll ?? st.email}</p>
                  </div>

                  {pct === null ? (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      background: 'var(--border-default)',
                      border: '1px solid var(--border-default)',
                      userSelect: 'none',
                    }}>
                      N/A
                    </span>
                  ) : pct < 75 ? (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--status-critical)',
                      background: 'var(--status-critical-bg)',
                      border: '1px solid rgba(248, 113, 113, 0.15)',
                      boxShadow: 'var(--shadow-glow-red)',
                      userSelect: 'none',
                    }}>
                      {pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--status-safe)',
                      background: 'var(--status-safe-bg)',
                      border: '1px solid rgba(52, 211, 153, 0.15)',
                      userSelect: 'none',
                    }}>
                      {pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlashPostSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [timer, setTimer] = useState<string>('30m'); // 30m, 1h, 3h, 6h
  const [customHours, setCustomHours] = useState('');
  
  const createAnnouncement = useCreateAnnouncement();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handleSend = async () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!body.trim())  { showToast('Message body is required', 'error'); return; }
    
    let hoursToAdd = 0.5;
    if (timer === '30m') hoursToAdd = 0.5;
    else if (timer === '1h') hoursToAdd = 1;
    else if (timer === '3h') hoursToAdd = 3;
    else if (timer === '6h') hoursToAdd = 6;
    else if (timer === 'custom') {
      const parsed = parseFloat(customHours);
      if (isNaN(parsed) || parsed <= 0) { showToast('Invalid custom hours', 'error'); return; }
      hoursToAdd = parsed;
    }

    const expiresAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000).toISOString();

    try {
      await createAnnouncement.mutateAsync({
        title: title.trim(),
        message: body.trim(),
        priority: 'critical', // We'll map 'critical' with 'expires_at' as Flash Post
        expiresAt: expiresAt,
      });
      showToast('Flash Post published!', 'success');
      onClose();
    } catch (err) {
      console.error('[FlashPost] Send failed:', err);
      showToast('Failed to publish Flash Post', 'error');
    }
  };

  const sending = createAnnouncement.isPending;

  return (
    <BottomSheet onClose={onClose} title="Send Flash Post">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input id="notif-title" style={inputStyle} placeholder="e.g. Class Cancelled" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea id="notif-body" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Write your message…" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Expiry Timer</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['30m', '1h', '3h', '6h', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimer(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: timer === t ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: timer === t ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                  color: timer === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {t === 'custom' ? 'Custom' : t}
              </button>
            ))}
          </div>
          {timer === 'custom' && (
            <div style={{ marginTop: 8 }}>
              <input type="number" step="0.5" min="0.5" placeholder="Hours (e.g. 1.5)" style={inputStyle} value={customHours} onChange={e => setCustomHours(e.target.value)} />
            </div>
          )}
        </div>
        <button
          id="send-notif-btn"
          onClick={handleSend}
          disabled={sending} className="t-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: sending ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: sending ? 'not-allowed' : 'pointer',
            color: sending ? 'var(--text-muted)' : '#fff',
            transition: 'all 0.2s', marginTop: 10 }}
        >
          <Send size={15} /> {sending ? 'Sending…' : 'Publish Flash Post'}
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
          <p className="t-card-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
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
          <span className="t-feature" style={{
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
                <p className="t-subtitle" style={{ color: 'var(--status-critical)', marginBottom: 3 }}>
                  WARNING: Permanent Invalidation
                </p>
                <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
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
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deletingHub, setDeletingHub] = useState(false);
  const { data: section } = useSection();
  const refreshProfile = useAppStore(s => s.refreshProfile);
  const setActiveTab = useAppStore(s => s.setActiveTab);

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

  const handleDeleteHub = async () => {
    if (!section?.id) return;
    setDeletingHub(true);
    try {
      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        showToast('[Demo] Section Hub deleted successfully!', 'success');
        useAppStore.setState({ role: 'student', authUser: null, user: null, hub: null });
        setActiveTab('home');
        navigate('/', { replace: true });
        return;
      }

      const { error } = await supabase.rpc('delete_section_hub', { target_section_id: section.id });
      if (error) throw error;

      showToast('Section Hub deleted successfully!', 'success');
      // Refresh profile to pick up the NULL section and student role
      await refreshProfile();
      setActiveTab('home');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('[Delete] Hub deletion failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to delete Section Hub';
      showToast(errMsg, 'error');
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
        
        {/* Quick Actions */}
        <section>
          <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>QUICK ACTIONS</p>
          <div className="carousel" style={{ paddingBottom: 4 }}>
            <button className="card" onClick={() => navigate('/app/polls', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <BarChart2 size={16} color="var(--status-info)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Create Poll</span>
            </button>
            <button className="card" onClick={() => navigate('/app/announcements', { state: { openCreate: true } })} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
              <Megaphone size={16} color="var(--status-warning)" />
              <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Announcement</span>
            </button>
            <button className="card" onClick={() => setShowNotifSheet(true)} style={{ flex: '0 0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content' }}>
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
        <ClassAttendance />

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

      {showNotifSheet ? <FlashPostSheet onClose={() => setShowNotifSheet(false)} /> : null}

      {showDeleteSheet && (
        <BottomSheet onClose={() => setShowDeleteSheet(false)} title="Delete Section Hub?">
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
                <ul style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '6px 0 0 16px', padding: 0, lineHeight: 1.5 }}>
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
      )}

      <NavBar />
    </div>
  );
}
