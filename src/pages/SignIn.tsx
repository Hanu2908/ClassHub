import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../components/AuthProvider';

type StateMode = 'idle' | 'loading' | 'error' | 'success';


/* ── 3-D tilt card ── */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const target = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const current = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const animate = useCallback(function animateFrame() {
    const el = ref.current; if (!el) return;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    current.current.rx = lerp(current.current.rx, target.current.rx, 0.1);
    current.current.ry = lerp(current.current.ry, target.current.ry, 0.1);
    current.current.gx = lerp(current.current.gx, target.current.gx, 0.1);
    current.current.gy = lerp(current.current.gy, target.current.gy, 0.1);
    el.style.transform = `perspective(900px) rotateX(${current.current.rx}deg) rotateY(${current.current.ry}deg)`;
    el.style.setProperty('--gx', `${current.current.gx}%`);
    el.style.setProperty('--gy', `${current.current.gy}%`);
    animRef.current = requestAnimationFrame(animateFrame);
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    target.current.rx = (0.5 - (e.clientY - top) / height) * 4;
    target.current.ry = ((e.clientX - left) / width - 0.5) * 5;
    target.current.gx = ((e.clientX - left) / width) * 100;
    target.current.gy = ((e.clientY - top) / height) * 100;
    if (!animRef.current) animRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const onLeave = useCallback(() => {
    target.current = { rx: 0, ry: 0, gx: 50, gy: 50 };
    const settle = () => {
      const { rx, ry } = current.current;
      if (Math.abs(rx) < 0.02 && Math.abs(ry) < 0.02) {
        if (ref.current) { ref.current.style.transform = ''; }
        cancelAnimationFrame(animRef.current); animRef.current = 0;
      } else { animRef.current = requestAnimationFrame(settle); }
    };
    cancelAnimationFrame(animRef.current); animRef.current = requestAnimationFrame(settle);
  }, []);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`card ${className ?? ''}`} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

/* ── Google button ── */
function GoogleButton({ onClick, disabled, isLoading }: { onClick: () => void; disabled: boolean; isLoading: boolean }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    }
    onClick();
  };
  return (
    <button ref={btnRef} id="google-signin-btn" onClick={handleClick} disabled={disabled}
      className={`google-btn${isLoading ? ' loading' : ''}`}
      style={{ marginBottom: 12 }}>
      {isLoading ? (
        <Loader2 size={18} className="animate-spin" style={{ color: '#666' }} />
      ) : (
        <svg style={{ width: 18, height: 18, flexShrink: 0 }} viewBox="0 0 18 18">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
      )}
      <span>{isLoading ? 'Signing in…' : 'Continue with Google'}</span>
      {!isLoading && <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
    </button>
  );
}

/* ── Page ── */
export default function SignIn() {
  const [state, setState] = useState<StateMode>('idle');

  const handleGoogleClick = async () => {
    if (state === 'loading') return;
    setState('loading');
    try {
      await signInWithGoogle();
      setState('success');
    } catch {
      setState('error');
    }
  };

  // Demo bypass — tap logo 5× quickly
  // In dev mode, navigates to onboarding directly
  const clickCount = useRef(0);
  const handleDemoBypass = () => {
    if (!import.meta.env.DEV) return; // Demo bypass only allowed in development
    clickCount.current++;
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      localStorage.setItem('demo_mode', 'true');
      window.location.href = '/onboarding/choice'; // Force reload to initialize demo session
    }
  };

  return (
    <div className="auth-bg min-h-[100dvh] flex flex-col items-center justify-center py-8 px-6 relative overflow-hidden">

      {/* Success overlay */}
      {state === 'success' && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-base)] flex flex-col items-center justify-center animate-[fadeIn_0.35s_ease_both]">
          <div className="success-ring mb-6">
            <CheckCircle2 size={30} color="var(--status-safe)" strokeWidth={2} />
          </div>
          <p className="t-feature text-[var(--text-primary)] mb-2">You're in.</p>
          <p className="t-mono-sm text-[var(--text-muted)]">Taking you to your dashboard…</p>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full max-w-[360px]">
        {/* Logo — tap 5× for demo mode */}
        <div className="flex justify-center mb-4">
          <div className="logo-wrap cursor-default" onClick={handleDemoBypass}>
            <img src="/app_icon.svg" alt="ClassHub" width="88" height="88" fetchPriority="high" className="w-full h-full object-contain" />
          </div>
        </div>

        <h1 className="stagger-1 t-hero text-[var(--text-primary)] text-center tracking-[-0.6px] mb-1.5">
          ClassHub
        </h1>
        <p className="stagger-2 t-caption text-[var(--text-muted)] text-center tracking-wide mb-8">
          Your academic workspace
        </p>

        <TiltCard className="stagger-3">

          {state === 'error' && (
            <div className="error-banner">
              <AlertCircle size={14} color="var(--status-critical)" className="flex-shrink-0 mt-0.5" />
              <div className="t-caption text-[#FCEBEB] leading-[1.7]">
                <strong className="font-medium text-[var(--text-secondary)]">Access denied.</strong>{' '}
                Only <strong className="font-medium text-[var(--text-secondary)]">@skit.ac.in</strong>{' '}
                accounts are permitted.
              </div>
            </div>
          )}

          <p className="t-card-title text-[var(--text-primary)] mb-1">
            Sign in to continue
          </p>
          <p className="t-caption text-[var(--text-muted)] leading-[1.7] mb-6">
            Restricted to <span className="text-[var(--accent-primary)]">@skit.ac.in</span> accounts.
          </p>

          <div className="divider mb-5">
            <div className="divider-line" />
            <span className="t-caption text-[var(--text-muted)] tracking-wider px-2 whitespace-nowrap">continue with</span>
            <div className="divider-line" />
          </div>

          <GoogleButton onClick={handleGoogleClick} disabled={state === 'loading'} isLoading={state === 'loading'} />

          <div className="domain-badge mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-safe)] flex-shrink-0" />
            <span className="t-caption text-[var(--text-secondary)]">
              SKIT Jaipur · Institutional Login
            </span>
          </div>
        </TiltCard>

        <p className="stagger-4 t-caption mt-6 text-[var(--text-muted)] text-center tracking-wide">
          v1.0 &nbsp;·&nbsp; <Link to="/legal" className="text-inherit underline underline-offset-[3px] decoration-[rgba(116,124,144,0.4)]">Terms &amp; Privacy</Link>
        </p>
      </div>
    </div>
  );
}
