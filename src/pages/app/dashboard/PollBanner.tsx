import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolls } from '../../../hooks/useSupabaseQuery';
import { isExpired } from '../../../store/appStore';

export default function PollBanner() {
  const navigate = useNavigate();
  const { data: polls = [] } = usePolls();
  const [now] = useState(() => Date.now());
  const poll = polls.find(p => p.status === 'active' && !isExpired(p.closesAt));
  if (!poll) return null;

  const closes = new Date(poll.closesAt).getTime() - now;
  const closesD = Math.floor(closes / 86400000);
  const closesH = Math.floor((closes % 86400000) / 3600000);

  return (
    <section>
      <div className="section-header">
        <span className="section-title">Polls</span>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
          Closes in {closesD}d {closesH}h
        </span>
      </div>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/polls')}>
        <p className="t-button" style={{ color: 'var(--text-primary)', marginBottom: 14 }}>{poll.question}</p>
        {poll.options.slice(0, 2).map(opt => {
          const pct = poll.voterCount && poll.voterCount > 0 ? Math.min(100, Math.round((opt.votes / poll.voterCount) * 100)) : 0;
          return (
            <div key={opt.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>{opt.text}</span>
                <span className="t-mono" style={{ color: 'var(--accent-primary)' }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2, animation: 'barFill 0.8s ease both' }} />
              </div>
            </div>
          );
        })}
        <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 12 }}>
          {poll.voterCount ?? 0} students voted · <span style={{ color: 'var(--accent-primary)' }}>Go to Polls →</span>
        </p>
      </div>
    </section>
  );
}
