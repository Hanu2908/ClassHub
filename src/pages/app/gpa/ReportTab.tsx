import { useState, useMemo } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { useGPAStore } from '../../../store/gpaStore';
import { marksToColor, marksToGrade, GRADE_SCALE, computeCGPA, computePercentage } from '../../../lib/gpaData';
import { exportGPAReport, generateShareURL } from '../../../lib/pdfExport';
import { toast } from 'sonner';

const T = {
  card:      'rgba(18,20,32,0.7)',
  cardBdr:   'rgba(255,255,255,0.07)',
  topBdr:    'rgba(255,255,255,0.1)',
  label:     '#6B7280',
  body:      '#9CA3AF',
  heading:   '#E5E7EB',
  cgpa:      '#7C9EF8',
  sgpa:      '#6DB89B',
};

const N = {
  border:    T.cardBdr,
  text:      T.body,
};

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

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 10, fontWeight: 600, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </h3>
  );
}

function PriorSemHistory() {
  const { manualHistory, setManualHistory, semesters } = useGPAStore();
  const [editing, setEditing] = useState<Record<number, string>>({});
  const manualSems = [1,2,3,4,5,6,7,8].filter(sem =>
    !(semesters[sem]?.subjects ?? []).some(s => s.marks !== null)
  );
  return (
    <GlassCard>
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

export default function ReportTab() {
  const { semesters, manualHistory, activeBranch, getAllSemesterSGPAs } = useGPAStore();
  const cgpa       = useMemo(() => computeCGPA(semesters, manualHistory), [semesters, manualHistory]);
  const pct        = useMemo(() => computePercentage(cgpa), [cgpa]);
  const semHistory = useMemo(() => {
    // Reference semesters and manualHistory to satisfy react-hooks/exhaustive-deps and trigger recalculation on change
    void semesters;
    void manualHistory;
    return getAllSemesterSGPAs();
  }, [semesters, manualHistory, getAllSemesterSGPAs]);
  const [exporting, setExporting] = useState(false);

  const totalCredits = Object.values(semesters).flatMap(s => s.subjects).filter(s => s.marks !== null).reduce((a, s) => a + s.credits, 0);

  const handleExport = async () => {
    setExporting(true);
    try { await exportGPAReport('gpa-report-card'); toast.success('Report downloaded!'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleShare = () => {
    generateShareURL({ activeBranch, semesters, manualHistory } as unknown as Record<string, unknown>);
    toast.success('Share link copied!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Report card */}
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
