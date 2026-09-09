import { useState } from 'react';
import { ShieldCheck, ChevronUp, ChevronDown, Users, XCircle, RefreshCw, Unlock, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import {
  useSectionCRs,
  useSectionMembers,
  usePromoteToCoCR,
  useDemoteCoCR,
  useTransferPrimaryCR,
  useResignAsCR,
} from '../../../hooks/useSectionMembers';
import { BottomSheet } from '../../../components/BottomSheet';
import { toast } from 'sonner';

export function ManageCRs() {
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
