import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState, timeAgo, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import { mockAnnouncements } from '../../data/mockData';
import { showToast } from '../../components/Toast';

type Filter = 'all' | 'critical' | 'general';

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { acknowledgedIds, acknowledge } = useAppStore();

  const filtered = mockAnnouncements.filter(a =>
    filter === 'all' ? true : a.priority === filter
  ).sort((a, b) => {
    // Critical always first
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="ann-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>Announcements</h1>
          <CROnly>
            <button id="post-ann-btn" style={{ font: '600 13px var(--font-body)', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}>
              + Post
            </button>
          </CROnly>
        </div>
        <div className="filter-tabs">
          {(['all', 'critical', 'general'] as Filter[]).map(f => (
            <button key={f} id={`ann-filter-${f}`} className={`filter-tab${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="page-content">
        {filtered.length === 0
          ? <EmptyState emoji="📭" title="Nothing here" subtitle="No announcements in this category" />
          : filtered.map(ann => {
            const isCritical = ann.priority === 'critical';
            const isAcked = acknowledgedIds.includes(ann.id);
            const bdg = deadlineBadgeClass(ann.deadline);
            const lbl = deadlineLabel(ann.deadline);

            return (
              <article key={ann.id} className="card" style={{
                borderLeft: isCritical ? '3px solid var(--status-critical)' : undefined,
                background: isCritical ? 'rgba(255,68,68,0.05)' : undefined,
                animation: 'fadeSlideUp 0.35s ease both',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {isCritical && (
                        <span className="badge badge-critical">
                          <AlertTriangle size={10} /> CRITICAL
                        </span>
                      )}
                      {ann.deadline && <span className={`badge ${bdg}`}>{lbl}</span>}
                    </div>
                    <h2 style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {ann.title}
                    </h2>
                    <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 10 }}>
                      Posted {timeAgo(ann.postedAt)}
                    </p>
                  </div>
                </div>

                <p style={{ font: '400 14px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  {ann.body}
                </p>

                {!isAcked ? (
                  <button
                    id={`ack-btn-${ann.id}`}
                    onClick={() => { acknowledge(ann.id); showToast('Acknowledged ✓', 'success'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      font: '500 13px var(--font-body)', color: 'var(--text-primary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <CheckCircle2 size={15} /> Acknowledge
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.25)', borderRadius: 'var(--radius-md)' }}>
                    <CheckCircle2 size={15} color="var(--status-safe)" />
                    <span style={{ font: '500 13px var(--font-body)', color: 'var(--status-safe)' }}>Acknowledged</span>
                  </div>
                )}
              </article>
            );
          })
        }
      </main>

      <CROnly>
        <button id="post-ann-fab" className="fab" aria-label="Post announcement">
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
