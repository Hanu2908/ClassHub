import { useMemo } from 'react';
import { BarChart3, Award, TrendingUp, Sparkles } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveRadar } from '@nivo/radar';
import { useGPAStore } from '../../../store/gpaStore';
import { computeSGPA, marksToColor, marksToGrade } from '../../../lib/gpaData';

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
  gradeO:    '#4ADE80',
  gradeAp:   '#818CF8',
  gradeA:    '#60A5FA',
  gradeBp:   '#67E8F9',
  gradeB:    '#34D399',
  gradeC:    '#FCD34D',
  gradeP:    '#F97316',
  grid:      'rgba(255,255,255,0.045)',
  accent:    '#5B7CF7',
};

const N = {
  surface:   T.card,
  border:    T.cardBdr,
  text:      T.body,
  grid:      T.grid,
  indigoBr:  T.cgpa,
  emerald:   T.sgpa,
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

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBdr}`,
      borderTop: `1.5px solid ${T.topBdr}`,
      borderRadius: 'var(--radius-lg)', padding: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
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

export default function AnalyticsTab() {
  const { semesters, activeSemester, getAllSemesterSGPAs } = useGPAStore();
  const subjects   = semesters[activeSemester]?.subjects ?? [];
  const sgpa       = useMemo(() => computeSGPA(subjects), [subjects]);
  const semHistory = useMemo(() => getAllSemesterSGPAs(), [getAllSemesterSGPAs]);

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

  const barData = useMemo(() => subjects
    .filter(s => s.marks !== null)
    .map(s => ({
      subject: s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name,
      fullName: s.name,
      Marks: s.marks ?? 0,
      color: marksToColor(s.marks),
      grade: marksToGrade(s.marks).label,
    })), [subjects]);

  const areaData = useMemo(() => semHistory.map(d => ({ name: `S${d.sem}`, CGPA: d.cgpa, SGPA: d.sgpa })), [semHistory]);
  const radarData = useMemo(() => semHistory.map(d => ({ semester: `S${d.sem}`, SGPA: d.sgpa })), [semHistory]);

  const showTrend = semHistory.length >= 1;
  const showRadar = semHistory.length >= 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Marks bar chart */}
      {barData.length > 0 && (
        <GlassCard>
          <ChartTitle><BarChart3 size={12} color={T.label} /> Marks per Subject · S{activeSemester}</ChartTitle>
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

      {/* Grade distribution donut */}
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
                colors={({ data }: any) => data.color}
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
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: T.heading, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', lineHeight: 1 }}>{sgpa.toFixed(2)}</span>
                <span style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>SGPA</span>
              </div>
            </div>
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

      {/* CGPA Progression area chart */}
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

      {/* SGPA Radar */}
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
