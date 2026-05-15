import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import { mockPolls } from '../../data/mockData';
import { showToast } from '../../components/Toast';

type PollTab = 'active' | 'closed';

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `Closes in ${days}d ${hrs}h` : `Closes in ${hrs}h`;
}

function PollCard({ poll }: { poll: typeof mockPolls[0] }) {
  const { vote: storeVote, pollVotes } = useAppStore();
  const userVote = pollVotes[poll.id] ?? poll.userVote;
  const [showWarning, setShowWarning] = useState(poll.type === 'actionable' && !userVote);
  const [warningAccepted, setWarningAccepted] = useState(poll.type !== 'actionable' || !!userVote);

  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const isClosed = poll.status === 'closed';

  const handleVote = (optId: string) => {
    if (userVote || isClosed) return;
    storeVote(poll.id, optId);
    showToast('Vote submitted!', 'success');
  };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {poll.type === 'actionable' && (
            <span className="badge badge-warning">
              <AlertTriangle size={10} /> CR-Visible
            </span>
          )}
          <span className="badge badge-info">
            {poll.type === 'anonymous' ? 'Anonymous' : 'Actionable'}
          </span>
        </div>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {isClosed ? 'Closed' : timeLeft(poll.closesAt)}
        </span>
      </div>

      <p style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 14 }}>
        {poll.question}
      </p>

      {/* Actionable warning */}
      {poll.type === 'actionable' && showWarning && !warningAccepted && (
        <div style={{ background: 'var(--status-warning-bg)', border: '1px solid rgba(255,181,71,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ font: '500 13px var(--font-body)', color: 'var(--status-warning)', marginBottom: 10 }}>
            ⚠ The CR can see your individual response for this poll.
          </p>
          <button
            id={`accept-warning-${poll.id}`}
            className="btn-secondary"
            style={{ width: '100%', fontSize: 13 }}
            onClick={() => { setWarningAccepted(true); setShowWarning(false); }}
          >
            I understand, show options
          </button>
        </div>
      )}

      {/* Options */}
      {(!showWarning || warningAccepted || isClosed || userVote) && (
        <div className="vote-bar-wrap">
          {poll.options.map(opt => {
            const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
            const isSelected = userVote === opt.id;
            const hasVoted = !!userVote || isClosed;
            return (
              <div key={opt.id}>
                <button
                  id={`vote-opt-${opt.id}`}
                  className={`vote-option${isSelected ? ' selected' : ''}${hasVoted ? ' voted' : ''}`}
                  style={{ width: '100%', cursor: hasVoted ? 'default' : 'pointer' }}
                  onClick={() => handleVote(opt.id)}
                  disabled={hasVoted}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: hasVoted ? 6 : 0 }}>
                      <span style={{ font: '400 13px var(--font-body)', color: 'var(--text-primary)' }}>{opt.text}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasVoted && <span style={{ font: '600 12px var(--font-mono)', color: 'var(--accent-primary)' }}>{pct}%</span>}
                        {isSelected && <CheckCircle2 size={14} color="var(--accent-primary)" />}
                      </div>
                    </div>
                    {hasVoted && (
                      <div style={{ height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                        <div className="vote-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)', marginTop: 12 }}>
        {total} voted
      </p>
    </div>
  );
}

export default function PollsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<PollTab>('active');
  const filtered = mockPolls.filter(p => p.status === tab);

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="polls-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Polls</h1>
        </div>
        <div className="filter-tabs">
          {(['active', 'closed'] as PollTab[]).map(t => (
            <button key={t} id={`poll-tab-${t}`} className={`filter-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="page-content">
        {filtered.length === 0
          ? <EmptyState emoji="📊" title="No polls here" subtitle="Check back later" />
          : filtered.map(p => <PollCard key={p.id} poll={p} />)
        }
      </main>

      <CROnly>
        <button id="create-poll-fab" className="fab" aria-label="Create poll">
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
