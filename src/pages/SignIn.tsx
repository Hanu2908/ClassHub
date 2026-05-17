import { useState, useEffect, useRef, useCallback } from 'react';

import { AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../components/AuthProvider';

type StateMode = 'idle' | 'loading' | 'error' | 'success';

/* ── Floating particles ── */
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const dots = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.4,
      dx: (Math.random() - 0.5) * 0.22,
      dy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.35 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.dx; d.y += d.dy;
        if (d.x < 0) d.x = canvas.width; if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(74,158,255,${d.alpha})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
  );
}

/* ── 3-D tilt card ── */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const target = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const current = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const animate = useCallback(() => {
    const el = ref.current; if (!el) return;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    current.current.rx = lerp(current.current.rx, target.current.rx, 0.1);
    current.current.ry = lerp(current.current.ry, target.current.ry, 0.1);
    current.current.gx = lerp(current.current.gx, target.current.gx, 0.1);
    current.current.gy = lerp(current.current.gy, target.current.gy, 0.1);
    el.style.transform = `perspective(900px) rotateX(${current.current.rx}deg) rotateY(${current.current.ry}deg)`;
    el.style.setProperty('--gx', `${current.current.gx}%`);
    el.style.setProperty('--gy', `${current.current.gy}%`);
    animRef.current = requestAnimationFrame(animate);
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    target.current.rx = (0.5 - (e.clientY - top) / height) * 10;
    target.current.ry = ((e.clientX - left) / width - 0.5) * 12;
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
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
      <Particles />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="scan-line" aria-hidden />

      {/* Success overlay */}
      {state === 'success' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.35s ease both' }}>
          <div className="success-ring" style={{ marginBottom: 24 }}>
            <CheckCircle2 size={30} color="var(--status-safe)" strokeWidth={2} />
          </div>
          <p style={{ font: '600 20px var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>You're in.</p>
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)' }}>Taking you to your dashboard…</p>
        </div>
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360 }}>
        {/* Logo — tap 5× for demo mode */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div className="logo-wrap" onClick={handleDemoBypass} style={{ cursor: 'default' }}>
            <svg viewBox="0 0 52 52" fill="none" style={{ width: '100%', height: '100%' }}>
              <path d="M26 4L47 16V40L26 52L5 40V16L26 4Z" stroke="var(--accent-primary)" strokeWidth="1.5" fill="var(--accent-primary-glow)" />
              <path d="M26 14L39 21.5V36.5L26 44L13 36.5V21.5L26 14Z" stroke="rgba(74,158,255,0.3)" strokeWidth="0.75" fill="none" />
              <circle cx="26" cy="26" r="3" fill="var(--accent-primary)" />
            </svg>
          </div>
        </div>

        <h1 className="stagger-1" style={{ font: '700 30px/1.2 var(--font-display)', color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '-0.6px', marginBottom: 6 }}>
          ClassHub
        </h1>
        <p className="stagger-2" style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em', marginBottom: 32 }}>
          Your academic workspace
        </p>

        <TiltCard className="stagger-3">
          <div className="card-shimmer" />
          <div className="card-glare" />

          {state === 'error' && (
            <div className="error-banner">
              <AlertCircle size={14} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ font: '400 11px var(--font-mono)', color: '#FCEBEB', lineHeight: 1.7 }}>
                <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Access denied.</strong>{' '}
                Only <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>@skit.ac.in</strong>{' '}
                accounts are permitted.
              </div>
            </div>
          )}

          <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
            Sign in to continue
          </p>
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
            Restricted to <span style={{ color: 'var(--accent-primary)' }}>@skit.ac.in</span> accounts.
          </p>

          <div className="divider" style={{ marginBottom: 20 }}>
            <div className="divider-line" />
            <span style={{ font: '400 10px var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', padding: '0 8px', whiteSpace: 'nowrap' }}>continue with</span>
            <div className="divider-line" />
          </div>

          <GoogleButton onClick={handleGoogleClick} disabled={state === 'loading'} isLoading={state === 'loading'} />

          <div className="domain-badge" style={{ marginTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-safe)', flexShrink: 0 }} />
            <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-secondary)' }}>
              SKIT Jaipur · Institutional Login
            </span>
          </div>
        </TiltCard>

        <p className="stagger-4" style={{ marginTop: 24, font: '400 10px var(--font-mono)', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.04em' }}>
          v1.0 &nbsp;·&nbsp; <a href="#" style={{ color: 'inherit' }}>Privacy</a> &nbsp;·&nbsp; <a href="#" style={{ color: 'inherit' }}>Terms</a>
        </p>
      </div>
    </div>
  );
}
