import { useNavigate } from 'react-router-dom';
import { Paperclip, PartyPopper } from 'lucide-react';
import { deadlineBadgeClass, deadlineLabel } from '../../../components/Shared';
import { useAssignments } from '../../../hooks/useAssignments';
import { useUnitTests } from '../../../hooks/useUnitTests';
import { isExpired } from '../../../store/appStore';
import { WidgetSkeleton } from './dashboardUtils';

interface DeliverableItem {
  id: string;
  type: 'assignment' | 'unit_test';
  subject: string;
  subjectCode?: string;
  title: string;
  dueDate: string;
  badgeCls: string;
  label: string;
  tag?: string;
  attachmentCount?: number;
}

function getUrgencyStyle(dueDate: string) {
  const targetDate = new Date(dueDate);
  const now = new Date();
  const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 24) {
    return {
      dotColor: 'var(--status-critical)',
      badgeBg: 'rgba(248, 113, 113, 0.12)',
      badgeBorder: 'rgba(248, 113, 113, 0.25)',
      badgeColor: 'var(--status-critical)',
    };
  }
  if (diffHours <= 72) {
    return {
      dotColor: 'var(--status-warning)',
      badgeBg: 'rgba(251, 191, 36, 0.12)',
      badgeBorder: 'rgba(251, 191, 36, 0.25)',
      badgeColor: 'var(--status-warning)',
    };
  }
  return {
    dotColor: 'var(--accent-primary)',
    badgeBg: 'rgba(129, 140, 248, 0.10)',
    badgeBorder: 'rgba(129, 140, 248, 0.20)',
    badgeColor: 'var(--accent-primary)',
  };
}

export default function AssignmentsScroll() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading: asgLoading } = useAssignments({ limit: 8, placeholder: true });
  const { data: unitTests = [], isLoading: utLoading } = useUnitTests();

  const asgItems: DeliverableItem[] = assignments
    .filter(a => !isExpired(a.dueDate) && a.status !== 'submitted')
    .map(a => ({
      id: a.id,
      type: 'assignment',
      subject: a.subject,
      subjectCode: a.subjectCode,
      title: a.title,
      dueDate: a.dueDate,
      badgeCls: deadlineBadgeClass(a.dueDate),
      label: deadlineLabel(a.dueDate),
      attachmentCount: a.attachments?.length || 0,
    }));

  const utItems: DeliverableItem[] = unitTests
    .filter(t => !isExpired(t.dueDate) && !t.isSubmitted)
    .map(t => ({
      id: t.id,
      type: 'unit_test',
      subject: t.subject,
      subjectCode: t.subjectCode,
      title: t.title,
      dueDate: t.dueDate,
      badgeCls: deadlineBadgeClass(t.dueDate),
      label: deadlineLabel(t.dueDate),
      tag: t.testType === 'UT1' ? 'UT-1' : 'UT-2',
    }));

  const visible = [...asgItems, ...utItems]
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  if (asgLoading || utLoading) return <WidgetSkeleton />;

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Coursework & Deadlines</span>
        <button className="section-link" onClick={() => navigate('/app/assignments')}>View all →</button>
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52, 211, 153, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PartyPopper size={20} color="var(--status-safe)" />
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px', margin: '0 0 2px' }}>All caught up</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: 0 }}>No active coursework or upcoming tests.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((item, idx) => {
            const urgency = getUrgencyStyle(item.dueDate);
            return (
              <div
                key={`${item.type}-${item.id}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate('/app/assignments')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/app/assignments');
                  }
                }}
                className="coursework-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '13px 16px',
                  cursor: 'pointer',
                  borderTop: idx > 0 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                }}
              >
                {/* Left Side: Urgency Dot, Subject Name, Type Tag, Attachments */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: urgency.dotColor,
                      flexShrink: 0,
                    }}
                  />

                  <span
                    className="truncate"
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {item.subject}
                  </span>

                  {item.type === 'unit_test' ? (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1.5px 6px',
                        borderRadius: 4,
                        background: 'rgba(129, 140, 248, 0.15)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(129, 140, 248, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      {item.tag || 'UT'}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '1.5px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        flexShrink: 0,
                      }}
                    >
                      Assignment
                    </span>
                  )}

                  {item.attachmentCount ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        flexShrink: 0,
                      }}
                    >
                      <Paperclip size={11} />
                      {item.attachmentCount}
                    </span>
                  ) : null}
                </div>

                {/* Right Side: Urgency Due Date Badge */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: urgency.badgeBg,
                    border: `1px solid ${urgency.badgeBorder}`,
                    color: urgency.badgeColor,
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
