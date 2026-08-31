import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Users, ClipboardList, Bell, Send,
  XCircle, ChevronDown, ChevronUp, ChevronRight, BarChart2, Megaphone, BookOpen,
  CheckCircle2, ExternalLink, Copy, Share2, RefreshCw, Lock, Unlock, Eye, EyeOff, Loader2,
  AlertTriangle, Trash2, UserCheck, SlidersHorizontal
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { CRAttendanceRegisterModal } from '../../components/CRAttendanceRegisterModal';
import { useAppStore, isExpired } from '../../store/appStore';
import { toast } from 'sonner';
import { useAssignments, useAssignmentSubmissions, useCRToggleSubmission } from '../../hooks/useAssignments';
import { useSectionMembers, useSection, useSectionAttendance, useSectionCRs, usePromoteToCoCR, useDemoteCoCR, useTransferPrimaryCR, useResignAsCR } from '../../hooks/useSectionMembers';
import { useToggleEnrollment, useRegenerateInviteCode, useUpdateBatchConfig } from '../../hooks/useSectionAdmin';
import { useCreateAnnouncement } from '../../hooks/useAnnouncements';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useVirtualizer } from '@tanstack/react-virtual';
import Skeleton from 'react-loading-skeleton';
import { haptics } from '../../lib/haptics';
import { NumberTicker } from '../../components/ui/NumberTicker';
import { SectionHealthChart } from '../../components/ui/charts/SectionHealthChart';
import { shareOrCopyPendingAssignmentReport } from '../../lib/utils/assignmentReport';






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

function LocalSubmissionsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Skeleton width="40%" height={13} />
            <Skeleton width="25%" height={10} />
          </div>
          <Skeleton width={70} height={22} borderRadius={10} />
        </div>
      ))}
    </div>
  );
}

type SubFilter = 'submitted' | 'not_submitted';

function SubmissionTracker() {
  const { data: assignments = [] } = useAssignments({ limit: 200 });
  const { data: members = [] } = useSectionMembers();
  const { data: section } = useSection();
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

  const studentMembers = useMemo(() => members.filter(m => m.role !== 'teacher'), [members]);

  // CR tracker uses cr_verified (CR's own mark), not student's self-reported status
  const submittedMembers = studentMembers.filter(m =>
    submissions.some(s => s.studentId === m.id && s.crVerified === true)
  );
  const pendingMembers = studentMembers.filter(m =>
    !submissions.some(s => s.studentId === m.id && s.crVerified === true)
  );

  const submittedCount = submittedMembers.length;
  const filtered = subFilter === 'submitted' ? submittedMembers : pendingMembers;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  const handleBulkNotify = async () => {
    if (pendingMembers.length === 0) {
      toast.info('All students have submitted!');
      return;
    }
    if (!selected) return;
    toast.info('Sending reminders...');
    try {
      const { data, error } = await supabase.functions.invoke('send-assignment-reminders', {
        body: { assignmentId: selected.id },
      });
      if (error) throw error;
      const { sent, failed } = data;
      if (sent === 0 && failed > 0) {
        toast.error('Push delivery failed for all students');
      } else if (sent > 0 && failed > 0) {
        toast.warning(`Reminders sent to ${sent} students (${failed} failed)`);
      } else if (sent > 0) {
        toast.success(`Reminders sent to ${sent} students!`);
      } else {
        toast.info('No pending students found');
      }
    } catch (err) {
      console.error('[Notify] Bulk remind failed:', err);
      toast.error('Failed to send reminders');
    }
  };

  const handleSharePending = async () => {
    if (!selected) return;
    haptics.lightClick();
    await shareOrCopyPendingAssignmentReport({
      sectionName: section?.name,
      subjectCode: selected.subjectCode || selected.subject,
      subjectName: selected.subject,
      assignmentTitle: selected.title,
      dueDate: selected.dueDate,
      totalStudents: studentMembers.length,
      submittedCount,
      pendingStudents: pendingMembers.map(m => ({
        id: m.id,
        name: m.name,
        classRoll: m.classRoll,
      })),
    });
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
                    <NumberTicker value={submittedCount} decimalPlaces={0} />
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
                    <NumberTicker value={pendingMembers.length} decimalPlaces={0} />
                  </p>
                  <p className="t-label" style={{ color: subFilter === 'not_submitted' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    ✗ Pending
                  </p>
                </div>
              </div>

              <SectionHealthChart
                safeCount={submittedCount}
                warningCount={0}
                criticalCount={pendingMembers.length}
                totalStudents={studentMembers.length}
              />

              {subFilter === 'not_submitted' && pendingMembers.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <button
                    id="cr-btn-send-notif"
                    onClick={handleBulkNotify}
                    className="t-button"
                    style={{
                      padding: '10px 8px',
                      background: 'rgba(74,158,255,0.1)',
                      border: '1px solid rgba(74,158,255,0.2)',
                      borderRadius: 8,
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: '13px',
                    }}
                  >
                    <Bell size={14} /> Notify ({pendingMembers.length})
                  </button>
                  <button
                    id="cr-btn-share-pending"
                    onClick={handleSharePending}
                    className="t-button"
                    style={{
                      padding: '10px 8px',
                      background: 'rgba(255,68,68,0.1)',
                      border: '1px solid rgba(255,68,68,0.2)',
                      borderRadius: 8,
                      color: 'var(--status-critical)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: '13px',
                    }}
                  >
                    <Share2 size={14} /> Share List ({pendingMembers.length})
                  </button>
                </div>
              ) : null}


              {/* Student list */}
              {isLoading ? (
                <LocalSubmissionsSkeleton />
              ) : filtered.length === 0 ? (
                <p className="t-body" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                  No students in this list
                </p>
              ) : (
                <div
                  ref={parentRef}
                  style={{
                    maxHeight: 280,
                    overflowY: 'auto',
                    position: 'relative',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const st = filtered[virtualItem.index];
                      if (!st) return null;
                      const subRecord = submissions.find(s => s.studentId === st.id);

                      return (
                        <div
                          key={st.id}
                          ref={virtualizer.measureElement}
                          data-index={virtualItem.index}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '6px',
                          }}
                        >
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 8,
                            background: subFilter === 'submitted' ? 'rgba(52,201,123,0.04)' : 'rgba(255,68,68,0.04)',
                            border: subFilter === 'submitted' ? '1px solid rgba(52,201,123,0.12)' : '1px solid rgba(255,68,68,0.12)',
                            width: '100%',
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
                                    haptics.lightClick();
                                    try {
                                      await crToggle.mutateAsync({
                                        assignmentId: selected.id,
                                        studentId: st.id,
                                        crVerified: false,
                                      });
                                      toast.info(`Unmarked ${st.name}`);
                                    } catch {
                                      toast.error('Failed to update');
                                    }
                                  }}
                                  disabled={crToggle.isPending && crToggle.variables?.studentId === st.id}
                                  style={{
                                    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: 6, padding: '3px 8px', cursor: (crToggle.isPending && crToggle.variables?.studentId === st.id) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#f59e0b', fontSize: 12, fontWeight: 600, gap: 4, opacity: (crToggle.isPending && crToggle.variables?.studentId === st.id) ? 0.6 : 1
                                  }}
                                  title={`Unmark ${st.name} as submitted`}
                                >
                                  {crToggle.isPending && crToggle.variables?.studentId === st.id ? (
                                    <Loader2 className="animate-spin" size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    <XCircle size={12} />
                                  )}
                                  {crToggle.isPending && crToggle.variables?.studentId === st.id ? 'Saving…' : 'Unmark'}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  onClick={async () => {
                                    toast.info(`Nudging ${st.name}...`);
                                    try {
                                      const { error } = await supabase.functions.invoke('send-assignment-reminders', {
                                        body: { assignmentId: selected?.id, studentId: st.id },
                                        headers: {
                                          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                                        }
                                      });
                                      if (error) throw error;
                                      toast.success(`Nudged ${st.name}!`);
                                    } catch (err) {
                                      console.error('[Notify] Nudge failed:', err);
                                      toast.error('Failed to nudge');
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
                                    haptics.doublePulse();
                                    try {
                                      await crToggle.mutateAsync({
                                        assignmentId: selected.id,
                                        studentId: st.id,
                                        crVerified: true,
                                      });
                                      toast.success(`Marked ${st.name} as submitted ✓`);
                                    } catch {
                                      toast.error('Failed to update');
                                    }
                                  }}
                                  disabled={crToggle.isPending && crToggle.variables?.studentId === st.id}
                                  style={{
                                    background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.25)',
                                    borderRadius: 6, padding: '3px 8px', cursor: (crToggle.isPending && crToggle.variables?.studentId === st.id) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600, gap: 4, opacity: (crToggle.isPending && crToggle.variables?.studentId === st.id) ? 0.6 : 1
                                  }}
                                  title={`Mark ${st.name} as submitted`}
                                >
                                  {crToggle.isPending && crToggle.variables?.studentId === st.id ? (
                                    <Loader2 className="animate-spin" size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    <CheckCircle2 size={12} />
                                  )}
                                  {crToggle.isPending && crToggle.variables?.studentId === st.id ? 'Saving…' : 'Verify'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

// ── 2. Section Roster Widget ──────────────────────────────────────────────
function SectionRosterCard({ onOpenAttendance }: { onOpenAttendance: () => void }) {
  const navigate = useNavigate();
  const { data: members = [] } = useSectionMembers();
  const { data: attendanceMap = {}, isLoading: isAttendanceLoading } = useSectionAttendance();

  const studentMembers = useMemo(() => members.filter(m => m.role !== 'teacher'), [members]);

  const membersWithAttendance = useMemo(() => {
    return studentMembers.map(m => {
      const att = attendanceMap[m.id];
      return {
        ...m,
        overallPercentage: att?.overallPercentage ?? null,
        totalHeld: att?.totalHeld ?? 0,
      };
    });
  }, [studentMembers, attendanceMap]);

  // Section Attendance Average
  const validPercent = membersWithAttendance.filter(m => m.overallPercentage !== null);
  const sectionAvg = validPercent.length > 0
    ? validPercent.reduce((sum, m) => sum + m.overallPercentage!, 0) / validPercent.length
    : null;

  // Critical at-risk (< 75%)
  const criticalCount = membersWithAttendance.filter(
    m => m.overallPercentage !== null && m.overallPercentage < 75
  ).length;

  // Demographics
  const dsCount = membersWithAttendance.filter(m => m.dayScholar === true).length;
  const hostelCount = membersWithAttendance.filter(m => m.dayScholar === false).length;
  const b1Count = membersWithAttendance.filter(m => m.subBatch === '1').length;
  const b2Count = membersWithAttendance.filter(m => m.subBatch === '2').length;
  const unassignedCount = membersWithAttendance.filter(m => !m.subBatch).length;
  const missingRollCount = membersWithAttendance.filter(m => !m.classRoll).length;

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Users size={16} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px', fontWeight: 700 }}>
              Section Roster
            </h3>
            <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>
              {studentMembers.length} enrolled students
            </p>
          </div>
        </div>

        <button
          id="manage-roster-top-btn"
          onClick={() => navigate('/app/members')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--accent-primary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <span>Manage</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Vitals Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}>
        <div>
          <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Class Average</p>
          <p className="t-title" style={{ color: 'var(--text-primary)', margin: '2px 0 0', fontWeight: 800 }}>
            {isAttendanceLoading ? '…' : sectionAvg !== null ? `${sectionAvg.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Debarment Risk</p>
          <p className="t-title" style={{ color: criticalCount > 0 ? 'var(--status-critical)' : 'var(--status-safe)', margin: '2px 0 0', fontWeight: 800 }}>
            {isAttendanceLoading ? '…' : `${criticalCount} below 75%`}
          </p>
        </div>
      </div>

      {/* Demographics & Roster Health */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Practical Batches</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            G1: {b1Count} • G2: {b2Count}{unassignedCount > 0 ? ` (${unassignedCount} unassigned)` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Transit Breakdown</span>
          <span style={{ color: 'var(--text-primary)' }}>
            🚌 {dsCount} Day Scholars • 🏠 {hostelCount} Hostel
          </span>
        </div>
        {missingRollCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            padding: '6px 10px',
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#FBBF24',
            fontSize: '11.5px',
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            <span>{missingRollCount} {missingRollCount === 1 ? 'student is' : 'students are'} missing section roll number.</span>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        <button
          id="roster-take-attendance-btn"
          onClick={onOpenAttendance}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-primary-glow)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            color: 'var(--accent-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <UserCheck size={15} />
          <span>Take Attendance</span>
        </button>
        <button
          id="roster-full-dir-btn"
          onClick={() => navigate('/app/members')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Users size={15} />
          <span>Open Roster</span>
        </button>
      </div>
    </div>
  );
}

function SendNotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { data: section } = useSection();

  const draftLoadedRef = useRef(false);

  // Load draft from localStorage on mount (when sheet opens)
  useEffect(() => {
    if (open) {
      if (draftLoadedRef.current) return;
      draftLoadedRef.current = true;
      const saved = localStorage.getItem('classhub-draft-announcement');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          const hasDraftContent = !!(draft.title?.trim() || draft.body?.trim());
          const isStateEmpty = !title && !body;

          if (draft.title) setTitle(draft.title);
          if (draft.body) setBody(draft.body);

          if (hasDraftContent && isStateEmpty) {
            toast.success('Draft recovered! ✓');
          }
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    } else {
      draftLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Save draft to localStorage on fields change
  useEffect(() => {
    if (open) {
      const draft = { title, body };
      if (title.trim() || body.trim()) {
        localStorage.setItem('classhub-draft-announcement', JSON.stringify(draft));
      } else {
        localStorage.removeItem('classhub-draft-announcement');
      }
    }
  }, [title, body, open]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!body.trim())  { toast.error('Message body is required'); return; }
    if (!section?.id) return;
    setSending(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const { data: pushData, error: pushErr } = await supabase.functions.invoke('send-custom-notification', {
        body: { title: title.trim(), body: body.trim(), sectionId: section.id },
      });

      if (pushErr) {
        console.error('[Notify] Push failed:', pushErr);
        toast.warning('Notification sent to bell icon! Push delivery failed.');
      } else if (pushData && !pushData.error) {
        const { sent, failed } = pushData;
        if (sent === 0 && failed > 0) {
          toast.warning('Notification sent to bell icon! Push delivery failed for all.');
        } else if (sent > 0 && failed > 0) {
          toast.success(`Notification sent! Push delivered to ${sent} (${failed} failed).`);
        } else if (sent > 0) {
          toast.success(`Notification sent! Push delivered to ${sent} students.`);
        } else {
          toast.success('Notification sent! (No active subscriptions found)');
        }
      } else if (pushData?.error) {
        console.error('[Notify] Edge function error:', pushData.error);
        toast.error(`Failed: ${pushData.error}`);
      } else {
        toast.success('Notification sent!');
      }
      localStorage.removeItem('classhub-draft-announcement');
      setTitle('');
      setBody('');
      onClose();
    } catch (err) {
      console.error('[Notify] Send failed:', err);
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Send Notification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input id="notif-title" style={inputStyle} placeholder="e.g. Important update" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea id="notif-body" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Write your message to the class…" value={body} onChange={e => setBody(e.target.value)} />
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
          {sending ? (
            <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={15} />
          )}
          {sending ? 'Sending…' : 'Send Notification'}
        </button>
      </div>
    </BottomSheet>
  );
}

function FlashPostSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!body.trim())  { toast.error('Message body is required'); return; }
    
    let hoursToAdd = 0.5;
    if (timer === '30m') hoursToAdd = 0.5;
    else if (timer === '1h') hoursToAdd = 1;
    else if (timer === '3h') hoursToAdd = 3;
    else if (timer === '6h') hoursToAdd = 6;
    else if (timer === 'custom') {
      const parsed = parseFloat(customHours);
      if (isNaN(parsed) || parsed <= 0) { toast.error('Invalid custom hours'); return; }
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
      toast.success('Flash Post published!');
      onClose();
    } catch (err) {
      console.error('[FlashPost] Send failed:', err);
      toast.error('Failed to publish Flash Post');
    }
  };

  const sending = createAnnouncement.isPending;

  return (
    <BottomSheet open={open} onClose={onClose} title="Send Flash Post">
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
          {sending ? (
            <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={15} />
          )}
          {sending ? 'Sending…' : 'Publish Flash Post'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Invite Code Card with Enrollment Lock Control ──
function InviteCodeCard() {
  const { data: section } = useSection();
  const toggleEnrollment = useToggleEnrollment();
  const regenerateCode = useRegenerateInviteCode();
  const [obscured, setObscured] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inviteCode = section?.inviteCode || '......';
  const isLocked = section?.isEnrollmentLocked ?? false;

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied to clipboard!');
  };

  const shareCode = async () => {
    try {
      const inviteUrl = `${window.location.origin}/onboarding/join?invite=${inviteCode}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Join ClassHub!',
          text: `Join your Section's Hub ${section?.name || ''} on ClassHub! Use this direct link to access it : ${inviteUrl} (Invite Code: ${inviteCode})`,
        });
      } else {
        throw new Error('Not supported');
      }
    } catch {
      copyCode();
    }
  };

  const handleRotate = async () => {
    try {
      await regenerateCode.mutateAsync('student');
      setConfirmOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rotate invite code';
      toast.error(message);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Lock size={16} color="var(--accent-primary)" />
            </div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', margin: 0 }}>
              Section Invite Code
            </p>
          </div>

          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: isLocked ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)',
            color: isLocked ? 'var(--status-critical)' : 'var(--status-safe)',
            border: isLocked ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
          }}>
            {isLocked ? '🔒 Enrollment Locked' : '🔓 Open to Join'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginTop: 2,
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
            {obscured ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
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

        {/* Enrollment Lock Control Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          background: isLocked ? 'rgba(248, 113, 113, 0.06)' : 'rgba(52, 211, 153, 0.06)',
          border: isLocked ? '1px solid rgba(248, 113, 113, 0.2)' : '1px solid rgba(52, 211, 153, 0.2)',
          marginTop: 4,
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLocked ? <Lock size={15} color="var(--status-critical)" /> : <Unlock size={15} color="var(--status-safe)" />}
            <div>
              <p className="t-body-medium" style={{ color: isLocked ? 'var(--status-critical)' : 'var(--status-safe)', margin: 0, fontSize: 13 }}>
                {isLocked ? 'Enrollment Locked' : 'Enrollment Open'}
              </p>
              <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0, fontSize: 11 }}>
                {isLocked ? 'New student onboarding is disabled' : 'Students can join with this code'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="t-button"
            disabled={toggleEnrollment.isPending}
            onClick={() => toggleEnrollment.mutate(!isLocked)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background: isLocked ? 'var(--status-safe)' : 'rgba(255, 68, 68, 0.12)',
              color: isLocked ? '#0d0f14' : 'var(--status-critical)',
              border: isLocked ? 'none' : '1px solid rgba(255, 68, 68, 0.25)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {toggleEnrollment.isPending ? 'Updating…' : (isLocked ? 'Unlock Signups' : 'Lock Signups')}
          </button>
        </div>
      </div>

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Rotate Invite Code?">
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
              <span style={{ fontSize: 21, lineHeight: 1 }}>⚠️</span>
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
                onClick={handleRotate} 
                disabled={regenerateCode.isPending}
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)', 
                  boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
                  minHeight: 48,
                }}
              >
                {regenerateCode.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Rotate Code'}
              </button>
            </div>
          </div>
      </BottomSheet>
    </>
  );
}

// ── Teacher Invite Code Card ──
function TeacherInviteCodeCard() {
  const { data: section } = useSection();
  const regenerateCode = useRegenerateInviteCode();
  const [obscured, setObscured] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const teacherInviteCode = section?.teacherInviteCode || '......';

  const copyCode = () => {
    navigator.clipboard.writeText(teacherInviteCode);
    toast.success('Teacher invite code copied to clipboard!');
  };

  const shareCode = async () => {
    try {
      const inviteUrl = `${window.location.origin}/onboarding/join?role=teacher&invite=${teacherInviteCode}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Join ClassHub as Faculty!',
          text: `Join ${section?.name || ''} Hub on ClassHub as a Faculty member! Use this direct link: ${inviteUrl} (Invite Code: ${teacherInviteCode})`,
        });
      } else {
        throw new Error('Not supported');
      }
    } catch {
      copyCode();
    }
  };

  const handleRotate = async () => {
    try {
      await regenerateCode.mutateAsync('teacher');
      setConfirmOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rotate teacher invite code';
      toast.error(msg);
    }
  };

  return (
    <>
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(20, 23, 32, 0.8) 100%)',
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
            background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Lock size={16} color="rgb(99, 102, 241)" />
          </div>
          <p className="t-card-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
            Teacher Invite Code
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
            color: obscured ? 'var(--text-muted)' : 'rgb(99, 102, 241)',
            transition: 'color 0.2s',
          }}>
            {obscured ? '••••••••' : teacherInviteCode}
          </span>
          <button
            onClick={() => setObscured(!obscured)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 6, display: 'flex',
            }}
            title={obscured ? "Show Invite Code" : "Hide Invite Code"}
          >
            {obscured ? <Eye size={16} /> : <EyeOff size={16} />}
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

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Rotate Teacher Invite Code?">
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
              <span style={{ fontSize: 21, lineHeight: 1 }}>⚠️</span>
              <div>
                <p className="t-subtitle" style={{ color: 'var(--status-critical)', marginBottom: 3 }}>
                  WARNING: Permanent Invalidation
                </p>
                <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  This will immediately invalidate the current teacher code. Existing registered teachers will remain unaffected, but new faculty members must use the new code to join.
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
                onClick={handleRotate} 
                disabled={regenerateCode.isPending}
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)', 
                  boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
                  minHeight: 48,
                }}
              >
                {regenerateCode.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Rotate Code'}
              </button>
            </div>
          </div>
      </BottomSheet>
    </>
  );
}

// ── Batch Division Setup Card ──
function BatchDivisionCard() {
  const { data: section } = useSection();
  const updateBatchConfig = useUpdateBatchConfig();
  const currentEndRoll = section?.batch1EndRoll ?? 30;
  const [cutoff, setCutoff] = useState<number>(currentEndRoll);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (section?.batch1EndRoll) {
      setCutoff(section.batch1EndRoll);
    }
  }, [section?.batch1EndRoll]);

  const handleSave = async () => {
    if (cutoff < 1) {
      toast.error('Cutoff roll must be at least 1');
      return;
    }
    await updateBatchConfig.mutateAsync({
      batch1EndRoll: cutoff,
      applyToExisting,
    });
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          userSelect: 'none',
        }}
      >
        <SectionHead
          icon={<SlidersHorizontal size={16} color="var(--accent-primary)" />}
          title="Batch Division Setup"
        />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Configure automatic sub-batch division for practical labs, tutorials, and attendance rosters.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            background: 'var(--bg-elevated)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p className="t-mono-sm" style={{ color: '#60A5FA', fontWeight: 600 }}>BATCH 1 (B1)</p>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                Roll 1 to {cutoff}
              </p>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-default)' }}>
              <p className="t-mono-sm" style={{ color: '#A78BFA', fontWeight: 600 }}>BATCH 2 (B2)</p>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                Roll {cutoff + 1} onwards
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <label className="t-label" style={{ color: 'var(--text-secondary)' }}>
              Batch 1 Cutoff (End Roll Number)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="200"
                value={cutoff}
                onChange={e => setCutoff(parseInt(e.target.value, 10) || 1)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {[30, 32, 35, 40].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCutoff(val)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: cutoff === val ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                      border: cutoff === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      color: cutoff === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={applyToExisting}
              onChange={e => setApplyToExisting(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', width: 16, height: 16 }}
            />
            <span className="t-caption" style={{ color: 'var(--text-primary)' }}>
              Re-assign all existing students to match this new cutoff
            </span>
          </label>

          <button
            type="button"
            className="btn-primary"
            disabled={updateBatchConfig.isPending}
            onClick={handleSave}
            style={{ marginTop: 6, minHeight: 42 }}
          >
            {updateBatchConfig.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save Batch Configuration'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── 4. Manage CRs (ADR-018) ──────────────────────────────────────────────────

function ManageCRs() {
  const authUser = useAppStore(s => s.authUser);
  const isPrimary = authUser?.crRank === 'primary';
  const { data: crs = [] } = useSectionCRs();
  const { data: members = [] } = useSectionMembers();
  const promoteCo = usePromoteToCoCR();
  const demoteCo = useDemoteCoCR();
  const transferPrimary = useTransferPrimaryCR();
  const resignCR = useResignAsCR();

  const [expanded, setExpanded] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);
  const [showAddCR, setShowAddCR] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showResign, setShowResign] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferAction, setTransferAction] = useState<'become_student' | 'become_co_cr'>('become_student');

  // Students eligible to be promoted (not already a CR)
  const eligibleStudents = members.filter(m => m.role === 'student');
  const coCRCount = crs.filter(c => c.crRank === 'co').length;

  const handlePromote = async (userId: string) => {
    try {
      await promoteCo.mutateAsync(userId);
      toast.success('Co-CR added successfully!');
      setShowAddCR(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to promote';
      toast.error(msg);
    }
  };

  const handleDemote = async (userId: string, name: string) => {
    try {
      await demoteCo.mutateAsync(userId);
      toast.info(`${name} removed from CR role`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to demote';
      toast.error(msg);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    try {
      await transferPrimary.mutateAsync({
        newPrimaryId: transferTarget,
        oldCrAction: transferAction,
      });
      toast.success('Primary role transferred!');
      setShowTransfer(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      toast.error(msg);
    }
  };

  const handleResign = async () => {
    try {
      await resignCR.mutateAsync();
      toast.info('You have resigned as CR');
      setShowResign(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resign failed';
      toast.error(msg);
    }
  };

  // All eligible targets for transfer: co-CRs + students
  const transferEligible = [
    ...crs.filter(c => c.crRank === 'co'),
    ...eligibleStudents.slice(0, 20), // Limit to avoid huge lists
  ];

  return (
    <>
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
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
            transition: 'background var(--transition-fast)', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            background: headerActive
              ? 'rgba(255, 255, 255, 0.08)'
              : (headerHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} color="#c084fc" />
            <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>Manage CRs</span>
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({crs.length})</span>
          </div>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {expanded ? (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
            {/* Current CRs list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {crs.map(cr => (
                <div key={cr.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: cr.crRank === 'primary' ? 'rgba(192,132,252,0.06)' : 'var(--bg-elevated)',
                  border: cr.crRank === 'primary' ? '1px solid rgba(192,132,252,0.2)' : '1px solid var(--border-default)',
                }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: cr.crRank === 'primary'
                      ? 'linear-gradient(135deg, rgba(192,132,252,0.2), rgba(139,92,246,0.3))'
                      : 'var(--bg-base)',
                    border: cr.crRank === 'primary'
                      ? '1.5px solid rgba(192,132,252,0.4)'
                      : '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="t-badge" style={{
                      color: cr.crRank === 'primary' ? '#c084fc' : 'var(--text-muted)',
                      fontSize: 12,
                    }}>
                      {cr.classRoll ?? '—'}
                    </span>
                  </div>

                  {/* Name + rank */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                        {cr.name}
                        {cr.id === authUser?.id ? ' (you)' : ''}
                      </p>
                    </div>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>{cr.email}</p>
                  </div>

                  {/* Rank badge */}
                  <span style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                    background: cr.crRank === 'primary' ? 'rgba(192,132,252,0.15)' : 'rgba(74,158,255,0.1)',
                    color: cr.crRank === 'primary' ? '#c084fc' : 'var(--accent-primary)',
                    border: cr.crRank === 'primary' ? '1px solid rgba(192,132,252,0.3)' : '1px solid rgba(74,158,255,0.2)',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                  }}>
                    {cr.crRank === 'primary' ? '★ Primary' : 'Co-CR'}
                  </span>

                  {/* Remove button (primary can remove co-CRs) */}
                  {isPrimary && cr.crRank === 'co' ? (
                    <button
                      onClick={() => handleDemote(cr.id, cr.name)}
                      disabled={demoteCo.isPending}
                      style={{
                        background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                        color: 'var(--status-critical)', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      title={`Remove ${cr.name} from CR role`}
                    >
                      <XCircle size={12} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Add Co-CR (primary only, max 2) */}
              {isPrimary && coCRCount < 2 ? (
                <button
                  onClick={() => setShowAddCR(true)}
                  className="t-button"
                  style={{
                    width: '100%', padding: '10px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Users size={14} /> Add Co-CR from Section
                </button>
              ) : null}

              {/* Transfer Primary (primary only) */}
              {isPrimary ? (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="t-button"
                  style={{
                    width: '100%', padding: '10px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                    color: '#f59e0b',
                  }}
                >
                  <RefreshCw size={14} /> Transfer Primary Role
                </button>
              ) : null}

              {/* Resign (co-CR only) */}
              {!isPrimary && authUser?.role === 'cr' ? (
                <button
                  onClick={() => setShowResign(true)}
                  className="t-button"
                  style={{
                    width: '100%', padding: '10px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)',
                    color: 'var(--status-critical)',
                  }}
                >
                  <Unlock size={14} /> Resign as CR
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Add Co-CR Bottom Sheet */}
      <BottomSheet open={showAddCR} onClose={() => setShowAddCR(false)} title="Add Co-CR">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingBottom: 16 }}>
            {eligibleStudents.length === 0 ? (
              <p className="t-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                No eligible students found
              </p>
            ) : eligibleStudents.map(st => (
              <div key={st.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span className="t-badge" style={{ color: 'var(--text-muted)' }}>{st.classRoll ?? '—'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{st.name}</p>
                  <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>{st.email}</p>
                </div>
                <button
                  onClick={() => handlePromote(st.id)}
                  disabled={promoteCo.isPending}
                  style={{
                    background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)',
                    borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                    color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {promoteCo.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Promote
                </button>
              </div>
            ))}
          </div>
      </BottomSheet>

      {/* Transfer Primary Bottom Sheet */}
      <BottomSheet open={showTransfer} onClose={() => setShowTransfer(false)} title="Transfer Primary Role">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
            <div style={{
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 'var(--radius-md)', padding: '10px 12px',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                This will make someone else the primary CR. You cannot undo this without their cooperation.
              </p>
            </div>

            <p className="t-label" style={{ color: 'var(--text-secondary)' }}>Select new Primary CR:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {transferEligible.map(u => (
                <div
                  key={u.id}
                  onClick={() => setTransferTarget(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                    background: transferTarget === u.id ? 'rgba(251,191,36,0.1)' : 'var(--bg-elevated)',
                    border: transferTarget === u.id ? '1.5px solid rgba(251,191,36,0.4)' : '1px solid var(--border-default)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: transferTarget === u.id ? '5px solid #f59e0b' : '2px solid var(--border-default)',
                    transition: 'all var(--transition-fast)', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                      {('crRank' in u && u.crRank === 'co') ? 'Current Co-CR' : 'Student'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="t-label" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>After transfer, I become:</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setTransferAction('become_student')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  background: transferAction === 'become_student' ? 'rgba(255,68,68,0.1)' : 'var(--bg-elevated)',
                  border: transferAction === 'become_student' ? '1.5px solid rgba(255,68,68,0.3)' : '1px solid var(--border-default)',
                  color: transferAction === 'become_student' ? 'var(--status-critical)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, transition: 'all var(--transition-fast)',
                }}
              >
                Student
              </button>
              <button
                onClick={() => setTransferAction('become_co_cr')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  background: transferAction === 'become_co_cr' ? 'rgba(74,158,255,0.1)' : 'var(--bg-elevated)',
                  border: transferAction === 'become_co_cr' ? '1.5px solid rgba(74,158,255,0.3)' : '1px solid var(--border-default)',
                  color: transferAction === 'become_co_cr' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, transition: 'all var(--transition-fast)',
                }}
              >
                Co-CR
              </button>
            </div>

            <button
              onClick={handleTransfer}
              disabled={!transferTarget || transferPrimary.isPending}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, cursor: transferTarget ? 'pointer' : 'not-allowed',
                background: transferTarget ? 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)' : 'var(--bg-elevated)',
                border: 'none', color: transferTarget ? '#1a1a2e' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, marginTop: 4,
                opacity: !transferTarget || transferPrimary.isPending ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {transferPrimary.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Confirm Transfer
            </button>
          </div>
      </BottomSheet>

      {/* Resign Confirmation Bottom Sheet */}
      <BottomSheet open={showResign} onClose={() => setShowResign(false)} title="Resign as CR?">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
            <div style={{
              background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: 'var(--radius-md)', padding: '10px 12px',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                You will lose all CR permissions and become a regular student. The primary CR can re-add you later.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-secondary"
                onClick={() => setShowResign(false)}
                style={{ flex: 1, minHeight: 44 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResign}
                disabled={resignCR.isPending}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 8, cursor: 'pointer',
                  background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)',
                  border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {resignCR.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Yes, Resign
              </button>
            </div>
          </div>
      </BottomSheet>
    </>
  );
}

// ── Manage Teachers component ──
function ManageTeachers() {
  const { data: section } = useSection();
  const sectionName = section?.name || '';
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);

  // Fetch section teachers mapping
  const { data: sectionTeachers = [], isLoading } = useQuery({
    queryKey: ['section-teachers-list', section?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select('id, teacher_id, is_counsellor_for_batch, users(name, email), subject_id, subjects(name, code)')
        .eq('section_id', section!.id);
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!section?.id
  });

  const assignCounsellorMutation = useMutation({
    mutationFn: async ({ mappingId, batch }: { mappingId: string; batch: '1' | '2' | null }) => {
      const { error } = await supabase
        .from('section_teachers')
        .update({ is_counsellor_for_batch: batch })
        .eq('id', mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Batch Counsellor mapping updated! ✓');
      queryClient.invalidateQueries({ queryKey: ['section-teachers-list', section?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign counsellor');
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('section_teachers')
        .delete()
        .eq('id', mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Teacher access revoked.');
      queryClient.invalidateQueries({ queryKey: ['section-teachers-list', section?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to revoke teacher access');
    }
  });

  if (!section?.id) return null;

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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
          transition: 'background var(--transition-fast)', userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          background: headerActive
            ? 'rgba(255, 255, 255, 0.08)'
            : (headerHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="var(--accent-primary)" />
          <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>Manage Section Teachers</span>
          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({sectionTeachers.length})</span>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
          {isLoading ? (
            <p className="t-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Loading teachers...</p>
          ) : sectionTeachers.length === 0 ? (
            <p className="t-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No teachers linked to this section.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sectionTeachers.map((st: any) => (
                <div key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="t-badge" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {st.users?.name ? st.users.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'T'}
                    </span>
                  </div>

                  {/* Name + email + subject */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                      {st.users?.name || 'Unnamed Teacher'}
                    </p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {st.users?.email}
                    </p>
                    {st.subjects && (
                      <p className="t-mono-sm" style={{ color: 'var(--accent-primary)', fontSize: 12, marginTop: 2 }}>
                        Subject: {st.subjects.name} ({st.subjects.code})
                      </p>
                    )}
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                        Counsellor
                      </span>
                      <select
                        value={st.is_counsellor_for_batch || ''}
                        onChange={e => {
                          const val = e.target.value === '' ? null : e.target.value as '1' | '2';
                          assignCounsellorMutation.mutate({ mappingId: st.id, batch: val });
                        }}
                        className="input"
                        style={{ fontSize: 12, padding: '2px 6px', height: 24, width: 90 }}
                      >
                        <option value="">None</option>
                        <option value="1">{sectionName || 'B'}1</option>
                        <option value="2">{sectionName || 'B'}2</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm(`Revoke teacher access for ${st.users?.name || 'this teacher'}?`)) {
                          deleteTeacherMutation.mutate(st.id);
                        }
                      }}
                      style={{
                        background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                        color: 'var(--status-critical)', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, height: 24, marginTop: 12
                      }}
                      title={`Revoke ${st.users?.name || 'teacher'}'s access`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
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
