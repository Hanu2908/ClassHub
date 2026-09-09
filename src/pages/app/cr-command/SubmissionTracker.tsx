import { useState, useMemo, useRef } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Bell, Share2, ExternalLink, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { haptics } from '../../../lib/haptics';
import { isExpired } from '../../../store/appStore';
import { useAssignments } from '../../../hooks/useAssignments';
import { useSectionMembers, useSection } from '../../../hooks/useSectionMembers';
import { useAssignmentSubmissions, useCRToggleSubmission, type AssignmentSubmission } from '../../../hooks/useAssignments';
import { shareOrCopyPendingAssignmentReport } from '../../../lib/utils/assignmentReport';
import { NumberTicker } from '../../../components/ui/NumberTicker';
import { SectionHealthChart } from '../../../components/ui/charts/SectionHealthChart';
import { supabase } from '../../../lib/supabase';
import { SectionHead, LocalSubmissionsSkeleton } from './crCommandShared';

type SubFilter = 'submitted' | 'not_submitted';

export function SubmissionTracker() {
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
    submissions.some((s: AssignmentSubmission) => s.studentId === m.id && s.crVerified === true)
  );
  const pendingMembers = studentMembers.filter(m =>
    !submissions.some((s: AssignmentSubmission) => s.studentId === m.id && s.crVerified === true)
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
                      const subRecord = submissions.find((s: AssignmentSubmission) => s.studentId === st.id);

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
