import { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, Copy, Share2, RefreshCw, Loader2 } from 'lucide-react';
import { useSection } from '../../../hooks/useSectionMembers';
import { useToggleEnrollment, useRegenerateInviteCode } from '../../../hooks/useSectionAdmin';
import { BottomSheet } from '../../../components/BottomSheet';
import { toast } from 'sonner';

export function InviteCodeCard() {
  const { data: section } = useSection();
  const toggleEnrollment = useToggleEnrollment();
  const regenerateCode = useRegenerateInviteCode();
  const [obscured, setObscured] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inviteCode = section?.inviteCode || '......';
  const isLocked = section?.isEnrollmentLocked ?? false;

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied to clipboard!');
  };

  const shareCode = async () => {
    try {
      const inviteUrl = `${window.location.origin}/onboarding/join?invite=${inviteCode}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Join ClassHub!',
          text: `Join your Section's Hub ${section?.name || ''} on ClassHub! Use this direct link to access it : ${inviteUrl} (Invite Code: ${inviteCode})`,
        });
      } else {
        throw new Error('Not supported');
      }
    } catch {
      copyCode();
    }
  };

  const handleRotate = async () => {
    try {
      await regenerateCode.mutateAsync('student');
      setConfirmOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rotate invite code';
      toast.error(message);
    }
  };

  return (
    <>
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.05) 0%, rgba(20, 23, 32, 0.8) 100%)',
        border: '1px solid var(--border-default)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Lock size={16} color="var(--accent-primary)" />
            </div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', margin: 0 }}>
              Section Invite Code
            </p>
          </div>

          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: isLocked ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)',
            color: isLocked ? 'var(--status-critical)' : 'var(--status-safe)',
            border: isLocked ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
          }}>
            {isLocked ? '🔒 Enrollment Locked' : '🔓 Open to Join'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginTop: 2,
        }}>
          <span className="t-feature" style={{
            letterSpacing: '0.12em',
            color: obscured ? 'var(--text-muted)' : 'var(--accent-primary)',
            transition: 'color 0.2s',
          }}>
            {obscured ? '••••••' : inviteCode}
          </span>
          <button
            onClick={() => setObscured(!obscured)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 6, display: 'flex',
            }}
            title={obscured ? "Show Invite Code" : "Hide Invite Code"}
          >
            {obscured ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button 
            className="btn-secondary" 
            onClick={copyCode} 
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, minHeight: 'fit-content' }}
          >
            <Copy size={14} /> Copy
          </button>
          <button 
            className="btn-secondary" 
            onClick={shareCode} 
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, minHeight: 'fit-content' }}
          >
            <Share2 size={14} /> Share
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setConfirmOpen(true)}
            style={{ 
              padding: '8px 12px', 
              fontSize: 13, 
              minHeight: 'fit-content', 
              borderColor: 'rgba(255, 68, 68, 0.25)', 
              background: 'rgba(255, 68, 68, 0.02)',
              color: 'var(--status-critical)' 
            }}
          >
            <RefreshCw size={14} /> Rotate
          </button>
        </div>

        {/* Enrollment Lock Control Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          background: isLocked ? 'rgba(248, 113, 113, 0.06)' : 'rgba(52, 211, 153, 0.06)',
          border: isLocked ? '1px solid rgba(248, 113, 113, 0.2)' : '1px solid rgba(52, 211, 153, 0.2)',
          marginTop: 4,
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLocked ? <Lock size={15} color="var(--status-critical)" /> : <Unlock size={15} color="var(--status-safe)" />}
            <div>
              <p className="t-body-medium" style={{ color: isLocked ? 'var(--status-critical)' : 'var(--status-safe)', margin: 0, fontSize: 13 }}>
                {isLocked ? 'Enrollment Locked' : 'Enrollment Open'}
              </p>
              <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0, fontSize: 11 }}>
                {isLocked ? 'New student onboarding is disabled' : 'Students can join with this code'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="t-button"
            disabled={toggleEnrollment.isPending}
            onClick={() => toggleEnrollment.mutate(!isLocked)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background: isLocked ? 'var(--status-safe)' : 'rgba(255, 68, 68, 0.12)',
              color: isLocked ? '#0d0f14' : 'var(--status-critical)',
              border: isLocked ? 'none' : '1px solid rgba(255, 68, 68, 0.25)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {toggleEnrollment.isPending ? 'Updating…' : (isLocked ? 'Unlock Signups' : 'Lock Signups')}
          </button>
        </div>
      </div>

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Rotate Invite Code?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
          <div style={{
            background: 'rgba(255, 68, 68, 0.05)',
            border: '1.5px solid rgba(255, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 21, lineHeight: 1 }}>⚠️</span>
            <div>
              <p className="t-subtitle" style={{ color: 'var(--status-critical)', marginBottom: 3 }}>
                WARNING: Permanent Invalidation
              </p>
              <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                This will immediately invalidate the current code. Existing members will remain unaffected, but new students must use the new code to join.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button 
              className="btn-secondary" 
              onClick={() => setConfirmOpen(false)} 
              style={{ flex: 1, minHeight: 48 }}
            >
              Cancel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleRotate} 
              disabled={regenerateCode.isPending}
              style={{ 
                flex: 1, 
                background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)', 
                boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
                minHeight: 48,
              }}
            >
              {regenerateCode.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Rotate Code'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
