import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, AlertTriangle, BarChart2, Trash2, X, Circle, CircleDot, Square, CheckSquare } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import type { Poll } from '../../store/appStore';
import { toast } from 'sonner';
import { usePolls, useActionablePollVotes, usePollsRealtime, useDeletePoll, useVotePoll, useCreatePoll } from '../../hooks/usePolls';
import { useSchedule } from '../../hooks/useSchedule';
import { useSectionMembers } from '../../hooks/useSectionMembers';
import { BottomSheet } from '../../components/BottomSheet';
import { haptics } from '../../lib/haptics';
import Skeleton from 'react-loading-skeleton';

function PollsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Skeleton width={80} height={16} borderRadius="var(--radius-pill)" />
              <Skeleton width={60} height={16} borderRadius="var(--radius-pill)" />
            </div>
            <Skeleton width={70} height={12} />
          </div>
          <Skeleton width="85%" height={18} style={{ margin: '4px 0 8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="100%" height={40} borderRadius="var(--radius-md)" />
            <Skeleton width="100%" height={40} borderRadius="var(--radius-md)" />
            <Skeleton width="100%" height={40} borderRadius="var(--radius-md)" />
          </div>
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

type PollTab = 'active' | 'closed';

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `Closes in ${days}d ${hrs}h` : `Closes in ${hrs}h`;
}

function PollCard({ poll, onDelete, totalStudents }: { poll: Poll; onDelete: (id: string) => void; totalStudents: number }) {
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
  const isMassBunkPoll = poll.options.length === 2 && poll.options.some(o => o.text === 'Ditch & Chill');

  const ditchOpt = poll.options.find(o => o.text === 'Ditch & Chill');
  const ditchVotes = ditchOpt ? ditchOpt.votes : 0;
  const ditchPct = isMassBunkPoll ? Math.min(100, Math.round((ditchVotes / totalStudents) * 100)) : 0;

  const isPending = voteMutation.isPending && voteMutation.variables?.pollId === poll.id;

  const handleVote = async (optId: string, isSelected: boolean) => {
    if (isClosed || isPending) return;
    if (isSelected) {
      haptics.heavyClick();
    } else {
      haptics.lightClick();
    }
    try {
      await voteMutation.mutateAsync({
        pollId: poll.id,
        optionId: optId,
        pollType: poll.type,
        allowMultiple: poll.allowMultiple,
        isSelected
      });
      toast.success(isSelected ? 'Vote removed' : 'Vote submitted!');
    } catch {
      toast.error('Failed to vote');
    }
  };

  const cardStyle: React.CSSProperties = isMassBunkPoll && ditchPct >= 60 ? {
    animation: 'massBunkGlow 3s infinite ease-in-out',
    border: '1px solid rgba(239, 68, 68, 0.45)',
    marginBottom: 0
  } : { marginBottom: 0 };

  return (
    <div className="card" style={cardStyle}>
      {isMassBunkPoll && ditchPct >= 60 && (
        <style>{`
          @keyframes massBunkGlow {
            0% {
              box-shadow: 0 0 12px rgba(239, 68, 68, 0.25), inset 0 0 6px rgba(239, 68, 68, 0.1);
              border-color: rgba(239, 68, 68, 0.35);
            }
            50% {
              box-shadow: 0 0 24px rgba(239, 68, 68, 0.55), inset 0 0 12px rgba(239, 68, 68, 0.25);
              border-color: rgba(239, 68, 68, 0.7);
            }
            100% {
              box-shadow: 0 0 12px rgba(239, 68, 68, 0.25), inset 0 0 6px rgba(239, 68, 68, 0.1);
              border-color: rgba(239, 68, 68, 0.35);
            }
          }
          @keyframes pulseWarning {
            0% { opacity: 0.95; }
            50% { opacity: 1; transform: scale(1.005); }
            100% { opacity: 0.95; }
          }
        `}</style>
      )}

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
            const pct = isMassBunkPoll
              ? Math.min(100, Math.round((opt.votes / totalStudents) * 100))
              : (poll.voterCount && poll.voterCount > 0 ? Math.min(100, Math.round((opt.votes / poll.voterCount) * 100)) : 0);
            
            const isSelected = userVotes.includes(opt.id);
            const hasVoted = userVotes.length > 0 || isClosed;
            const showResults = hasVoted || role === 'cr';

            const Icon = poll.allowMultiple
              ? (isSelected ? CheckSquare : Square)
              : (isSelected ? CircleDot : Circle);

            const optVoters = voterVotes.filter(v => v.optionId === opt.id);

            let fillBackground = '';
            let optionBorder = '1.5px solid var(--border-default)';
            let textSecondaryColor = showResults ? 'var(--text-secondary)' : 'var(--text-primary)';
            let percentColor = 'var(--accent-primary)';

            if (showResults) {
              if (isMassBunkPoll && opt.text === 'Ditch & Chill') {
                const isCritical = pct >= 60;
                fillBackground = isCritical ? 'rgba(248, 113, 113, 0.15)' : 'rgba(251, 191, 36, 0.12)';
                percentColor = isCritical ? 'var(--status-critical)' : 'var(--status-warning)';
                textSecondaryColor = percentColor;
                if (isSelected) {
                  optionBorder = isCritical ? '1.5px solid var(--status-critical)' : '1.5px solid var(--status-warning)';
                } else {
                  optionBorder = isCritical ? '1.5px solid rgba(248, 113, 113, 0.3)' : '1.5px solid rgba(251, 191, 36, 0.25)';
                }
              } else {
                fillBackground = isSelected ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.04)';
                percentColor = 'var(--accent-primary)';
                textSecondaryColor = isSelected ? 'var(--text-accent)' : 'var(--text-secondary)';
                if (isSelected) {
                  optionBorder = '1.5px solid var(--accent-primary)';
                }
              }
            } else {
              if (isSelected) {
                optionBorder = '1.5px solid var(--accent-primary)';
              }
            }

            return (
              <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  id={`vote-opt-${opt.id}`}
                  className={`vote-option${isSelected ? ' selected' : ''}${showResults ? ' voted' : ''}`}
                  style={{ 
                    width: '100%', 
                    cursor: isClosed ? 'default' : (isPending ? 'not-allowed' : 'pointer'),
                    border: showResults ? optionBorder : undefined,
                    opacity: isPending ? 0.85 : 1
                  }}
                  onClick={() => handleVote(opt.id, isSelected)}
                  disabled={isClosed || isPending}
                >
                  {showResults && (
                    <div 
                      className="vote-option-fill"
                      style={{
                        width: `${pct}%`,
                        background: fillBackground,
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!showResults && (
                        <span style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                          <Icon size={15} />
                        </span>
                      )}
                      <span className="t-body" style={{ color: textSecondaryColor, fontWeight: showResults && isSelected ? 600 : 400 }}>
                        {opt.text}
                        {showResults && isSelected && ' ✓'}
                      </span>
                    </div>
                    {showResults && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="t-mono" style={{ color: percentColor, fontWeight: 600 }}>{pct}%</span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({opt.votes})</span>
                      </div>
                    )}
                  </div>
                </button>

                {showResults && isMassBunkPoll && opt.text === 'Ditch & Chill' && (
                  <p className="t-mono-sm" style={{ 
                    marginLeft: 12, marginTop: 4, marginBottom: 8,
                    color: pct >= 60 ? 'var(--status-critical)' : 'var(--status-warning)',
                    fontWeight: pct >= 60 ? 600 : 400
                  }}>
                    {pct < 21 ? "Low energy... are we really going to sit through this?" :
                     pct < 41 ? "Building momentum. Grab your friends." :
                     pct < 60 ? "Right on the edge! Need a few more rebels." :
                     "BUNK IS ON! Cancel the alarms, we are staying in."}
                  </p>
                )}

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
                        color: 'var(--text-secondary)',                        display: 'flex',
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

      {isMassBunkPoll && ditchPct >= 60 && (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          animation: 'pulseWarning 2.5s infinite ease-in-out'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🚨 MASS BUNK IN EFFECT — Stay Safe. (60% section-wide threshold crossed: {ditchVotes} of {totalStudents} members)
          </span>
        </div>
      )}

      <p className="t-mono-sm t-body" style={{ color: 'var(--text-muted)', marginTop: 12 }}>
        {poll.voterCount ?? 0} voted {isMassBunkPoll ? `(out of ${totalStudents} total members)` : ''}
      </p>
    </div>
  );
}

export function CreatePollSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createPoll = useCreatePoll();
  const [question, setQuestion] = useState('');
  const [pollType, setPollType] = useState<'general' | 'actionable'>('general');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [expiryHours, setExpiryHours] = useState('24');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const { data: schedule } = useSchedule();
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  const todaysClasses = (schedule?.[todayStr] || []).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  const applyMassBunkTemplate = (className: string, classStartTime: string) => {
    setQuestion(`Are we bunking ${className} today?`);
    setPollType('actionable');
    setOptions(['Ditch & Chill', 'Front Bench Energy']);
    setAllowMultiple(false);
    
    const now = new Date();
    const [h, m] = classStartTime.split(':').map(Number);
    const classTime = new Date(now);
    classTime.setHours(h, m, 0, 0);
    
    // If class already started or is in past, default to 1 hour
    const diffHours = (classTime.getTime() - now.getTime()) / 3600000;
    setExpiryHours(diffHours > 0 ? diffHours.toFixed(1) : '1');
  };

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast.warning('Maximum 6 options allowed');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.warning('Minimum 2 options required');
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
      toast.error('Question is required');
      return;
    }
    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      toast.error('At least 2 valid options are required');
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

      toast.success('Poll created successfully!');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create poll');
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
    <BottomSheet 
      open={open}
      onClose={onClose} 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative' }}>
          <span style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)' }}>Create Poll</span>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="bunk-template-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTemplateDropdown(prev => !prev);
              }}
              style={{
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                color: 'var(--status-warning)',
                padding: '5px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
            >
              <span>Mass Bunk</span>
            </button>
            {showTemplateDropdown && (
              <div style={{
                position: 'absolute',
                top: '32px',
                right: '0px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                zIndex: 1000,
                width: '200px',
                padding: '6px 0',
              }}>
                {todaysClasses.length > 0 ? (
                  <>
                    <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-default)' }}>
                      Select Today's Class:
                    </div>
                    {todaysClasses.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          applyMassBunkTemplate(c.subject, c.startTime);
                          setShowTemplateDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        {c.subject} ({c.startTime})
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />
                  </>
                ) : (
                  <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    No classes scheduled today
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    applyMassBunkTemplate('Class', '12:00');
                    setShowTemplateDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-warning)',
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Apply Generic Template
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
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
  
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId ?? null;
  const role = useAppStore(s => s.role);
  usePollsRealtime(sectionId);

  const { data: polls = [], isLoading } = usePolls();
  const deletePollMutation = useDeletePoll();
  const createPoll = useCreatePoll();

  const { data: schedule } = useSchedule();
  const { data: members = [] } = useSectionMembers();
  const totalStudents = members.length || 1;

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  const todaysClasses = (schedule?.[todayStr] || []).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  const handleQuickBunk = async (className: string, classStartTime: string) => {
    try {
      const now = new Date();
      const [h, m] = classStartTime.split(':').map(Number);
      const classTime = new Date(now);
      classTime.setHours(h, m, 0, 0);
      
      const diffHours = (classTime.getTime() - now.getTime()) / 3600000;
      const expiresAt = new Date(now.getTime() + (diffHours > 0 ? diffHours : 1) * 3600000).toISOString();

      await createPoll.mutateAsync({
        question: `Are we bunking ${className} today?`,
        pollType: 'actionable',
        expiresAt,
        options: ['Ditch & Chill', 'Front Bench Energy'],
        allowMultiple: false,
      });

      toast.success(`🚨 Bunk poll launched for ${className}!`);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Failed to launch bunk poll');
    }
  };
  
  const [highlightId] = useState<string | null>(() => new URLSearchParams(location.search).get('highlight'));
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (location.state?.openCreate) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Clear highlight param from URL without navigation, then scroll to card
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove ?highlight from URL visually
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('highlight');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightId]);

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
      toast.info('Poll deleted');
    } catch { toast.error('Failed to delete poll'); }
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
        {role === 'cr' && (
          <div 
            className="card" 
            style={{ 
              marginBottom: 20, 
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(13, 15, 20, 0.4) 100%)',
              borderColor: 'rgba(251, 191, 36, 0.2)',
              boxShadow: 'inset 0 0 12px rgba(251, 191, 36, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <AlertTriangle size={15} color="var(--status-warning)" />
              <span className="t-mono-sm font-semibold" style={{ color: 'var(--status-warning)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10.5px' }}>
                Timetabled Mass Bunks Today
              </span>
            </div>
            
            {todaysClasses.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }} className="no-scrollbar">
                {todaysClasses.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleQuickBunk(c.subject, c.startTime)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all var(--transition-fast)',
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.4)';
                      e.currentTarget.style.color = 'var(--status-warning)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <span>{c.subject}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>({c.startTime})</span>
                    <Plus size={11} />
                  </button>
                ))}
                
                <button
                  type="button"
                  onClick={() => handleQuickBunk('Class', '12:00')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: 'rgba(251, 191, 36, 0.05)',
                    border: '1px dashed rgba(251, 191, 36, 0.3)',
                    borderRadius: 'var(--radius-pill)',
                    color: 'var(--status-warning)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all var(--transition-fast)',
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
                    e.currentTarget.style.borderStyle = 'solid';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.05)';
                    e.currentTarget.style.borderStyle = 'dashed';
                  }}
                >
                  <span>Custom Bunk</span>
                  <Plus size={11} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  No classes on schedule today.
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickBunk('Class', '12:00')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'rgba(251, 191, 36, 0.08)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--status-warning)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.3)';
                  }}
                >
                  <span>Launch Custom Bunk</span>
                  <Plus size={11} />
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <PollsSkeleton />
        ) : filtered.length === 0
          ? <EmptyState icon={<BarChart2 size={36} color="var(--text-muted)" />} title="No polls here" subtitle="Check back later" />
          : filtered.map(p => {
              const isHighlighted = highlightId === p.id;
              return (
                <div 
                  key={p.id}
                  ref={isHighlighted ? highlightRef : null}
                  style={isHighlighted ? { 
                    boxShadow: '0 0 0 2px var(--accent-primary)',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'box-shadow 0.5s ease-out'
                  } : {}}
                >
                  <PollCard poll={p} onDelete={handleDelete} totalStudents={totalStudents} />
                </div>
              );
            })
        }
      </main>

      <CROnly>
        <button id="create-poll-fab" className="fab" aria-label="Create poll" onClick={() => setShowCreateSheet(true)}>
          <Plus size={22} />
        </button>
      </CROnly>

      <CreatePollSheet open={showCreateSheet} onClose={() => setShowCreateSheet(false)} />

      <NavBar />
    </div>
  );
}
