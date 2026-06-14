import { useNavigate } from 'react-router-dom';
import { DoorOpen, PlusCircle, ChevronRight, GraduationCap } from 'lucide-react';

export default function ChoicePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Mesh grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(74,158,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,158,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }} className="stagger-1">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div className="logo-wrap">
              <img src="/app_icon.svg" alt="ClassHub" width="88" height="88" fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
          <h1 className="text-display" style={{ marginBottom: 8 }}>ClassHub</h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
            Your section, organized.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            id="join-hub-card"
            className="onboarding-card stagger-2"
            onClick={() => navigate('/onboarding/join')}
            style={{ textAlign: 'left', width: '100%', background: 'none' }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <DoorOpen size={24} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                Join a Hub
              </p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                Enter the code from your Class Rep
              </p>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" className="chevron-icon" style={{ transition: 'transform var(--transition-fast), color var(--transition-fast)' }} />
          </button>

          <button
            id="join-teacher-card"
            className="onboarding-card stagger-3"
            onClick={() => navigate('/onboarding/join?role=teacher')}
            style={{ textAlign: 'left', width: '100%', background: 'none' }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <GraduationCap size={24} color="rgb(99, 102, 241)" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                Join as Teacher
              </p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                Enter teacher code from the Class Rep
              </p>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" className="chevron-icon" style={{ transition: 'transform var(--transition-fast), color var(--transition-fast)' }} />
          </button>

          <button
            id="create-hub-card"
            className="onboarding-card stagger-4"
            onClick={() => navigate('/onboarding/create')}
            style={{ textAlign: 'left', width: '100%', background: 'none' }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-md)',
              background: 'var(--status-safe-bg)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <PlusCircle size={24} color="var(--status-safe)" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                Create a Hub
              </p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                For Class Reps — set up your section
              </p>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" className="chevron-icon" style={{ transition: 'transform var(--transition-fast), color var(--transition-fast)' }} />
          </button>
        </div>

        <p className="stagger-5 t-mono-sm" style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>
          Section P2 · SKIT Jaipur
        </p>
      </div>
    </div>
  );
}
