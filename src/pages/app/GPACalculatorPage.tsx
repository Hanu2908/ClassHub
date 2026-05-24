import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, ChevronLeft, Download, Share2, Lock, Unlock,
  TrendingUp, BookOpen, Award, BarChart3, RefreshCw, X,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Area, AreaChart, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { NavBar } from '../../components/NavBar';
import { useGPAStore } from '../../store/gpaStore';
import {
  GRADE_SCALE, BRANCHES, marksToGrade, marksToColor, marksToPoint, computeSGPA,
} from '../../lib/gpaData';
import type { Branch } from '../../lib/gpaData';
import { chartTheme } from '../../lib/gpaData';
import { exportGPAReport, generateShareURL } from '../../lib/pdfExport';
import { showToast } from '../../components/Toast';

// ── Animated number ───────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 320): number {
  const [displayed, setDisplayed] = useState(target);
  const rafRef  = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef  = useRef<number>(target);

  useEffect(() => {
    const from = fromRef.current;
    if (Math.abs(target - from) < 0.001) return;
    startRef.current = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(parseFloat((from + (target - from) * eased).toFixed(2)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return displayed;
}

// ── Grade badge (read-only, derived from marks) ───────────────────────────────
function GradeBadge({ marks }: { marks: number | null }) {
  if (marks === null) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)', padding: '4px 10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, whiteSpace: 'nowrap',
      }}>
        —
      </span>
    );
  }
  const g = marksToGrade(marks);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
      color: g.color, padding: '4px 10px',
      background: `${g.color}1A`,
      border: `1.5px solid ${g.color}55`,
      borderRadius: 8, whiteSpace: 'nowrap',
      transition: 'all 0.2s',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
      {g.label}
    </span>
  );
}

// ── Marks Input ───────────────────────────────────────────────────────────────
function MarksInput({
  value, onChange, disabled, subjectName, subjectIndex,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  subjectName: string;
  subjectIndex: number;
}) {
  const [raw, setRaw] = useState<string>(value !== null ? String(value) : '');
  const color = value !== null ? marksToColor(value) : 'var(--text-muted)';

  useEffect(() => {
    setRaw(value !== null ? String(value) : '');
  }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (raw === '' || raw === '-') {
      onChange(null);
    } else if (!isNaN(n) && n >= 0 && n <= 100) {
      onChange(Math.round(n * 100) / 100);
    } else {
      // revert
      setRaw(value !== null ? String(value) : '');
    }
  };

  return (
    <input
      type="number"
      min={0} max={100} step={1}
      value={raw}
      disabled={disabled}
      aria-label={`Marks for ${subjectName || `subject ${subjectIndex + 1}`} (out of 100)`}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      placeholder="0–100"
      style={{
        padding: '5px 8px', borderRadius: 8,
        background: value !== null ? `${color}12` : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${value !== null ? color + '44' : 'rgba(255,255,255,0.09)'}`,
        outline: 'none', color: value !== null ? color : 'var(--text-secondary)',
        fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
        textAlign: 'center', width: '100%',
        transition: 'all 0.18s',
      }}
    />
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({
  label, value, suffix = '', color = 'var(--text-primary)', icon,
}: { label: string; value: number; suffix?: string; color?: string; icon: React.ReactNode }) {
  const animated = useAnimatedNumber(value);
  return (
    <div style={{
      background: 'var(--bg-surface)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid var(--border-default)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{icon}</span>
      </div>
      <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {animated.toFixed(suffix === '%' ? 1 : 2)}{suffix}
      </span>
    </div>
  );
}

// ── Donut center label ────────────────────────────────────────────────────────
function DonutCenterLabel({ cx, cy, sgpa }: { cx?: number; cy?: number; sgpa: number }) {
  const animated = useAnimatedNumber(sgpa);
  return (
    <g>
      <text x={cx} y={(cy ?? 0) - 8} textAnchor="middle" fill="#F0F2F8"
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
        {animated.toFixed(2)}
      </text>
      <text x={cx} y={(cy ?? 0) + 12} textAnchor="middle" fill="#8B93A8"
        style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
        SGPA
      </text>
    </g>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: chartTheme.tooltip.bg,
      border: `1px solid ${chartTheme.tooltip.border}`,
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {label !== undefined && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? chartTheme.tooltip.text, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Grade scale reference card ────────────────────────────────────────────────
function GradeScaleCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid var(--border-default)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 'var(--radius-lg)',
      padding: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        SKIT Grading Scale (marks → grade)
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
        {GRADE_SCALE.map(g => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: g.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{g.label}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {g.label === 'F' ? '<40' : g.label === 'P' ? '40–44' : `≥${g.minMark}`}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({g.point})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calculator Tab ─────────────────────────────────────────────────────────────
function CalculatorTab({ sem }: { sem: number }) {
  const { semesters, addSubject, updateSubject, removeSubject, resetSemester, lockSemester } = useGPAStore();
  const semData = semesters[sem] ?? { subjects: [], locked: false };
  const { subjects, locked } = semData;

  const sgpa = useMemo(() => computeSGPA(subjects), [subjects]);
  const totalCredits = subjects.filter(s => s.marks !== null).reduce((a, s) => a + s.credits, 0);
  const animatedSGPA = useAnimatedNumber(sgpa);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>

      {/* Grade scale reference */}
      <GradeScaleCard />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => resetSemester(sem)} title="Reset to defaults"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
          >
            <RefreshCw size={12} /> Reset
          </button>
          <button
            onClick={() => lockSemester(sem, !locked)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: locked ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${locked ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, color: locked ? '#818CF8' : 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
          >
            {locked ? <Lock size={12} /> : <Unlock size={12} />}
            {locked ? 'Locked' : 'Lock'}
          </button>
        </div>
      </div>

      {/* Subject table */}
      <div style={{
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--border-default)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 72px 52px 20px', gap: 6, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Subject', 'Cr', 'Marks', 'Grade', ''].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {subjects.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No subjects. Add one below.
          </div>
        ) : subjects.map((sub, idx) => {
          const gradeEntry = sub.marks !== null ? marksToGrade(sub.marks) : null;
          const gp = sub.marks !== null ? marksToPoint(sub.marks) : null;
          return (
            <div
              key={sub.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 44px 72px 52px 20px',
                gap: 6, padding: '10px 14px', alignItems: 'center',
                borderBottom: idx < subjects.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: gradeEntry ? `${gradeEntry.color}08` : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Subject name */}
              <input
                aria-label={`Subject name ${idx + 1}`}
                value={sub.name}
                disabled={locked}
                onChange={e => updateSubject(sem, sub.id, { name: e.target.value })}
                placeholder="Subject name"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)', width: '100%', padding: 0 }}
              />

              {/* Credits */}
              <input
                aria-label={`Credits for subject ${idx + 1}`}
                type="number" min={1} max={6}
                value={sub.credits}
                disabled={locked}
                onChange={e => updateSubject(sem, sub.id, { credits: Math.max(1, Math.min(6, parseInt(e.target.value) || 1)) })}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '4px 4px', width: '100%' }}
              />

              {/* Marks input */}
              <MarksInput
                value={sub.marks}
                onChange={v => updateSubject(sem, sub.id, { marks: v })}
                disabled={locked}
                subjectName={sub.name}
                subjectIndex={idx}
              />

              {/* Auto grade badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <GradeBadge marks={sub.marks} />
                {gp !== null && (
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{gp} pts</span>
                )}
              </div>

              {/* Delete */}
              <button
                aria-label={`Remove subject ${idx + 1}`}
                onClick={() => removeSubject(sem, sub.id)}
                disabled={locked}
                style={{ background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: locked ? 0.3 : 1, display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}

        {/* Add subject */}
        {!locked && (
          <button
            onClick={() => addSubject(sem)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
          >
            <Plus size={14} /> Add Subject
          </button>
        )}
      </div>

      {/* SGPA footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(99,102,241,0.25)', borderTop: '1px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-lg)', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
        <div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Credits</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{totalCredits}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>SGPA</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#818CF8', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>{animatedSGPA.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { semesters, activeSemester, getAllSemesterSGPAs } = useGPAStore();
  const subjects   = semesters[activeSemester]?.subjects ?? [];
  const sgpa       = useMemo(() => computeSGPA(subjects), [subjects]);
  const semHistory = useMemo(() => getAllSemesterSGPAs(), [getAllSemesterSGPAs]);

  // Grade distribution for donut
  const gradeDistData = useMemo(() => {
    const entered = subjects.filter(s => s.marks !== null);
    const map: Record<string, { credits: number; count: number; color: string }> = {};
    entered.forEach(s => {
      const g = marksToGrade(s.marks);
      if (!map[g.label]) map[g.label] = { credits: 0, count: 0, color: g.color };
      map[g.label].credits += s.credits;
      map[g.label].count   += 1;
    });
    return Object.entries(map).map(([grade, d]) => ({ grade, ...d, value: d.credits }));
  }, [subjects]);

  // Credits/marks bar chart
  const creditsBarData = useMemo(() => {
    return subjects
      .filter(s => s.marks !== null)
      .map(s => ({
        name:     s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name,
        fullName: s.name,
        marks:    s.marks ?? 0,
        credits:  s.credits,
        color:    marksToColor(s.marks),
        grade:    marksToGrade(s.marks).label,
      }));
  }, [subjects]);

  // Marks scatter — all subjects in active sem
  const marksBarData = useMemo(() => {
    return subjects
      .filter(s => s.marks !== null)
      .map(s => ({
        name:    s.name.length > 12 ? s.name.slice(0, 11) + '…' : s.name,
        marks:   s.marks ?? 0,
        color:   marksToColor(s.marks),
        grade:   marksToGrade(s.marks).label,
      }));
  }, [subjects]);

  const radarData  = useMemo(() => semHistory.map(d => ({ sem: `S${d.sem}`, sgpa: d.sgpa })), [semHistory]);
  const showRadar  = radarData.length >= 3;
  const showTrend  = semHistory.length >= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Marks chart */}
      {marksBarData.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Marks per Subject · S{activeSemester}
          </h3>
          <div role="img" aria-label="Bar chart showing marks per subject">
            <ResponsiveContainer width="100%" height={marksBarData.length * 34 + 24}>
              <BarChart layout="vertical" data={marksBarData} margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0, 40, 50, 60, 70, 80, 90, 100]} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                {/* Reference lines for grade boundaries */}
                <ReferenceLine x={90} stroke="#10B98155" strokeDasharray="3 3" />
                <ReferenceLine x={80} stroke="#8B5CF655" strokeDasharray="3 3" />
                <ReferenceLine x={70} stroke="#6366F155" strokeDasharray="3 3" />
                <ReferenceLine x={60} stroke="#0EA5E955" strokeDasharray="3 3" />
                <ReferenceLine x={40} stroke="#EF444455" strokeDasharray="3 3" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: chartTheme.tooltip.bg, border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <p style={{ color: chartTheme.tooltip.text, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{d.name}</p>
                      <p style={{ color: d.color, fontSize: 14, fontWeight: 700 }}>{d.marks}/100 · {d.grade}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="marks" radius={[0, 6, 6, 0]} isAnimationActive label={{ position: 'right', fill: chartTheme.text, fontSize: 10, fontFamily: 'var(--font-mono)', formatter: (v: unknown) => String(v) }}>
                  {marksBarData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grade distribution donut */}
      <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Grade Distribution · S{activeSemester}
        </h3>
        {gradeDistData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Enter marks to see distribution</p>
        ) : (
          <div role="img" aria-label="Donut chart showing grade distribution by credits">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={gradeDistData} innerRadius="60%" outerRadius="82%"
                  dataKey="value" paddingAngle={2} isAnimationActive
                  label={({ cx, cy }) => <DonutCenterLabel cx={cx} cy={cy} sgpa={sgpa} />}
                  labelLine={false}
                >
                  {gradeDistData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: chartTheme.tooltip.bg, border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <p style={{ color: d.color, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{d.grade}</p>
                      <p style={{ color: chartTheme.tooltip.text, fontSize: 12 }}>{d.count} subject{d.count !== 1 ? 's' : ''} · {d.credits} credits</p>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', justifyContent: 'center', marginTop: 4 }}>
              {gradeDistData.map(d => (
                <div key={d.grade} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: d.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{d.grade}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.credits}cr</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Credits bar chart */}
      {creditsBarData.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Credits by Subject
          </h3>
          <div role="img" aria-label="Bar chart showing credits by subject colored by grade">
            <ResponsiveContainer width="100%" height={creditsBarData.length * 34 + 20}>
              <BarChart layout="vertical" data={creditsBarData} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                <XAxis type="number" domain={[0, 6]} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: chartTheme.tooltip.bg, border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <p style={{ color: chartTheme.tooltip.text, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{d.fullName}</p>
                      <p style={{ color: d.color, fontSize: 13, fontWeight: 700 }}>{d.grade} · {d.marks}/100 · {d.credits} credits</p>
                    </div>
                  );
                }} />
                <Bar dataKey="credits" radius={[0, 6, 6, 0]} isAnimationActive>
                  {creditsBarData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CGPA trend */}
      {showTrend && (
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            CGPA Progression
          </h3>
          <div role="img" aria-label="Area chart showing CGPA and SGPA progression">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={semHistory.map(d => ({ name: `S${d.sem}`, CGPA: d.cgpa, SGPA: d.sgpa }))} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="cgpaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={8} stroke="rgba(99,102,241,0.35)" strokeDasharray="4 4" label={{ value: 'First', fill: '#6366F188', fontSize: 9 }} />
                <ReferenceLine y={6} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 4" label={{ value: 'Pass', fill: '#EF444488', fontSize: 9 }} />
                <Area type="monotone" dataKey="CGPA" stroke="#6366F1" strokeWidth={2.5} fill="url(#cgpaGrad)" dot={{ r: 4, fill: '#6366F1', stroke: '#0A0C14', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }} isAnimationActive />
                <Area type="monotone" dataKey="SGPA" stroke="#10B981" strokeWidth={2} strokeDasharray="6 3" fill="url(#sgpaGrad)" dot={{ r: 3, fill: '#10B981', stroke: '#0A0C14', strokeWidth: 1.5 }} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 2.5, background: '#6366F1', display: 'inline-block', borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: chartTheme.text }}>CGPA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 2, background: '#10B981', display: 'inline-block', borderRadius: 2, opacity: 0.8 }} />
              <span style={{ fontSize: 11, color: chartTheme.text }}>SGPA</span>
            </div>
          </div>
        </div>
      )}

      {/* Radar */}
      {showRadar && (
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>SGPA Radar</h3>
          <div role="img" aria-label="Radar chart showing SGPA per semester">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                <PolarGrid gridType="polygon" stroke={chartTheme.grid} />
                <PolarAngleAxis dataKey="sem" tick={{ fill: chartTheme.text, fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fill: chartTheme.text, fontSize: 9 }} axisLine={false} />
                <Radar dataKey="sgpa" stroke="#6366F1" fill="#6366F1" fillOpacity={0.18} strokeWidth={2} isAnimationActive />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!showTrend && gradeDistData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          Enter marks to see analytics
        </div>
      )}
    </div>
  );
}

// ── Prior Semester History ────────────────────────────────────────────────────
function PriorSemHistory() {
  const { manualHistory, setManualHistory, semesters } = useGPAStore();
  const [editing, setEditing] = useState<Record<number, string>>({});

  const manualSems = [1,2,3,4,5,6,7,8].filter(sem =>
    !(semesters[sem]?.subjects ?? []).some(s => s.marks !== null)
  );

  return (
    <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Previous Semester CGPA
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        For semesters you completed before using ClassHub, enter your cumulative CGPA directly. This feeds the CGPA trend chart.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {manualSems.map(sem => {
          const saved = manualHistory[sem];
          const draft = editing[sem] ?? '';
          return (
            <div key={sem} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', width: 24 }}>S{sem}</span>
              <input
                type="number" min={0} max={10} step={0.01}
                value={draft !== '' ? draft : (saved?.toString() ?? '')}
                onChange={e => setEditing(p => ({ ...p, [sem]: e.target.value }))}
                onBlur={() => {
                  const val = parseFloat(editing[sem] ?? '');
                  if (!isNaN(val) && val >= 0 && val <= 10) setManualHistory(sem, val);
                  else if (editing[sem] === '') setManualHistory(sem, null);
                  setEditing(p => { const n = { ...p }; delete n[sem]; return n; });
                }}
                placeholder="CGPA (e.g. 7.42)"
                style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)' }}
              />
              {saved !== undefined && (
                <button onClick={() => setManualHistory(sem, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
        {manualSems.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>All semesters have marks entered.</p>
        )}
      </div>
    </div>
  );
}

// ── Report Tab ─────────────────────────────────────────────────────────────────
function ReportTab() {
  const { semesters, manualHistory, activeBranch, getAllSemesterSGPAs, getCGPA, getPercentage } = useGPAStore();
  const cgpa       = getCGPA();
  const pct        = getPercentage();
  const semHistory = getAllSemesterSGPAs();
  const [exporting, setExporting] = useState(false);

  const totalCreditsAll = Object.values(semesters)
    .flatMap(s => s.subjects)
    .filter(s => s.marks !== null)
    .reduce((a, s) => a + s.credits, 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportGPAReport('gpa-report-card');
      showToast('Report downloaded!', 'success');
    } catch { showToast('Export failed', 'error'); }
    finally { setExporting(false); }
  };

  const handleShare = () => {
    generateShareURL({ activeBranch, semesters, manualHistory } as unknown as Record<string, unknown>);
    showToast('Share link copied to clipboard!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Report card (html2canvas target) */}
      <div id="gpa-report-card" style={{ background: '#0A0C14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F2F8', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>ClassHub</div>
            <div style={{ fontSize: 11, color: '#8B93A8', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>SKIT · Autonomous · CBCS</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#8B93A8', fontFamily: 'JetBrains Mono, monospace' }}>{activeBranch} · GPA Report</div>
            <div style={{ fontSize: 10, color: '#4A5268', fontFamily: 'JetBrains Mono, monospace' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Key metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'CGPA',           value: cgpa.toFixed(2),         color: '#818CF8' },
            { label: 'Percentage',     value: `${pct.toFixed(1)}%`,    color: '#10B981' },
            { label: 'Credits Earned', value: String(totalCreditsAll), color: '#F0F2F8' },
            { label: 'Semesters',      value: String(semHistory.length), color: '#F0F2F8' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#8B93A8', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.03em' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Per-semester breakdown */}
        {semHistory.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['Semester', 'SGPA', 'Cumul. CGPA'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: '#4A5268', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {semHistory.map((d, i) => (
              <div key={d.sem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 14px', borderBottom: i < semHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ fontSize: 13, color: '#F0F2F8', fontFamily: 'JetBrains Mono, monospace' }}>Semester {d.sem}</span>
                <span style={{ fontSize: 13, color: '#10B981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{d.sgpa.toFixed(2)}</span>
                <span style={{ fontSize: 13, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{d.cgpa.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Grading scale legend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 9, color: '#4A5268', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>SKIT Autonomous Grading Scale</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px' }}>
            {GRADE_SCALE.map(g => (
              <span key={g.label} style={{ fontSize: 10, color: g.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {g.label}({g.point}) ≥{g.minMark}
              </span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#4A5268', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
          Generated by ClassHub · SKIT Jaipur · classhub.app
        </div>
      </div>

      {/* Prior sem history */}
      <PriorSemHistory />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleExport} disabled={exporting}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', borderRadius: 'var(--radius-md)', background: exporting ? 'rgba(99,102,241,0.5)' : 'linear-gradient(180deg, #818CF8 0%, #6366F1 100%)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', transition: 'all 0.15s' }}
        >
          <Download size={15} />
          {exporting ? 'Exporting…' : 'Download PNG'}
        </button>
        <button
          onClick={handleShare}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <Share2 size={15} />
          Copy Link
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'calc',      label: 'Calculator', icon: BookOpen },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3 },
  { id: 'report',    label: 'Report',     icon: Award },
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

  const totalCreditsAll = useMemo(() =>
    Object.values(semesters)
      .flatMap(s => s.subjects)
      .filter(s => s.marks !== null)
      .reduce((a, s) => a + s.credits, 0),
    [semesters]
  );

  const getSemStatus = useCallback((sem: number) => {
    const subs = semesters[sem]?.subjects ?? [];
    const entered = subs.filter(s => s.marks !== null);
    if (entered.length === 0) return 'empty';
    if (entered.length === subs.length) return 'complete';
    return 'partial';
  }, [semesters]);

  const semStatusColor: Record<string, string> = {
    empty: 'rgba(255,255,255,0.15)',
    partial: '#F59E0B',
    complete: '#10B981',
  };

  return (
    <div className="page-shell">
      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,12,20,0.95)', backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)', borderBottom: '1px solid var(--border-default)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => navigate('/app/profile')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}
            aria-label="Back to profile"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1 }}>GPA Calculator</h1>
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6, padding: '3px 8px', letterSpacing: '0.05em' }}>
            SKIT · Autonomous
          </span>
        </div>
        {/* Branch pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
          {BRANCHES.map(b => (
            <button key={b} onClick={() => setActiveBranch(b as Branch)}
              style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: activeBranch === b ? '#6366F1' : 'rgba(255,255,255,0.06)', border: `1px solid ${activeBranch === b ? '#6366F1' : 'rgba(255,255,255,0.08)'}`, color: activeBranch === b ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}>
              {b}
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MetricCard label="SGPA" value={sgpa} color="#818CF8" icon={<TrendingUp size={14} />} />
          <MetricCard label="CGPA" value={cgpa} color="#60A5FA" icon={<Award size={14} />} />
          <MetricCard label="Percentage" value={pct} suffix="%" color="#10B981" icon={<BarChart3 size={14} />} />
          <MetricCard label="Credits" value={totalCreditsAll} color="var(--text-primary)" icon={<BookOpen size={14} />} />
        </div>

        {/* Semester nav */}
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border-default)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
            {[1,2,3,4,5,6,7,8].map(sem => {
              const semSgpa  = getSGPA(sem);
              const status   = getSemStatus(sem);
              const isActive = activeSemester === sem;
              return (
                <button key={sem} onClick={() => setActiveSemester(sem)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 10px', borderRadius: 10, flexShrink: 0, background: isActive ? 'rgba(99,102,241,0.18)' : 'transparent', border: `1.5px solid ${isActive ? 'rgba(99,102,241,0.45)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s', minWidth: 48 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#818CF8' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>S{sem}</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: semStatusColor[status], flexShrink: 0 }} />
                  {status !== 'empty' && (
                    <span style={{ fontSize: 9, color: isActive ? '#818CF8' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                      {semSgpa.toFixed(1)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', borderRadius: 9, background: isActive ? 'var(--bg-elevated)' : 'transparent', border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ animation: 'gpafade 0.15s ease', flex: 1 }}>
          {activeTab === 'calc'      && <CalculatorTab sem={activeSemester} />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'report'    && <ReportTab />}
        </div>
      </main>

      <style>{`
        @keyframes gpafade { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <NavBar />
    </div>
  );
}
