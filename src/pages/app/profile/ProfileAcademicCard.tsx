import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, BookOpen, Pencil, Mail } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useSection, useSectionMembers } from '../../../hooks/useSectionMembers';
import { useMyCounsellor, useUpdateProfilePreference } from '../../../hooks/useProfileQueries';
import { CopyButton } from '../../../components/CopyButton';
import { toast } from 'sonner';

export function ProfileAcademicCard() {
  const navigate = useNavigate();
  const { authUser, role, hub } = useAppStore();
  const { data: section } = useSection();
  const { data: members = [] } = useSectionMembers();

  const subBatch = authUser?.subBatch;
  const sectionId = authUser?.sectionId ?? undefined;
  const { data: counsellor = null } = useMyCounsellor(sectionId, subBatch);
  const updatePreference = useUpdateProfilePreference();

  const hubCode = section?.inviteCode ?? hub?.hubCode ?? '—';
  const sectionName = section?.name ?? hub?.section ?? '—';
  const institution = section?.college ?? hub?.institution ?? 'SKIT, Jaipur';
  const classRoll = authUser?.sectionRoll ?? hub?.classRoll ?? '—';
  const universityRoll = authUser?.universityRoll ?? hub?.universityRoll ?? '—';

  const handleToggleBatch = async () => {
    if (!authUser) return;
    const nextBatch = subBatch === '1' ? '2' : '1';
    try {
      await updatePreference.mutateAsync({ sub_batch: nextBatch });
      toast.success(`Group set to G${nextBatch}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch group';
      toast.error(msg);
    }
  };

  const handleToggleCommuterStatus = async () => {
    if (!authUser) return;
    const nextStatus = !authUser.dayScholar;
    try {
      await updatePreference.mutateAsync({ day_scholar: nextStatus });
      toast.success(`Status updated to ${nextStatus ? 'Day Scholar' : 'Hosteler'}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    }
  };

  const handleUpdatePhone = async () => {
    if (!authUser) return;
    const currentPhone = authUser.phone || '';
    const newPhone = prompt('Enter your 10-digit Indian phone number:', currentPhone);
    if (newPhone === null) return;
    const trimmed = newPhone.trim();
    if (role === 'student' && !trimmed) {
      toast.error('Phone number is required for students');
      return;
    }
    if (trimmed && !/^[6-9]\d{9}$/.test(trimmed)) {
      toast.error('Enter a valid 10-digit Indian phone number (starting with 6-9)');
      return;
    }

    try {
      await updatePreference.mutateAsync({ phone: trimmed || null });
      toast.success('Phone number updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update phone number';
      toast.error(msg);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
        <p className="t-label" style={{ color: 'var(--text-muted)', margin: 0 }}>ACADEMIC & HUB</p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {/* Hub Header Info & Code */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 className="t-card-title" style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {sectionName || 'Class Hub'}
                </h3>
              </div>
              <p className="t-caption" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                {authUser?.branch ? `${authUser.branch} • ` : ''}{institution}
              </p>
            </div>

            {/* Hub Code with Copy */}
            <CopyButton
              text={hubCode}
              label={hubCode}
              ariaLabel="Copy Hub Code"
              successMessage="Hub code copied!"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Side-by-side action tiles (Directory & Curriculum) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              id="view-members-btn"
              onClick={() => navigate('/app/members')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74, 158, 255, 0.4)'; e.currentTarget.style.background = 'rgba(74, 158, 255, 0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-primary-glow)',
                  border: '1px solid rgba(74, 158, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  flexShrink: 0
                }}>
                  <Users size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Directory
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>
                    {members.length > 0 ? `${members.filter(m => m.role !== 'teacher').length} members` : 'Section roster'}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </button>

            <button
              id="view-subjects-profile-btn"
              onClick={() => navigate('/app/cr/subjects')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)'; e.currentTarget.style.background = 'rgba(167, 139, 250, 0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#A78BFA',
                  flexShrink: 0
                }}>
                  <BookOpen size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Curriculum
                  </p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>
                    Subjects & syllabus
                  </p>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </button>
          </div>
        </div>

        {/* Academic detail rows */}
        <div style={{ borderTop: '1px solid var(--border-default)' }}>
          {role !== 'teacher' && (
            <>
              {/* Batch Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
              }}>
                <div>
                  <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Lab Group</p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Practical slot division (G1/G2)</p>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 16,
                  padding: 2,
                }}>
                  <button
                    type="button"
                    onClick={() => subBatch !== '1' && handleToggleBatch()}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: '12px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: subBatch === '1' ? 'var(--accent-primary)' : 'transparent',
                      color: subBatch === '1' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    G1
                  </button>
                  <button
                    type="button"
                    onClick={() => subBatch !== '2' && handleToggleBatch()}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: '12px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: subBatch === '2' ? 'var(--accent-primary)' : 'transparent',
                      color: subBatch === '2' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    G2
                  </button>
                </div>
              </div>

              {/* Commute Status */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
              }}>
                <div>
                  <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Commute Status</p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Transit mode filter</p>
                </div>
                <button 
                  id="toggle-commute-status" 
                  onClick={handleToggleCommuterStatus} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border-default)',
                    background: authUser?.dayScholar ? 'rgba(96, 165, 250, 0.12)' : 'rgba(167, 139, 250, 0.12)',
                    color: authUser?.dayScholar ? '#60A5FA' : '#A78BFA',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span>{authUser?.dayScholar ? '🚌 Day Scholar' : '🏠 Hosteller'}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▾</span>
                </button>
              </div>

              {/* Registered Phone */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
              }}>
                <div>
                  <p className="t-body" style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>Registered Phone</p>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Contact number for section</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="t-mono" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                    {authUser?.phone ? `+91 ${authUser.phone}` : 'Not Provided'}
                  </span>
                  <button 
                    id="change-phone-btn" 
                    onClick={handleUpdatePhone} 
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'var(--accent-primary)',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Change Phone Number"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* University Roll */}
          {role !== 'teacher' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: counsellor ? '1px solid var(--border-default)' : 'none',
            }}>
              <span className="t-body" style={{ color: 'var(--text-secondary)' }}>University Roll</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="t-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {universityRoll || '—'}
                </span>
                {universityRoll && universityRoll !== '—' && (
                  <CopyButton
                    text={universityRoll}
                    ariaLabel="Copy university roll number"
                    successMessage="University roll copied!"
                    iconSize={12}
                  />
                )}
              </div>
            </div>
          )}

          {/* Batch Counsellor Row */}
          {counsellor && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
            }}>
              <div>
                <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0 }}>
                  Group Counsellor
                </p>
                <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>
                  {counsellor.name} ({sectionName || ''}{subBatch})
                </p>
              </div>
              <a
                href={`mailto:${counsellor.email}?subject=ClassHub - Inquiry from student (${authUser?.name}, Roll ${classRoll})&body=Respected Professor,%0D%0A%0D%0A`}
                className="t-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--accent-primary-glow)',
                  border: '1px solid rgba(74, 158, 255, 0.25)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--accent-primary)',
                  padding: '6px 12px',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <Mail size={13} /> Contact
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
