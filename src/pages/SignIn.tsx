import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const dots = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.4,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d) => {
        d.x += d.dx;
        d.y += d.dy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(123,110,246,${d.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" aria-hidden />;
}

/* ── 3-D tilt card ── */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const target = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const current = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const animate = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    current.current.rx = lerp(current.current.rx, target.current.rx, 0.1);
    current.current.ry = lerp(current.current.ry, target.current.ry, 0.1);
    current.current.gx = lerp(current.current.gx, target.current.gx, 0.1);
    current.current.gy = lerp(current.current.gy, target.current.gy, 0.1);

    el.style.transform = `perspective(900px) rotateX(${current.current.rx}deg) rotateY(${current.current.ry}deg) scale3d(1.012,1.012,1.012)`;
    el.style.setProperty('--gx', `${current.current.gx}%`);
    el.style.setProperty('--gy', `${current.current.gy}%`);

    animRef.current = requestAnimationFrame(animate);
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width;   // 0-1
    const y = (e.clientY - top) / height;   // 0-1
    target.current.rx = (0.5 - y) * 12;    // tilt up/down
    target.current.ry = (x - 0.5) * 14;    // tilt left/right
    target.current.gx = x * 100;
    target.current.gy = y * 100;
    if (!animRef.current) animRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const onLeave = useCallback(() => {
    target.current = { rx: 0, ry: 0, gx: 50, gy: 50 };
    // keep the loop running to lerp back, stop after settling
    const stopAfterSettle = () => {
      const tolerance = 0.02;
      const { rx, ry } = current.current;
      if (Math.abs(rx) < tolerance && Math.abs(ry) < tolerance) {
        if (ref.current) {
          ref.current.style.transform = '';
          ref.current.style.setProperty('--gx', '50%');
          ref.current.style.setProperty('--gy', '50%');
        }
        cancelAnimationFrame(animRef.current);
        animRef.current = 0;
      } else {
        animRef.current = requestAnimationFrame(stopAfterSettle);
      }
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(stopAfterSettle);
  }, []);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn('card', className)}
      style={{ willChange: 'transform' }}
    >
      {children}
    </div>
  );
}

/* ── Ripple Google button ── */
function GoogleButton({
  onClick,
  disabled,
  isLoading,
}: {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Spawn ripple
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
    <button
      ref={btnRef}
      id="google-signin-btn"
      onClick={handleClick}
      disabled={disabled}
      className={cn('google-btn mb-3 group', isLoading && 'loading')}
    >
      {isLoading ? (
        <Loader2 size={18} className="animate-spin text-[#666]" />
      ) : (
        <svg className="w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 18 18">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
      )}
      <span className="transition-all duration-200 group-hover:tracking-wide">
        {isLoading ? 'Signing in…' : 'Continue with Google'}
      </span>
      {!isLoading && (
        <ArrowRight
          size={14}
          className="ml-auto opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0"
        />
      )}
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
      // TODO: swap for real Supabase OAuth:
      // const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      // if (error) throw error;
      await new Promise((res) => setTimeout(res, 1600));
      setState('success');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      {/* Background */}
      <Particles />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(123,110,246,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(123,110,246,0.025) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="scan-line" aria-hidden />

      {/* Success overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-[var(--bg-base)] flex-col items-center justify-center',
          state === 'success' ? 'flex animate-[fadeIn_0.35s_ease_both]' : 'hidden'
        )}
      >
        <div className="success-ring mb-6">
          <CheckCircle2 size={30} className="text-[var(--green)]" strokeWidth={2} />
        </div>
        <p className="text-xl font-semibold text-[var(--text-primary)] mb-2">You're in.</p>
        <p className="font-mono text-[11px] text-[var(--text-tertiary)]">Taking you to your dashboard…</p>
      </div>

      {/* Main */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">

        {/* Logo */}
        <div className="logo-wrap mb-4">
          <svg viewBox="0 0 52 52" fill="none" className="w-full h-full">
            <path d="M26 4L47 16V40L26 52L5 40V16L26 4Z" stroke="#7B6EF6" strokeWidth="1.5" fill="rgba(123,110,246,0.08)" />
            <path d="M26 14L39 21.5V36.5L26 44L13 36.5V21.5L26 14Z" stroke="rgba(123,110,246,0.35)" strokeWidth="0.75" fill="none" />
            <circle cx="26" cy="26" r="3" fill="#7B6EF6" />
          </svg>
        </div>

        <h1 className="font-sans text-[30px] font-semibold tracking-[-0.6px] text-[var(--text-primary)] text-center mb-1 stagger-1">
          ClassHub
        </h1>
        <p className="font-mono text-[11px] text-[var(--text-tertiary)] tracking-[0.06em] text-center mb-8 stagger-2">
          Your academic workspace
        </p>

        {/* Tilt card */}
        <TiltCard className="stagger-3">
          <div className="card-shimmer" />
          <div className="card-glare" />

          {/* Error banner */}
          {state === 'error' && (
            <div className="error-banner">
              <AlertCircle size={14} className="flex-shrink-0 text-[var(--red)] mt-[1px]" />
              <div className="font-mono text-[11px] text-[#FCEBEB] leading-relaxed">
                <strong className="font-medium text-[var(--text-secondary)]">Access denied.</strong>{' '}
                Only <strong className="font-medium text-[var(--text-secondary)]">@skit.ac.in</strong>{' '}
                accounts are permitted. Try a different Google account.
              </div>
            </div>
          )}

          <p className="text-[17px] font-semibold text-[var(--text-primary)] mb-1">Sign in to continue</p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mb-6 leading-[1.7]">
            Restricted to <span className="text-[var(--accent)]">@skit.ac.in</span> accounts.
          </p>

          <div className="domain-badge mb-5">
            <Lock size={14} className="flex-shrink-0 text-[var(--accent)]" />
            <span className="font-mono text-[11px] text-[var(--accent)] tracking-[0.02em]">
              Workspace-verified · @skit.ac.in only
            </span>
          </div>

          <div className="divider mb-5">
            <div className="divider-line" />
            <span className="font-mono text-[10px] text-[var(--text-tertiary)] tracking-[0.06em] px-2 whitespace-nowrap">
              continue with
            </span>
            <div className="divider-line" />
          </div>

          <GoogleButton
            onClick={handleGoogleClick}
            disabled={state === 'loading'}
            isLoading={state === 'loading'}
          />

          <div className="note-box">
            <AlertCircle size={12} className="flex-shrink-0 text-[var(--text-tertiary)] mt-[1px]" />
            <p className="font-mono text-[10px] text-[var(--text-tertiary)] leading-[1.6]">
              Personal Gmail accounts will be rejected. Use your{' '}
              <strong className="font-medium text-[var(--text-secondary)]">SKIT Google Workspace</strong> account.
            </p>
          </div>
        </TiltCard>

        {/* Footer */}
        <p className="mt-6 font-mono text-[10px] text-[var(--text-tertiary)] text-center tracking-[0.04em] stagger-4">
          v1.0 &nbsp;·&nbsp;{' '}
          <a href="#" className="hover:text-[var(--text-secondary)] transition-colors duration-200">Privacy</a>
          &nbsp;·&nbsp;{' '}
          <a href="#" className="hover:text-[var(--text-secondary)] transition-colors duration-200">Terms</a>
        </p>
      </div>
    </>
  );
}
