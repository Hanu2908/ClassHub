import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { BottomSheet } from '../../../components/BottomSheet';
import { supabase } from '../../../lib/supabase';
import { type LinkedSubjectItem } from '../../../hooks/useProfileQueries';
import { toast } from 'sonner';

interface ProfileTeacherSectionsCardProps {
  linkedSubjects: LinkedSubjectItem[];
  refetchLinked: () => void;
  onOpenLinkSubjects: () => void;
}

export function ProfileTeacherSectionsCard({
  linkedSubjects,
  refetchLinked,
  onOpenLinkSubjects,
}: ProfileTeacherSectionsCardProps) {
  const { role, refreshProfile } = useAppStore();
  const [showJoinSectionDialog, setShowJoinSectionDialog] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningSection, setJoiningSection] = useState(false);

  if (role !== 'teacher') return null;

  const handleJoinSection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteCodeInput.trim() || inviteCodeInput.trim().length < 6) {
      toast.error('Enter a valid invite code (min 6 characters)');
      return;
    }

    setJoiningSection(true);
    try {
      const code = inviteCodeInput.trim().toUpperCase();

      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        toast.success('Joined section successfully! [Demo]');
        setShowJoinSectionDialog(false);
        setInviteCodeInput('');
        return;
      }

      const { data, error } = await supabase.rpc('join_section_as_teacher', {
        invite: code,
      });

      if (error) throw error;

      toast.success('Joined section successfully! 👨‍🏫');
      await refreshProfile();
      refetchLinked();

      setShowJoinSectionDialog(false);
      setInviteCodeInput('');

      if (data) {
        setTimeout(() => {
          onOpenLinkSubjects();
        }, 300);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join section';
      toast.error(msg);
    } finally {
      setJoiningSection(false);
    }
  };

  return (
    <>
      <div>
        <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>LINKED COURSES</p>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {linkedSubjects.length === 0 ? (
            <p className="t-caption" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
              No subjects linked to your account yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {linkedSubjects.map(item => {
                const sub = item.subjects;
                const sec = item.sections;
                if (!sub) return null;
                return (
                  <div key={item.subject_id + '-' + item.section_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          padding: '1px 5px', borderRadius: 4, background: `${sub.accent}20`,
                          color: sub.accent, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)'
                        }}>{sub.code}</span>
                        <span className="badge badge-info" style={{ fontSize: 12, padding: '1px 6px' }}>{sec?.name || 'Unknown Section'}</span>
                      </div>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 4 }}>{sub.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              id="manage-linkings-btn"
              onClick={onOpenLinkSubjects}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                background: 'rgba(74, 158, 255, 0.06)',
                border: '1px dashed rgba(74, 158, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Plus size={14} />
              <span>Link Subjects</span>
            </button>
            <button
              id="join-section-profile-btn"
              onClick={() => setShowJoinSectionDialog(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                background: 'rgba(74, 158, 255, 0.06)',
                border: '1px dashed rgba(74, 158, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Plus size={14} />
              <span>Join Section</span>
            </button>
          </div>
        </div>
      </div>

      {showJoinSectionDialog && (
        <BottomSheet
          open={showJoinSectionDialog}
          onClose={() => { setShowJoinSectionDialog(false); setInviteCodeInput(''); }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} style={{ color: 'var(--accent-primary)' }} />
              <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Join New Section Hub</span>
            </div>
          }
        >
          <form onSubmit={handleJoinSection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Enter the Teacher Invite Code provided by the Class Representative (CR) of the section you want to join.
            </p>

            <div>
              <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Teacher Invite Code
              </label>
              <input
                type="text"
                placeholder="e.g. T-P2WXYZ"
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                className="input mono"
                maxLength={10}
                style={{
                  letterSpacing: inviteCodeInput ? '0.15em' : 'normal',
                  fontSize: inviteCodeInput ? '16px' : '13px',
                  textAlign: 'center',
                  minHeight: '44px',
                  padding: '8px 12px',
                }}
                required
                disabled={joiningSection}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowJoinSectionDialog(false); setInviteCodeInput(''); }}
                disabled={joiningSection}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={joiningSection || !inviteCodeInput.trim()}
              >
                {joiningSection ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Join
              </button>
            </div>
          </form>
        </BottomSheet>
      )}
    </>
  );
}
