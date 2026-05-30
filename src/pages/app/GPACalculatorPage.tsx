import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Award, BarChart3, ChevronDown, Target, Loader2 } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { useGPAStore } from '../../store/gpaStore';
import {
  BRANCHES, marksToGrade,
} from '../../lib/gpaData';
import type { Branch } from '../../lib/gpaData';

// Standalone tabs regular import for Calculator Tab (since it stays lean and instant)
import CalculatorTab from './gpa/CalculatorTab';
import { useGPASync } from '../../hooks/useGPASync';

// Dynamic lazy imports for heavy dependent tabs
const AnalyticsTab = React.lazy(() => import('./gpa/AnalyticsTab'));
const ReportTab = React.lazy(() => import('./gpa/ReportTab'));
const GoalsTab = React.lazy(() => import('./gpa/GoalsTab'));

// Desaturated muted theme colors
const T = {
  card:      'rgba(18,20,32,0.7)',
  cardBdr:   'rgba(255,255,255,0.07)',
  topBdr:    'rgba(255,255,255,0.1)',
  label:     '#6B7280',
  body:      '#9CA3AF',
  heading:   '#E5E7EB',
  cgpa:      '#7C9EF8',
  sgpa:      '#6DB89B',
  accent:    '#5B7CF7',
};


function useAnimatedNumber(target: number, duration = 400): number {
  const [v, setV] = useState(target);
  const raf = useRef<number | null>(null);
  const t0  = useRef(0);
  const fr  = useRef(target);
  useEffect(() => {
    const from = fr.current;
    if (Math.abs(target - from) < 0.001) return;
    t0.current = performance.now();
    const run = (now: number) => {
      const p = Math.min((now - t0.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(parseFloat((from + (target - from) * e).toFixed(3)));
      if (p < 1) { raf.current = requestAnimationFrame(run); }
      else { fr.current = target; }
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(run);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return v;
}

function RingGauge({
  value, max = 10, size = 72, stroke = 6, color, children,
}: { value: number; max?: number; size?: number; stroke?: number; color: string; children?: React.ReactNode }) {
  const r   = (size - stroke) / 2;
  const c   = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const animated = useAnimatedNumber(pct);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-default)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${animated * c} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function CGPAHero({ cgpa, sgpa, pct, isPartial }: { cgpa: number; sgpa: number; pct: number; isPartial: boolean }) {
  const aCGPA = useAnimatedNumber(cgpa);
  const aSGPA = useAnimatedNumber(sgpa);
  const aPct  = useAnimatedNumber(pct);
  const grade = marksToGrade(cgpa * 10);

  const rOuter = 72;
  const stroke = 8, size = 188;
  const cx = size / 2, cy = size / 2;

  const c = 2 * Math.PI * rOuter;
  const p = Math.min(cgpa / 10, 1);
  const aCGPAp = useAnimatedNumber(p);

  return (
    <div className="card" style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '24px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* SVG concentric ring */}
      <div style={{ flexShrink: 0, position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--border-default)" strokeWidth={stroke} />
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--accent-primary)" strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${aCGPAp * c} ${c}`}
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>

        {/* Center score indicator */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: -2 }}>Overall</span>
          <span className="t-mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {aCGPA.toFixed(2)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 12, marginTop: 4 }}>
            {grade.label}
          </span>
        </div>
      </div>

      {/* Side stats */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Current semester SGPA</span>
            {isPartial && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#FBBF24',
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
                padding: '1px 6px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                Partial
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="t-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{aSGPA.toFixed(2)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ 10</span>
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border-default)' }} />
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Percentage</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="t-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{aPct.toFixed(1)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassCard({ children, style: sx }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBdr}`,
      borderTop: `1.5px solid ${T.topBdr}`,
      borderRadius: 'var(--radius-lg)', padding: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      ...sx,
    }}>
      {children}
    </div>
  );
}

const TABS = [
  { id: 'calc',      label: 'Calculator', icon: BookOpen },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3 },
  { id: 'report',    label: 'Report',     icon: Award },
  { id: 'goals',     label: 'Goals',      icon: Target },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function GPACalculatorPage() {
  useGPASync();
  const navigate = useNavigate();
  const {
    activeBranch, setActiveBranch,
    activeSemester, setActiveSemester,
    semesters, getSGPA, getCGPA, getPercentage,
  } = useGPAStore();

  const [activeTab, setActiveTab] = useState<TabId>('calc');

  const cgpa = getCGPA();
  const sgpa = getSGPA(activeSemester);
  const pct  = getPercentage();

  const getSemStatus = useCallback((sem: number) => {
    const subs = semesters[sem]?.subjects ?? [];
    const e = subs.filter(s => s.marks !== null);
    if (e.length === 0) return 'empty';
    return e.length === subs.length ? 'complete' : 'partial';
  }, [semesters]);

  const statusColor = { empty: 'rgba(255,255,255,0.1)', partial: '#B45309', complete: '#4ADE80' };

  // Dynamic prefetching trigger to warm lazy chunks
  const prefetchTab = (tabId: string) => {
    if (tabId === 'analytics') import('./gpa/AnalyticsTab');
    if (tabId === 'report') import('./gpa/ReportTab');
    if (tabId === 'goals') import('./gpa/GoalsTab');
  };

  return (
    <div className="page-shell">
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,12,20,0.96)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: `1px solid var(--border-default)`, padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/app/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }} aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1, fontSize: 16 }}>GPA Calculator</h1>
          <div style={{ position: 'relative' }}>
            <select
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value as Branch)}
              style={{
                appearance: 'none',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid rgba(255,255,255,0.12)`,
                borderRadius: 8,
                padding: '5px 28px 5px 10px',
                color: T.body,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                outline: 'none',
                letterSpacing: '0.04em',
                minWidth: 80,
              }}
            >
              {BRANCHES.map(b => (
                <option key={b} value={b} style={{ background: '#0F1018', color: T.heading }}>{b}</option>
              ))}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.label }} />
          </div>
        </div>
      </header>

      <main style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* CGPAHero concentric rings */}
        <CGPAHero cgpa={cgpa} sgpa={sgpa} pct={pct} isPartial={getSemStatus(activeSemester) === 'partial'} />

        {/* Semester nav switcher */}
        <GlassCard style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }} className="hide-scrollbar">
            {[1,2,3,4,5,6,7,8].map(sem => {
              const semSgpa  = getSGPA(sem);
              const status   = getSemStatus(sem);
              const isActive = activeSemester === sem;
              return (
                <button key={sem} onClick={() => setActiveSemester(sem)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 6px 5px', borderRadius: 10, flexShrink: 0, minWidth: 46, background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent', border: `1.5px solid ${isActive ? 'rgba(255,255,255,0.15)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <RingGauge value={status === 'empty' ? 0 : semSgpa} max={10} size={34} stroke={3} color={statusColor[status]}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? T.heading : T.label, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>S{sem}</span>
                  </RingGauge>
                  {status !== 'empty' && <span style={{ fontSize: 8, color: isActive ? T.body : T.label, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{semSgpa.toFixed(1)}</span>}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* WAI-ARIA tab switcher control */}
        <div 
          role="tablist" 
          aria-label="GPA Calculator Tabs"
          style={{ display: 'flex', gap: 3, padding: 4, background: T.card, border: `1px solid ${T.cardBdr}`, borderRadius: 12 }}
        >
          {TABS.map(tab => {
            const Icon = tab.icon;
            const a = activeTab === tab.id;
            return (
              <button 
                key={tab.id} 
                role="tab"
                aria-selected={a}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => prefetchTab(tab.id)}
                onFocus={() => prefetchTab(tab.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', borderRadius: 9, background: a ? 'rgba(255,255,255,0.06)' : 'transparent', border: a ? `1px solid rgba(255,255,255,0.1)` : '1px solid transparent', color: a ? T.heading : T.label, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', boxShadow: a ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', outline: 'none' }}
                onFocusCapture={(e) => { if (!a) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content panel */}
        <div 
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-label={`${activeTab} tab contents`}
          key={activeTab} 
          style={{ animation: 'gpafade 0.18s ease', flex: 1 }}
        >
          <React.Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, color: T.body }}>
              <Loader2 className="animate-spin" size={32} />
              <span className="t-mono-sm">Warming chart engines…</span>
            </div>
          }>
            {activeTab === 'calc'      && <CalculatorTab sem={activeSemester} />}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'report'    && <ReportTab />}
            {activeTab === 'goals'     && <GoalsTab />}
          </React.Suspense>
        </div>
      </main>

      <style>{`
        @keyframes gpafade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <NavBar />
    </div>
  );
}
