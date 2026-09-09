import { useState } from 'react';
import { Lock, Eye, EyeOff, Copy, Share2, RefreshCw, Loader2 } from 'lucide-react';
import { useSection } from '../../../hooks/useSectionMembers';
import { useRegenerateInviteCode } from '../../../hooks/useSectionAdmin';
import { BottomSheet } from '../../../components/BottomSheet';
import { toast } from 'sonner';

export function TeacherInviteCodeCard() {
  const { data: section } = useSection();
  const regenerateCode = useRegenerateInviteCode();
  const [obscured, setObscured] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const teacherInviteCode = section?.teacherInviteCode || '......';

  const copyCode = () => {
    navigator.clipboard.writeText(teacherInviteCode);
    toast.success('Teacher invite code copied to clipboard!');
  };

  const shareCode = async () => {
    try {
      const inviteUrl = `${window.location.origin}/onboarding/join?role=teacher&invite=${teacherInviteCode}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Join ClassHub as Faculty!',
          text: `Join ${section?.name || ''} Hub on ClassHub as a Faculty member! Use this direct link: ${inviteUrl} (Invite Code: ${teacherInviteCode})`,
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
      await regenerateCode.mutateAsync('teacher');
      setConfirmOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rotate teacher invite code';
      toast.error(msg);
    }
  };

  return (
    <>
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(20, 23, 32, 0.8) 100%)',
        border: '1px solid var(--border-default)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Lock size={16} color="rgb(99, 102, 241)" />
          </div>
          <p className="t-card-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
            Teacher Invite Code
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginTop: 4,
        }}>
          <span className="t-feature" style={{
            letterSpacing: '0.12em',
            color: obscured ? 'var(--text-muted)' : 'rgb(99, 102, 241)',
            transition: 'color 0.2s',
          }}>
            {obscured ? '••••••••' : teacherInviteCode}
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

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
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
      </div>

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Rotate Teacher Invite Code?">
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
                This will immediately invalidate the current teacher code. Existing registered teachers will remain unaffected, but new faculty members must use the new code to join.
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
