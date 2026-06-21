import { useNavigate } from 'react-router-dom';
import { Paperclip, PartyPopper } from 'lucide-react';
import { deadlineBadgeClass, deadlineLabel } from '../../../components/Shared';
import { useAssignments } from '../../../hooks/useAssignments';
import { isExpired } from '../../../store/appStore';
import { WidgetSkeleton } from './dashboardUtils';
import { generateGradient } from '../../../lib/utils';


function getSubjectAcronym(name: string) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.slice(0, 2).toUpperCase();
  }
  return words
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

export default function AssignmentsScroll() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useAssignments({ limit: 8, placeholder: true });
  const visible = assignments
    .filter(a => !isExpired(a.dueDate) && a.status !== 'submitted')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 2);

  if (isLoading) return <WidgetSkeleton />;

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Assignments</span>
        <button className="section-link" onClick={() => navigate('/app/assignments')}>View all →</button>
      </div>
      {visible.length === 0 ? (
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PartyPopper size={24} color="var(--status-safe)" />
          </div>
          <div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>All caught up!</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>No active assignments right now.</p>
          </div>
        </div>
      ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visible.map(a => {
                const isSubmitted = a.status === 'submitted';
                const badgeCls = isSubmitted ? 'badge-safe' : deadlineBadgeClass(a.dueDate);
                const label = isSubmitted ? 'Submitted' : deadlineLabel(a.dueDate);
                return (
                <div 
                  key={a.id} 
                  className="list-row" 
                  onClick={() => navigate('/app/assignments')} 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: 12 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 10, 
                      background: generateGradient(a.subjectCode || a.subject), 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)'
                    }}>
                      <span className="t-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {getSubjectAcronym(a.subject)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate t-button" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{a.subject}</div>
                      <div className="truncate t-mono-sm" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{a.title}</span>
                        {a.attachments && a.attachments.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
                            · <Paperclip size={10} style={{ display: 'inline-block' }} /> {a.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${badgeCls} t-badge`} style={{ flexShrink: 0 }}>{label}</span>
                </div>
              );
            })}
            </div>
          </div>
      )}
    </section>
  );
}
