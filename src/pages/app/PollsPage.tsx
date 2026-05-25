import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, AlertTriangle, BarChart2, Trash2, X, Circle, CircleDot, Square, CheckSquare } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import type { Poll } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { usePolls, useActionablePollVotes } from '../../hooks/useSupabaseQuery';
import { useDeletePoll, useVotePoll, useCreatePoll } from '../../hooks/useSupabaseMutations';
import { BottomSheet } from '../../components/BottomSheet';
import { PollsSkeleton } from '../../components/LoadingSkeletons';

type PollTab = 'active' | 'closed';

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `Closes in ${days}d ${hrs}h` : `Closes in ${hrs}h`;
}

function PollCard({ poll, onDelete }: { poll: Poll; onDelete: (id: string) => void }) {
  const role = useAppStore(s => s.role);
  const voteMutation = useVotePoll();
  const userVotes = poll.userVotes ?? (poll.userVote ? [poll.userVote] : []);
  const [showWarning, setShowWarning] = useState(poll.type === 'actionable' && userVotes.length === 0);
  const [warningAccepted, setWarningAccepted] = useState(poll.type !== 'actionable' || userVotes.length > 0);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  const { data: voterVotes = [], isLoading: isLoadingVoters } = useActionablePollVotes(
    poll.id,
    role === 'cr' && poll.type === 'actionable'
  );

  const isClosed = poll.status === 'closed';

  const handleVote = async (optId: string, isSelected: boolean) => {
    if (isClosed) return;
    try {
      await voteMutation.mutateAsync({
        pollId: poll.id,
        optionId: optId,
        pollType: poll.type,
        allowMultiple: poll.allowMultiple,
        isSelected
      });
      showToast(isSelected ? 'Vote removed' : 'Vote submitted!', 'success');
    } catch {
      showToast('Failed to vote', 'error');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {poll.type === 'actionable' && (
            <span className="badge badge-warning">
              <AlertTriangle size={10} /> CR-Visible
            </span>
          )}
          <span className="badge badge-info">
            {poll.type === 'anonymous' ? 'Anonymous' : 'Actionable'}
          </span>
          {poll.allowMultiple && (
            <span className="badge badge-safe" style={{ background: 'rgba(52,201,123,0.1)', border: '1px solid rgba(52,201,123,0.2)', color: 'var(--status-safe)' }}>
              Multiple Choice
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono-sm" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {isClosed ? 'Closed' : timeLeft(poll.closesAt)}
          </span>
          {role === 'cr' && (
            <button
              id={`del-poll-${poll.id}`}
              onClick={() => onDelete(poll.id)}
              style={{
                background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: 8, padding: '5px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title="Delete poll"
            >
              <Trash2 size={13} color="var(--status-critical)" />
            </button>
          )}
        </div>
      </div>

      <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 14 }}>
        {poll.question}
      </p>

      {/* Actionable warning */}
      {poll.type === 'actionable' && showWarning && !warningAccepted && (
        <div style={{ background: 'var(--status-warning-bg)', border: '1px solid rgba(255,181,71,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 14 }}>
          <p className="t-body-medium" style={{ color: 'var(--status-warning)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> The CR can see your individual response for this poll.
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
      {(!showWarning || warningAccepted || isClosed || userVotes.length > 0) && (
        <div className="vote-bar-wrap">
          {poll.options.map(opt => {
            const pct = poll.voterCount && poll.voterCount > 0 ? Math.min(100, Math.round((opt.votes / poll.voterCount) * 100)) : 0;
            const isSelected = userVotes.includes(opt.id);
            const hasVoted = userVotes.length > 0 || isClosed;
            const showResults = hasVoted || role === 'cr';

            const Icon = poll.allowMultiple
              ? (isSelected ? CheckSquare : Square)
              : (isSelected ? CircleDot : Circle);

            const optVoters = voterVotes.filter(v => v.optionId === opt.id);

            return (
              <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  id={`vote-opt-${opt.id}`}
                  className={`vote-option${isSelected ? ' selected' : ''}${showResults ? ' voted' : ''}`}
                  style={{ width: '100%', cursor: isClosed ? 'default' : 'pointer' }}
                  onClick={() => handleVote(opt.id, isSelected)}
                  disabled={isClosed}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showResults ? 6 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                          <Icon size={15} />
                        </span>
                        <span className="t-body" style={{ color: 'var(--text-primary)' }}>{opt.text}</span>
                      </div>
                      {showResults && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="t-mono" style={{ color: 'var(--accent-primary)' }}>{pct}%</span>
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({opt.votes})</span>
                        </div>
                      )}
                    </div>
                    {showResults && (
                      <div style={{ height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden', marginLeft: 23 }}>
                        <div className="vote-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </button>

                {role === 'cr' && poll.type === 'actionable' && (
                  <div style={{ marginTop: 2, marginBottom: 6, marginLeft: 24 }}>
                    <button className="t-helper"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setExpandedOption(expandedOption === opt.id ? null : opt.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 0',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <span style={{ textDecoration: 'underline' }}>
                        {expandedOption === opt.id ? 'Hide voters' : 'View voters'}
                      </span>
                      <span className="t-badge" style={{ background: 'rgba(255,255,255,0.06)', 
                        padding: '1px 5px', 
                        borderRadius: 4,
                        color: 'var(--text-primary)' }}>
                        {optVoters.length}
                      </span>
                    </button>
                    
                    {expandedOption === opt.id && (
                      <div 
                        style={{ 
                          marginTop: 6, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 4, 
                          padding: '8px 10px', 
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        {isLoadingVoters ? (
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
                        ) : optVoters.length === 0 ? (
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>No votes yet</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {optVoters.map((voter) => (
                              <span
                                key={voter.studentId}
                                className="badge badge-info"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: 10,
                                  background: 'rgba(34, 211, 238, 0.06)',
                                  border: '1px solid rgba(34, 211, 238, 0.12)'
                                }}
                              >
                                {voter.studentName} {voter.classRoll ? `(${voter.classRoll})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="t-mono-sm t-body" style={{ color: 'var(--text-muted)', marginTop: 12 }}>
        {poll.voterCount ?? 0} voted
      </p>
    </div>
  );
}

export function CreatePollSheet({ onClose }: { onClose: () => void }) {
  const createPoll = useCreatePoll();
  const [question, setQuestion] = useState('');
  const [pollType, setPollType] = useState<'general' | 'actionable'>('general');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [expiryHours, setExpiryHours] = useState('24');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddOption = () => {
    if (options.length >= 6) {
      showToast('Maximum 6 options allowed', 'warning');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      showToast('Minimum 2 options required', 'warning');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      showToast('Question is required', 'error');
      return;
    }
    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      showToast('At least 2 valid options are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const expiresAt = expiryHours
        ? new Date(Date.now() + parseFloat(expiryHours) * 3600000).toISOString()
        : null;

      await createPoll.mutateAsync({
        question: question.trim(),
        pollType,
        expiresAt,
        options: filteredOptions,
        allowMultiple,
      });

      showToast('Poll created successfully!', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create poll', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    boxSizing: 'border-box',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',    outline: 'none',
  };

  return (
    <BottomSheet onClose={onClose} title="Create Poll">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
        {/* Question */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            Question <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input
            id="poll-question-input"
            required
            style={inputStyle}
            placeholder="e.g. Should we reschedule tomorrow's extra class?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
        </div>

        {/* Poll Type Toggle */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            Poll Type
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="t-button"
              id="poll-type-general-btn"
              type="button"
              onClick={() => setPollType('general')}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                background: pollType === 'general' ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${pollType === 'general' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                color: pollType === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              Anonymous (General)
            </button>
            <button className="t-button"
              id="poll-type-actionable-btn"
              type="button"
              onClick={() => setPollType('actionable')}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                background: pollType === 'actionable' ? 'rgba(255,181,71,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${pollType === 'actionable' ? 'var(--status-warning)' : 'var(--border-default)'}`,
                color: pollType === 'actionable' ? 'var(--status-warning)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              Actionable (CR Visible)
            </button>
          </div>
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            {pollType === 'general'
              ? 'Votes are completely secure and anonymous. CR cannot trace individual responses.'
              : 'CR will be able to see who voted for which option.'}
          </p>
        </div>

        {/* Multi-Select Option */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s',
        }} onClick={() => setAllowMultiple(!allowMultiple)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>
              Multiple Choice Poll
            </span>
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
              Allow students to select more than one option
            </span>
          </div>
          <div style={{
            width: 36,
            height: 20,
            background: allowMultiple ? 'var(--accent-primary)' : 'var(--border-default)',
            borderRadius: 10,
            padding: 2,
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: allowMultiple ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              width: 16,
              height: 16,
              background: '#fff',
              borderRadius: '50%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
            }} />
          </div>
        </div>

        {/* Dynamic Options */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="t-subtitle" style={{ color: 'var(--text-primary)' }}>
              Options <span style={{ color: 'var(--status-critical)' }}>*</span>
            </label>
            {options.length < 6 && (
              <button
                id="add-poll-option-btn"
                type="button"
                onClick={handleAddOption} className="t-label" style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
              >
                <Plus size={14} /> Add Option
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map((opt, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id={`poll-option-input-${idx}`}
                  required
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={e => handleOptionChange(idx, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    id={`remove-poll-option-btn-${idx}`}
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    style={{
                      background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                      borderRadius: 'var(--radius-md)', padding: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={14} color="var(--status-critical)" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            Poll Duration
          </label>
          <select
            id="poll-duration-select"
            style={inputStyle}
            value={expiryHours}
            onChange={e => setExpiryHours(e.target.value)}
          >
            <option value="1">1 Hour</option>
            <option value="4">4 Hours</option>
            <option value="12">12 Hours</option>
            <option value="24">1 Day</option>
            <option value="48">2 Days</option>
            <option value="168">1 Week</option>
          </select>
        </div>

        {/* Submit */}
        <button
          id="create-poll-submit-btn"
          type="submit"
          disabled={loading} className="t-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: loading ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: loading ? 'not-allowed' : 'pointer',
            color: loading ? 'var(--text-muted)' : '#fff',
            transition: 'all 0.2s', marginTop: 8 }}
        >
          {loading ? 'Creating...' : 'Create Poll'}
        </button>
      </form>
    </BottomSheet>
  );
}

export default function PollsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<PollTab>('active');
  const [showCreateSheet, setShowCreateSheet] = useState(() => Boolean(location.state?.openCreate));
  const { data: polls = [], isLoading } = usePolls();
  const deletePollMutation = useDeletePoll();

  useEffect(() => {
    if (location.state?.openCreate) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-expiry: hide polls gone past closesAt + 2 days
  const [now] = useState(Date.now);
  const visible = polls.filter(p => {
    const closesAtTime = new Date(p.closesAt).getTime();
    const twoDaysAfter = closesAtTime + 2 * 24 * 3600 * 1000;
    return now < twoDaysAfter;
  });
  const filtered = visible.filter(p => p.status === tab);

  const handleDelete = async (id: string) => {
    try {
      await deletePollMutation.mutateAsync(id);
      showToast('Poll deleted', 'info');
    } catch { showToast('Failed to delete poll', 'error'); }
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="polls-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <BarChart2 size={18} color="var(--accent-primary)" />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Polls</h1>
          </div>
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
        {isLoading ? (
          <PollsSkeleton />
        ) : filtered.length === 0
          ? <EmptyState icon={<BarChart2 size={36} color="var(--text-muted)" />} title="No polls here" subtitle="Check back later" />
          : filtered.map(p => <PollCard key={p.id} poll={p} onDelete={handleDelete} />)
        }
      </main>

      <CROnly>
        <button id="create-poll-fab" className="fab" aria-label="Create poll" onClick={() => setShowCreateSheet(true)}>
          <Plus size={22} />
        </button>
      </CROnly>

      {showCreateSheet && <CreatePollSheet onClose={() => setShowCreateSheet(false)} />}

      <NavBar />
    </div>
  );
}
