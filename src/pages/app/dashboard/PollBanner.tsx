import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolls } from '../../../hooks/usePolls';
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
            <div 
              key={opt.id} 
              className="vote-option voted"
              style={{ 
                width: '100%', 
                marginBottom: 8, 
                padding: '8px 12px',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div 
                className="vote-option-fill"
                style={{
                  width: `${pct}%`,
                  background: 'rgba(255, 255, 255, 0.04)',
                  transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 1 }}>
                <span className="t-body" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{opt.text}</span>
                <span className="t-mono" style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px' }}>{pct}%</span>
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
