import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { supabase } from '../../../lib/supabase';
import { signOutGlobal } from '../../../components/AuthProvider';
import { toast } from 'sonner';

export function ProfileDangerZone() {
  const navigate = useNavigate();
  const { clearHubState, refreshProfile } = useAppStore();
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleLeaveHub = async () => {
    setLeaving(true);
    try {
      const { error } = await supabase.rpc('leave_section_hub' as any);
      if (error) throw error;
      await refreshProfile();
      clearHubState();
      navigate('/onboarding/choice');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to leave hub: ${msg}`);
      console.error('[LeaveHub]', err);
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      const { error, data } = await supabase.functions.invoke('delete-account');
      if (error) {
        let detail = error.message;
        let isPartial = false;
        try {
          const body = typeof (error as any).context?.json === 'function'
            ? await (error as any).context.json()
            : null;
          if (body?.error) detail = body.error;
          if (body?.detail) detail += `: ${body.detail}`;
          if (body?.partial) isPartial = true;
        } catch { /* ignore parse errors */ }

        if (isPartial) {
          await signOutGlobal(navigate);
          toast.error('Account data deleted, but full removal needs admin action. Contact support.');
          return;
        }
        throw new Error(detail);
      }
      if (data && !data.success) throw new Error(data.error ?? 'Unknown error');
      await signOutGlobal(navigate);
      toast.success('Account deleted successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Delete failed: ${msg}`);
      console.error('[DeleteAccount]', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-default)' }}>
      <button
        type="button"
        className="settings-danger-toggle"
        onClick={() => setShowDangerZone(prev => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color="var(--text-muted)" />
          <span className="t-caption" style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Danger Zone Options
          </span>
        </div>
        <ChevronDown
          size={15}
          color="var(--text-muted)"
          style={{
            transform: showDangerZone ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {showDangerZone && (
        <div style={{ padding: 16, background: 'rgba(255, 68, 68, 0.05)', borderTop: '1px solid rgba(255, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!showLeaveConfirm ? (
            <button id="leave-hub-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-warning)' }}
              onClick={() => setShowLeaveConfirm(true)}>
              <Trash2 size={15} /> Leave Hub
            </button>
          ) : (
            <div style={{ background: 'var(--status-critical-bg)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>
                Are you sure? You'll need a new hub code to rejoin.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button id="confirm-leave-btn" className="t-button"
                  disabled={leaving}
                  style={{ flex: 1, padding: '10px', background: 'var(--status-critical)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: leaving ? 'not-allowed' : 'pointer', opacity: leaving ? 0.7 : 1 }}
                  onClick={handleLeaveHub}>{leaving ? 'Leaving…' : 'Leave'}</button>
                <button id="cancel-leave-btn" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>Cancel</button>
              </div>
            </div>
          )}

          {/* Delete Account — two-step confirmation */}
          {!showDeleteConfirm ? (
            <button id="delete-account-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-critical)' }}
              onClick={() => setShowDeleteConfirm(true)}>
              <AlertTriangle size={15} /> Delete Account
            </button>
          ) : (
            <div style={{ background: 'var(--status-critical-bg)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                This will permanently delete your account and all your data.
              </p>
              <p className="t-caption" style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                Type <strong style={{ color: 'var(--status-critical)' }}>DELETE</strong> to confirm.
              </p>
              <input
                id="delete-confirm-input"
                className="input"
                style={{ marginBottom: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
                placeholder="Type DELETE"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                autoComplete="off"
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  id="confirm-delete-btn"
                  disabled={deleteInput !== 'DELETE' || deleting} className="t-button" style={{ flex: 1, padding: '10px',
                    background: deleteInput === 'DELETE' ? 'var(--status-critical)' : 'var(--bg-elevated)',
                    color: deleteInput === 'DELETE' ? '#fff' : 'var(--text-muted)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                    opacity: deleting ? 0.6 : 1 }}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
                <button id="cancel-delete-btn" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
