import { useNavigate } from 'react-router-dom';
import { DoorOpen, PlusCircle, ChevronRight } from 'lucide-react';

const ClassHubLogo = () => (
  <svg viewBox="0 0 52 52" fill="none" style={{ width: 52, height: 52 }}>
    <path d="M26 4L47 16V40L26 52L5 40V16L26 4Z" stroke="var(--accent-primary)" strokeWidth="1.5" fill="var(--accent-primary-glow)" />
    <path d="M26 14L39 21.5V36.5L26 44L13 36.5V21.5L26 14Z" stroke="rgba(74,158,255,0.3)" strokeWidth="0.75" fill="none" />
    <circle cx="26" cy="26" r="3" fill="var(--accent-primary)" />
  </svg>
);

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
        <div style={{ textAlign: 'center', marginBottom: 48 }} className="stagger-1">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ClassHubLogo />
          </div>
          <h1 className="text-display" style={{ marginBottom: 8 }}>ClassHub</h1>
          <p style={{ font: '400 15px var(--font-body)', color: 'var(--text-secondary)' }}>
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
              <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                Join a Hub
              </p>
              <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>
                Enter the code from your Class Rep
              </p>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </button>

          <button
            id="create-hub-card"
            className="onboarding-card stagger-3"
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
              <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                Create a Hub
              </p>
              <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>
                For Class Reps — set up your section
              </p>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </button>
        </div>

        <p className="stagger-4" style={{ textAlign: 'center', marginTop: 40, font: '400 11px var(--font-mono)', color: 'var(--text-muted)' }}>
          Section P2 · SKIT Jaipur
        </p>
      </div>
    </div>
  );
}
