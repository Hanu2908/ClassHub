import { useEffect, useState } from 'react';

interface OnboardingLoaderProps {
  type: 'join' | 'create';
  isComplete: boolean;
  onFinished: () => void;
}

const JOIN_STEPS = [
  "Verifying invite code...",
  "Joining your classmates...",
  "Syncing schedule data...",
  "Preparing dashboard..."
];

const CREATE_STEPS = [
  "Generating invite code...",
  "Registering section database...",
  "Assigning coordinator permissions...",
  "Preparing dashboard..."
];

export default function OnboardingLoader({ type, isComplete, onFinished }: OnboardingLoaderProps) {
  const steps = type === 'join' ? JOIN_STEPS : CREATE_STEPS;
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isComplete) {
      setCurrentStep(3);
      const timer = setTimeout(() => {
        onFinished();
      }, 500); // Give 500ms for user to see the "Preparing dashboard..." state and exit cleanly
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 2) return prev + 1;
        return prev; // Hold at the third step (index 2) until the process finishes
      });
    }, 600);

    return () => clearInterval(interval);
  }, [isComplete, onFinished]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 12, 20, 0.9)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      animation: 'fadeIn 0.3s ease-out both',
    }}>
      {/* Mesh grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(74,158,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,158,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 24,
        maxWidth: 320,
      }}>
        {/* Progress Circle Visual */}
        <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 32 }}>
          {/* Centered pulsating app icon wrapper */}
          <div style={{
            position: 'absolute',
            inset: 12,
            borderRadius: '50%',
            background: 'var(--accent-primary-glow)',
            border: '1px solid rgba(74, 158, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'loaderPulse 2s infinite ease-in-out',
          }}>
            <img 
              src="/app_icon.svg" 
              alt="ClassHub" 
              style={{ width: '55%', height: '55%', objectFit: 'contain' }} 
            />
          </div>

          {/* SVG Progress Circle Ring */}
          <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle
              cx="48"
              cy="48"
              r="44"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="3"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r="44"
              stroke="var(--accent-primary)"
              strokeWidth="3"
              fill="transparent"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 - (276.46 * (currentStep + 1)) / 4}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
        </div>

        {/* Dynamic prompts and progress indicators */}
        <div style={{ minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p 
            key={currentStep} // Using key to force React component replacement, triggering the animation on change
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 10px',
              letterSpacing: '-0.01em',
              animation: 'loaderSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            {steps[currentStep]}
          </p>
          
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{
                  width: idx === currentStep ? 16 : 6,
                  height: 6,
                  borderRadius: 'var(--radius-pill, 3px)',
                  background: idx <= currentStep ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes loaderSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes loaderPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.95;
            box-shadow: 0 0 0 0 rgba(74, 158, 255, 0.15);
          }
          50% {
            transform: scale(1.04);
            opacity: 1;
            box-shadow: 0 0 16px 4px rgba(74, 158, 255, 0.3);
          }
        }
      `}</style>
    </div>
  );
}
