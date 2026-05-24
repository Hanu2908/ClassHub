import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, ChevronLeft, Download, Share2, Lock, Unlock,
  TrendingUp, BookOpen, Award, BarChart3, RefreshCw, X, Sparkles,
  ChevronDown, Target
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveRadar } from '@nivo/radar';
import { NavBar } from '../../components/NavBar';
import { useGPAStore } from '../../store/gpaStore';
import {
  GRADE_SCALE, BRANCHES, marksToGrade, marksToColor, marksToPoint, computeSGPA,
} from '../../lib/gpaData';
import type { Branch } from '../../lib/gpaData';
import { exportGPAReport, generateShareURL } from '../../lib/pdfExport';
import { showToast } from '../../components/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Shared design constants
// ─────────────────────────────────────────────────────────────────────────────
// ── Muted theme palette — no neon/glow anywhere ─────────────────────────────
const T = {
  // surfaces
  card:      'rgba(18,20,32,0.7)',
  cardBdr:   'rgba(255,255,255,0.07)',
  topBdr:    'rgba(255,255,255,0.1)',
  // text
  label:     '#6B7280',      // muted labels
  body:      '#9CA3AF',      // secondary text
  heading:   '#E5E7EB',      // primary text
  // chart lines — calm, desaturated
  cgpa:      '#7C9EF8',      // soft indigo-blue
  sgpa:      '#6DB89B',      // muted sage-green
  // grade scale colours (preserved for semantic meaning)
  gradeO:    '#4ADE80',
  gradeAp:   '#818CF8',
  gradeA:    '#60A5FA',
  gradeBp:   '#67E8F9',
  gradeB:    '#34D399',
  gradeC:    '#FCD34D',
  gradeP:    '#F97316',
  gradeF:    '#F87171',
  // misc
  grid:      'rgba(255,255,255,0.045)',
  accent:    '#5B7CF7',
};

// Keep N alias so nothing else breaks
const N = {
  surface:   T.card,
  border:    T.cardBdr,
  text:      T.body,
  textPri:   T.heading,
  grid:      T.grid,
  indigo:    T.accent,
  indigoBr:  T.cgpa,
  emerald:   T.sgpa,
  sky:       '#67E8F9',
};

const nivoTheme = {
  background: 'transparent',
  text: { fontSize: 11, fill: T.body, fontFamily: 'var(--font-mono)' },
  axis: {
    ticks: { line: { stroke: 'transparent' }, text: { fill: T.label, fontSize: 10 } },
    legend: { text: { fill: T.body } },
  },
  grid: { line: { stroke: T.grid, strokeWidth: 1, strokeDasharray: '4 4' } },
  tooltip: {
    container: {
      background: '#161824',
      border: `1px solid rgba(255,255,255,0.1)`,
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontSize: 12,
      color: T.heading,
      fontFamily: 'var(--font-sans)',
      padding: '10px 14px',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Animated number
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// SVG Ring — animated circular progress gauge
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Hero CGPA display — clean single ring
// ─────────────────────────────────────────────────────────────────────────────
function CGPAHero({ cgpa, sgpa, pct }: { cgpa: number; sgpa: number; pct: number }) {
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

      {/* ── SVG ring ── */}
      <div style={{ flexShrink: 0, position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {/* Track ring */}
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--border-default)" strokeWidth={stroke} />

          {/* CGPA arc */}
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--accent-primary)" strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${aCGPAp * c} ${c}`}
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>

        {/* Center metric */}
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

      {/* ── Side stats ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Latest SGPA</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Grade badge
// ─────────────────────────────────────────────────────────────────────────────
function GradeBadge({ marks }: { marks: number | null }) {
  if (marks === null) return (
    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: N.text, padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, whiteSpace: 'nowrap' }}>—</span>
  );
  const g = marksToGrade(marks);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: g.color, padding: '3px 8px', background: `${g.color}18`, border: `1px solid ${g.color}44`, borderRadius: 6, whiteSpace: 'nowrap', transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: g.color, flexShrink: 0, boxShadow: `0 0 4px ${g.color}` }} />
      {g.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marks track — visual progress bar inside subject row
// ─────────────────────────────────────────────────────────────────────────────
function MarksTrack({ marks }: { marks: number | null }) {
  const pct = marks !== null ? marks : 0;
  const color = marksToColor(marks);
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: marks !== null ? `0 0 6px ${color}88` : 'none' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marks Input
// ─────────────────────────────────────────────────────────────────────────────
function MarksInput({
  value, onChange, disabled, subjectName, subjectIndex,
}: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean; subjectName: string; subjectIndex: number }) {
  const [raw, setRaw] = useState<string>(value !== null ? String(value) : '');
  const color = value !== null ? marksToColor(value) : 'rgba(255,255,255,0.3)';

  useEffect(() => { setRaw(value !== null ? String(value) : ''); }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (raw === '' || raw === '-') onChange(null);
    else if (!isNaN(n) && n >= 0 && n <= 100) onChange(Math.round(n * 100) / 100);
    else setRaw(value !== null ? String(value) : '');
  };

  return (
    <input
      type="number" min={0} max={100} step={1}
      value={raw} disabled={disabled}
      aria-label={`Marks for ${subjectName || `subject ${subjectIndex + 1}`}`}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      placeholder="—"
      style={{
        padding: '5px 6px', borderRadius: 7, width: '100%',
        background: value !== null ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${value !== null ? color + '55' : 'rgba(255,255,255,0.07)'}`,
        outline: 'none', color: value !== null ? color : 'rgba(255,255,255,0.25)',
        fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
        textAlign: 'center', transition: 'all 0.2s',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade Scale Reference — horizontal spectrum bar
// ─────────────────────────────────────────────────────────────────────────────
function GradeScaleBar() {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBdr}`, borderTop: `1px solid ${T.topBdr}`,
      borderRadius: 'var(--radius-lg)', padding: '12px 14px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Marks → Grade · SKIT Autonomous
      </p>
      {/* Spectrum bar — desaturated */}
      <div style={{ height: 5, borderRadius: 99, background: `linear-gradient(90deg, #F87171 0%, #F97316 15%, #FCD34D 28%, #34D399 40%, #67E8F9 52%, #60A5FA 65%, #818CF8 80%, #4ADE80 100%)`, marginBottom: 8, opacity: 0.8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {GRADE_SCALE.slice().reverse().map(g => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.body, fontFamily: 'var(--font-mono)' }}>{g.label}</span>
            <span style={{ fontSize: 8, color: T.label, fontFamily: 'var(--font-mono)' }}>
              {g.label === 'O' ? '90+' : g.label === 'F' ? '<40' : `${g.minMark}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass card wrapper
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, style: sx }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
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

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 10, fontWeight: 600, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Recharts Tooltip
// ─────────────────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#161824', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {label !== undefined && <p style={{ color: T.label, fontSize: 10, marginBottom: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? T.heading, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator Tab
// ─────────────────────────────────────────────────────────────────────────────
function CalculatorTab({ sem }: { sem: number }) {
  const { semesters, addSubject, updateSubject, removeSubject, resetSemester, lockSemester } = useGPAStore();
  const { subjects = [], locked = false } = semesters[sem] ?? {};
  const sgpa         = useMemo(() => computeSGPA(subjects), [subjects]);
  const totalCredits = useMemo(() => subjects.filter(s => s.marks !== null).reduce((a, s) => a + s.credits, 0), [subjects]);
  const animSGPA     = useAnimatedNumber(sgpa);
  const avgMarks     = useMemo(() => {
    const e = subjects.filter(s => s.marks !== null);
    return e.length ? e.reduce((a, s) => a + (s.marks ?? 0), 0) / e.length : 0;
  }, [subjects]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      <GradeScaleBar />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: N.text, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          {avgMarks > 0 && <span style={{ color: marksToColor(avgMarks), marginLeft: 8 }}>· avg {avgMarks.toFixed(1)}</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { icon: <RefreshCw size={11} />, label: 'Reset', onClick: () => resetSemester(sem), active: false },
            { icon: locked ? <Lock size={11} /> : <Unlock size={11} />, label: locked ? 'Locked' : 'Lock', onClick: () => lockSemester(sem, !locked), active: locked },
          ].map(b => (
            <button key={b.label} onClick={b.onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: b.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${b.active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`, color: b.active ? '#818CF8' : N.text, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s' }}>
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Table */}
      <GlassCard accent="rgba(255,255,255,0.09)" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 68px 48px 18px', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: `1px solid ${N.border}` }}>
          {['Subject', 'Cr', 'Marks', 'Grade', ''].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 600, color: N.text, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {subjects.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: N.text, fontSize: 13 }}>No subjects. Add one below.</div>
        ) : subjects.map((sub, idx) => {
          const g = sub.marks !== null ? marksToGrade(sub.marks) : null;
          const gp = sub.marks !== null ? marksToPoint(sub.marks) : null;
          return (
            <div key={sub.id} style={{ borderBottom: idx < subjects.length - 1 ? `1px solid ${N.border}` : 'none', background: g ? `${g.color}07` : 'transparent', transition: 'background 0.25s' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 68px 48px 18px', gap: 6, padding: '9px 14px', alignItems: 'center' }}>
                <div>
                  <input
                    aria-label={`Subject name ${idx + 1}`} value={sub.name} disabled={locked}
                    onChange={e => updateSubject(sem, sub.id, { name: e.target.value })}
                    placeholder="Subject name"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-body)', width: '100%', padding: 0 }}
                  />
                  <MarksTrack marks={sub.marks} />
                </div>
                <input
                  type="number" min={1} max={6} value={sub.credits} disabled={locked}
                  onChange={e => updateSubject(sem, sub.id, { credits: Math.max(1, Math.min(6, parseInt(e.target.value) || 1)) })}
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${N.border}`, borderRadius: 6, outline: 'none', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '4px 2px', width: '100%' }}
                />
                <MarksInput value={sub.marks} onChange={v => updateSubject(sem, sub.id, { marks: v })} disabled={locked} subjectName={sub.name} subjectIndex={idx} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <GradeBadge marks={sub.marks} />
                  {gp !== null && <span style={{ fontSize: 8, color: N.text, fontFamily: 'var(--font-mono)' }}>{gp}pt</span>}
                </div>
                <button onClick={() => removeSubject(sem, sub.id)} disabled={locked}
                  style={{ background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: N.text, opacity: locked ? 0.3 : 0.6, display: 'flex', alignItems: 'center', padding: 1, transition: 'opacity 0.15s' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {!locked && (
          <button onClick={() => addSubject(sem)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 16px', background: 'rgba(99,102,241,0.05)', border: 'none', borderTop: `1px solid ${N.border}`, color: '#818CF8', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}>
            <Plus size={13} /> Add Subject
          </button>
        )}
      </GlassCard>

      {/* SGPA footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: T.card, border: `1px solid ${T.cardBdr}`, borderTop: `2px solid ${T.topBdr}`, borderRadius: 'var(--radius-lg)' }}>
        <div>
          <div style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Total Credits Earned</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.heading, fontFamily: 'var(--font-display)' }}>{totalCredits}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>S{sem} SGPA</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.cgpa, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', lineHeight: 1 }}>{animSGPA.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { semesters, activeSemester, getAllSemesterSGPAs } = useGPAStore();
  const subjects   = semesters[activeSemester]?.subjects ?? [];
  const sgpa       = useMemo(() => computeSGPA(subjects), [subjects]);
  const semHistory = useMemo(() => getAllSemesterSGPAs(), [getAllSemesterSGPAs]);

  // ── Nivo Pie data ─────────────────────────────────────────────
  const pieData = useMemo(() => {
    const entered = subjects.filter(s => s.marks !== null);
    const map: Record<string, { id: string; label: string; value: number; count: number; color: string }> = {};
    entered.forEach(s => {
      const g = marksToGrade(s.marks);
      if (!map[g.label]) map[g.label] = { id: g.label, label: g.label, value: 0, count: 0, color: g.color };
      map[g.label].value += s.credits;
      map[g.label].count += 1;
    });
    return Object.values(map);
  }, [subjects]);

  // ── Nivo Bar data — marks per subject ─────────────────────────
  const barData = useMemo(() => subjects
    .filter(s => s.marks !== null)
    .map(s => ({
      subject: s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name,
      fullName: s.name,
      Marks: s.marks ?? 0,
      color: marksToColor(s.marks),
      grade: marksToGrade(s.marks).label,
    })), [subjects]);

  // ── Recharts area data ─────────────────────────────────────────
  const areaData = useMemo(() => semHistory.map(d => ({ name: `S${d.sem}`, CGPA: d.cgpa, SGPA: d.sgpa })), [semHistory]);

  // ── Nivo Radar data ────────────────────────────────────────────
  const radarData = useMemo(() => semHistory.map(d => ({ semester: `S${d.sem}`, SGPA: d.sgpa })), [semHistory]);

  const showTrend = semHistory.length >= 1;
  const showRadar = semHistory.length >= 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Marks bar chart ────────────────────────────────────── */}
      {barData.length > 0 && (
        <GlassCard>
          <ChartTitle><BarChart3 size={12} color={T.label} /> Marks per Subject · S{activeSemester}</ChartTitle>
          {/* Grade boundary legend */}
          <div style={{ display: 'flex', gap: '6px 10px', flexWrap: 'wrap', marginBottom: 12 }}>
            {[{ v: 90, c: T.gradeO, l: 'O' }, { v: 80, c: T.gradeAp, l: 'A+' }, { v: 70, c: T.gradeA, l: 'A' }, { v: 60, c: T.gradeBp, l: 'B+' }, { v: 40, c: T.gradeP, l: 'Pass' }].map(d => (
              <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 1.5, background: d.c, display: 'inline-block', borderRadius: 1, opacity: 0.6 }} />
                <span style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>≥{d.v} {d.l}</span>
              </div>
            ))}
          </div>
          <div role="img" aria-label="Horizontal bar chart: marks per subject">
            <div style={{ height: Math.max(barData.length * 38 + 30, 120) }}>
              <ResponsiveBar
                data={barData}
                keys={['Marks']}
                indexBy="subject"
                layout="horizontal"
                margin={{ top: 0, right: 42, bottom: 0, left: 124 }}
                padding={0.32}
                valueScale={{ type: 'linear', min: 0, max: 100 }}
                theme={nivoTheme}
                colors={({ data }: { data: { color: string } }) => data.color}
                borderRadius={4}
                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                axisBottom={null}
                enableGridX={false}
                enableGridY={false}
                label={({ value }) => `${value}`}
                labelTextColor="#111"
                labelSkipWidth={22}
                markers={[
                  { axis: 'x', value: 90, lineStyle: { stroke: `${T.gradeO}44`, strokeWidth: 1, strokeDasharray: '4 3' } },
                  { axis: 'x', value: 80, lineStyle: { stroke: `${T.gradeAp}44`, strokeWidth: 1, strokeDasharray: '4 3' } },
                  { axis: 'x', value: 70, lineStyle: { stroke: `${T.gradeA}44`, strokeWidth: 1, strokeDasharray: '4 3' } },
                  { axis: 'x', value: 60, lineStyle: { stroke: `${T.gradeBp}44`, strokeWidth: 1, strokeDasharray: '4 3' } },
                  { axis: 'x', value: 40, lineStyle: { stroke: `${T.gradeP}44`, strokeWidth: 1, strokeDasharray: '4 3' } },
                ]}
                tooltip={({ id, value, data }: { id: string | number; value: number; data: { fullName: string; color: string; grade: string } }) => (
                  <div style={{ background: '#161824', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: 11, color: T.label, marginBottom: 4 }}>{data.fullName}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.heading }}>
                      {value}/100 · {data.grade}
                    </div>
                    <div style={{ fontSize: 0 }}>{String(id)}</div>
                  </div>
                )}
                animate
                motionConfig="gentle"
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Grade distribution donut ───────────────────────────── */}
      <GlassCard>
        <ChartTitle><Award size={12} color={T.label} /> Grade Distribution · S{activeSemester}</ChartTitle>
        {pieData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: T.label, fontSize: 13 }}>Enter marks to see distribution</div>
        ) : (
          <div role="img" aria-label="Donut chart showing grade distribution by credits">
            <div style={{ height: 220, position: 'relative' }}>
              <ResponsivePie
                data={pieData}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                innerRadius={0.65}
                padAngle={2}
                cornerRadius={3}
                activeOuterRadiusOffset={4}
                colors={({ data }: { data: { color: string } }) => data.color}
                borderWidth={0}
                enableArcLabels={false}
                enableArcLinkLabels={false}
                theme={nivoTheme}
                animate
                motionConfig="gentle"
                tooltip={({ datum }: { datum: { id: string | number; color: string; value: number; data: { count: number } } }) => (
                  <div style={{ background: '#161824', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.heading, marginBottom: 3 }}>{datum.id}</div>
                    <div style={{ fontSize: 11, color: T.label }}>{datum.data.count} subject{datum.data.count !== 1 ? 's' : ''} · {datum.value} credits</div>
                  </div>
                )}
              />
              {/* Center label overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: T.heading, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', lineHeight: 1 }}>{sgpa.toFixed(2)}</span>
                <span style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>SGPA</span>
              </div>
            </div>
            {/* Legend pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 8px', justifyContent: 'center', marginTop: 8 }}>
              {pieData.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 20, padding: '3px 8px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: T.body, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d.id}</span>
                  <span style={{ fontSize: 10, color: T.label }}>{d.value}cr</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── CGPA Progression area chart ───────────────────────── */}
      {showTrend && (
        <GlassCard>
          <ChartTitle><TrendingUp size={12} color={T.label} /> CGPA Progression</ChartTitle>
          <div role="img" aria-label="Area chart showing CGPA and SGPA over semesters">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ left: -16, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCGPA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.cgpa} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={T.cgpa} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSGPA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.sgpa} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={T.sgpa} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={T.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: T.label, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: T.label, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={8} stroke={`${T.cgpa}44`} strokeDasharray="4 4" label={{ value: 'First', fill: T.label, fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                <ReferenceLine y={6} stroke="rgba(248,113,113,0.25)" strokeDasharray="4 4" label={{ value: 'Pass', fill: T.label, fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                <Area type="monotone" dataKey="CGPA" stroke={T.cgpa} strokeWidth={2} fill="url(#gCGPA)"
                  dot={{ r: 4, fill: T.cgpa, stroke: '#0F1018', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: T.cgpa, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive />
                <Area type="monotone" dataKey="SGPA" stroke={T.sgpa} strokeWidth={1.5} strokeDasharray="5 3" fill="url(#gSGPA)"
                  dot={{ r: 3, fill: T.sgpa, stroke: '#0F1018', strokeWidth: 1.5 }} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            {[{ c: T.cgpa, l: 'CGPA', dash: false }, { c: T.sgpa, l: 'SGPA', dash: true }].map(d => (
              <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={20} height={6}><line x1="0" y1="3" x2="20" y2="3" stroke={d.c} strokeWidth={d.dash ? 1.5 : 2} strokeDasharray={d.dash ? '5 3' : undefined} strokeLinecap="round" /></svg>
                <span style={{ fontSize: 10, color: T.label, fontFamily: 'var(--font-mono)' }}>{d.l}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ── SGPA Radar ────────────────────────────────────────── */}
      {showRadar && (
        <GlassCard>
          <ChartTitle><BarChart3 size={12} color={T.label} /> Semester SGPA Overview</ChartTitle>
          <div role="img" aria-label="Radar chart showing SGPA per semester">
            <div style={{ height: 240 }}>
              <ResponsiveRadar
                data={radarData}
                keys={['SGPA']}
                indexBy="semester"
                maxValue={10}
                margin={{ top: 20, right: 44, bottom: 20, left: 44 }}
                curve="linearClosed"
                theme={nivoTheme}
                colors={[T.cgpa]}
                fillOpacity={0.12}
                borderWidth={1.5}
                gridShape="circular"
                gridLevels={4}
                gridLabelOffset={10}
                enableDots
                dotSize={5}
                dotColor={T.cgpa}
                dotBorderWidth={1.5}
                dotBorderColor="#0F1018"
                animate
                motionConfig="gentle"
                sliceTooltip={({ index, data }) => (
                  <div style={{ background: '#161824', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: 11, color: T.label, marginBottom: 4 }}>{index}</div>
                    {data.map(d => (
                      <div key={d.id} style={{ fontSize: 14, fontWeight: 700, color: T.heading }}>{d.id}: {(d.value ?? 0).toFixed(2)}</div>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* Empty state */}
      {!showTrend && pieData.length === 0 && barData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: N.text, fontSize: 13 }}>
          <Sparkles size={28} color={N.text} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>Enter marks in the Calculator tab to see analytics</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prior Sem History
// ─────────────────────────────────────────────────────────────────────────────
function PriorSemHistory() {
  const { manualHistory, setManualHistory, semesters } = useGPAStore();
  const [editing, setEditing] = useState<Record<number, string>>({});
  const manualSems = [1,2,3,4,5,6,7,8].filter(sem =>
    !(semesters[sem]?.subjects ?? []).some(s => s.marks !== null)
  );
  return (
    <GlassCard accent="rgba(255,255,255,0.09)">
      <ChartTitle>Previous Semester CGPA</ChartTitle>
      <p style={{ fontSize: 12, color: N.text, marginBottom: 14, lineHeight: 1.6 }}>
        Enter CGPA for semesters completed before using ClassHub — feeds the trend chart.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {manualSems.map(sem => {
          const saved = manualHistory[sem];
          const draft = editing[sem] ?? '';
          const val   = saved ?? null;
          return (
            <div key={sem} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: val ? marksToColor(val * 10) : N.text, fontFamily: 'var(--font-mono)', width: 22, fontWeight: 600 }}>S{sem}</span>
              <input
                type="number" min={0} max={10} step={0.01}
                value={draft !== '' ? draft : (saved?.toString() ?? '')}
                onChange={e => setEditing(p => ({ ...p, [sem]: e.target.value }))}
                onBlur={() => {
                  const n = parseFloat(editing[sem] ?? '');
                  if (!isNaN(n) && n >= 0 && n <= 10) setManualHistory(sem, n);
                  else if (editing[sem] === '') setManualHistory(sem, null);
                  setEditing(p => { const x = { ...p }; delete x[sem]; return x; });
                }}
                placeholder="e.g. 7.42"
                style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${N.border}`, borderRadius: 8, outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)' }}
              />
              {saved !== undefined && (
                <button onClick={() => setManualHistory(sem, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: N.text, padding: 4 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        {manualSems.length === 0 && <p style={{ color: N.text, fontSize: 12, textAlign: 'center' }}>All semesters have marks entered.</p>}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Tab
// ─────────────────────────────────────────────────────────────────────────────
function ReportTab() {
  const { semesters, manualHistory, activeBranch, getAllSemesterSGPAs, getCGPA, getPercentage } = useGPAStore();
  const cgpa       = getCGPA();
  const pct        = getPercentage();
  const semHistory = getAllSemesterSGPAs();
  const [exporting, setExporting] = useState(false);

  const totalCredits = Object.values(semesters).flatMap(s => s.subjects).filter(s => s.marks !== null).reduce((a, s) => a + s.credits, 0);

  const handleExport = async () => {
    setExporting(true);
    try { await exportGPAReport('gpa-report-card'); showToast('Report downloaded!', 'success'); }
    catch { showToast('Export failed', 'error'); }
    finally { setExporting(false); }
  };

  const handleShare = () => {
    generateShareURL({ activeBranch, semesters, manualHistory } as unknown as Record<string, unknown>);
    showToast('Share link copied!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Report card ── */}
      <div id="gpa-report-card" style={{ background: '#0F111A', border: '1px solid #1E2235', borderRadius: 16, padding: 32, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>ClassHub GPA Report</div>
            <div style={{ fontSize: 11, color: '#8B93A8', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginTop: 4 }}>SKIT · AUTONOMOUS · CBCS</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#E2E8F0', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeBranch} Branch</div>
            <div style={{ fontSize: 10, color: '#8B93A8', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Hero metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Cumulative GPA', value: cgpa.toFixed(2), color: '#6366F1', sub: `${pct.toFixed(1)}% · ${marksToGrade(cgpa * 10).desc}` },
            { label: 'Latest SGPA', value: semHistory[semHistory.length - 1]?.sgpa.toFixed(2) ?? '—', color: '#10B981', sub: 'Current semester' },
            { label: 'Credits Earned', value: String(totalCredits), color: '#F1F5F9', sub: 'Across all semesters' },
            { label: 'Semesters Completed', value: String(semHistory.length), color: '#F1F5F9', sub: 'Out of 8 total' },
          ].map(m => (
            <div key={m.label} style={{ background: '#171A28', border: '1px solid #24293D', borderRadius: 12, padding: '16px 20px 14px' }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-sans)', marginTop: 6, fontWeight: 500 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {semHistory.length > 0 && (
          <div style={{ background: '#171A28', border: '1px solid #24293D', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid #24293D', background: '#131521' }}>
              {['Semester', 'SGPA', 'Cumul. CGPA', 'Grade'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {semHistory.map((d, i) => {
              const g = marksToGrade(d.sgpa * 10);
              return (
                <div key={d.sem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i < semHistory.length - 1 ? '1px solid #1E2235' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#CBD5E1', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>Semester {d.sem}</span>
                  <span style={{ fontSize: 13, color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{d.sgpa.toFixed(2)}</span>
                  <span style={{ fontSize: 13, color: '#6366F1', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{d.cgpa.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: g.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Grade scale */}
        <div style={{ background: '#131521', border: '1px solid #1E2235', borderRadius: 10, padding: '14px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: '#64748B', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 600 }}>SKIT Grading Scale</p>
          <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap' }}>
            {GRADE_SCALE.map(g => (
              <span key={g.label} style={{ fontSize: 11, color: g.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.label}({g.point}) ≥{g.minMark}</span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'var(--font-mono)', textAlign: 'center', fontWeight: 500 }}>
          Generated by ClassHub · SKIT Jaipur · classhub.app
        </div>
      </div>

      <PriorSemHistory />

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleExport} disabled={exporting}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', borderRadius: 'var(--radius-md)', background: exporting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.35)', transition: 'all 0.15s' }}>
          <Download size={15} />
          {exporting ? 'Exporting…' : 'Download PNG'}
        </button>
        <button onClick={handleShare}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
          <Share2 size={15} />
          Copy Link
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'calc',      label: 'Calculator', icon: BookOpen },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3 },
  { id: 'report',    label: 'Report',     icon: Award },
  { id: 'goals',     label: 'Goals',      icon: Target },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function GPACalculatorPage() {
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
        {/* ── Hero concentric rings ── */}
        <CGPAHero cgpa={cgpa} sgpa={sgpa} pct={pct} />

        {/* ── Semester nav ── */}
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

        {/* ── Tab switcher ── */}
        <div style={{ display: 'flex', gap: 3, padding: 4, background: T.card, border: `1px solid ${T.cardBdr}`, borderRadius: 12 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const a = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', borderRadius: 9, background: a ? 'rgba(255,255,255,0.06)' : 'transparent', border: a ? `1px solid rgba(255,255,255,0.1)` : '1px solid transparent', color: a ? T.heading : T.label, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', boxShadow: a ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <div key={activeTab} style={{ animation: 'gpafade 0.18s ease', flex: 1 }}>
          {activeTab === 'calc'      && <CalculatorTab sem={activeSemester} />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'report'    && <ReportTab />}
          {activeTab === 'goals'     && <GoalsTab />}
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

// ─────────────────────────────────────────────────────────────────────────────
// Goals Tab
// ─────────────────────────────────────────────────────────────────────────────
function GoalsTab() {
  const { targetCgpa, setTargetCgpa, semesters, getCGPA, getAllSemesterSGPAs } = useGPAStore();
  const cgpa = getCGPA();
  const history = getAllSemesterSGPAs();
  const completedSems = history.length;
  
  // Set default goal if null and we have a CGPA
  useEffect(() => {
    if (targetCgpa === null && cgpa > 0) {
      setTargetCgpa(parseFloat((cgpa + 0.2).toFixed(2)));
    }
  }, [cgpa, targetCgpa, setTargetCgpa]);

  const [val, setVal] = useState(targetCgpa ?? (cgpa > 0 ? cgpa + 0.2 : 8.0));

  const calculateRequiredSgpa = () => {
    if (completedSems === 0 || completedSems >= 8) return null;
    
    let currentTotalCredits = 0;
    let currentWeightedScore = 0;
    
    // Sum up completed credits
    for (let sem = 1; sem <= 8; sem++) {
      const subs = semesters[sem]?.subjects ?? [];
      const entered = subs.filter(s => s.marks !== null && s.credits > 0);
      if (entered.length > 0) {
        const credits = entered.reduce((acc, s) => acc + s.credits, 0);
        currentTotalCredits += credits;
        currentWeightedScore += computeSGPA(entered) * credits;
      }
    }
    
    // Assume 20 credits per remaining semester for estimation
    const remainingSems = 8 - completedSems;
    const remainingCredits = remainingSems * 20;
    const totalFutureCredits = currentTotalCredits + remainingCredits;
    
    const requiredWeightedScore = (val * totalFutureCredits) - currentWeightedScore;
    const requiredAvgSgpa = requiredWeightedScore / remainingCredits;
    
    return parseFloat(requiredAvgSgpa.toFixed(2));
  };

  const requiredSgpa = calculateRequiredSgpa();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GlassCard accent="var(--accent-primary-alpha)">
        <ChartTitle><Target size={12} color="var(--accent-primary)" /> Set Target CGPA</ChartTitle>
        <div style={{ padding: '20px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
            {val.toFixed(2)}
          </div>
          
          <div style={{ width: '100%', position: 'relative' }}>
            <input 
              type="range" 
              min="4" max="10" step="0.01" 
              value={val} 
              onChange={e => {
                setVal(parseFloat(e.target.value));
              }}
              onMouseUp={() => setTargetCgpa(val)}
              onTouchEnd={() => setTargetCgpa(val)}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>4.00</span>
              <span>10.00</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {requiredSgpa !== null && (
        <GlassCard accent={requiredSgpa > 10 ? 'rgba(239,68,68,0.2)' : 'var(--accent-secondary-alpha)'}>
          <ChartTitle>Insights</ChartTitle>
          <div style={{ padding: '10px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>To achieve a {val.toFixed(2)} CGPA, you need an average SGPA of:</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: requiredSgpa > 10 ? '#EF4444' : 'var(--accent-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {requiredSgpa.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: requiredSgpa > 10 ? '#EF4444' : 'var(--text-muted)' }}>
              {requiredSgpa > 10 ? 'This target is mathematically impossible.' : `across your remaining ${8 - completedSems} semesters.`}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
