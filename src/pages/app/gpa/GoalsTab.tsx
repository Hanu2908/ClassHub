import { useState, useEffect, useMemo } from 'react';
import { Target, Sparkles, X } from 'lucide-react';
import { useGPAStore } from '../../../store/gpaStore';
import { computeSGPA, computeCGPA, SUBJECTS_DATA } from '../../../lib/gpaData';

const T = {
  card:      'rgba(18,20,32,0.7)',
  cardBdr:   'rgba(255,255,255,0.07)',
  topBdr:    'rgba(255,255,255,0.1)',
  label:     '#6B7280',
  body:      '#9CA3AF',
  heading:   '#E5E7EB',
};

function GlassCard({ children, style: sx }: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) {
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

export default function GoalsTab() {
  const { targetCgpa, setTargetCgpa, semesters, manualHistory, activeBranch } = useGPAStore();
  const cgpa = useMemo(() => computeCGPA(semesters, manualHistory), [semesters, manualHistory]);
  
  // Set default goal if null and we have a CGPA
  useEffect(() => {
    if (targetCgpa === null && cgpa > 0) {
      setTargetCgpa(parseFloat((cgpa + 0.2).toFixed(2)));
    }
  }, [cgpa, targetCgpa, setTargetCgpa]);

  const [val, setVal] = useState(targetCgpa ?? (cgpa > 0 ? cgpa + 0.2 : 8.0));
  const [prevTargetCgpa, setPrevTargetCgpa] = useState(targetCgpa);

  if (targetCgpa !== prevTargetCgpa) {
    if (targetCgpa !== null) {
      setVal(targetCgpa);
    }
    setPrevTargetCgpa(targetCgpa);
  }

  const calculateRequiredSgpa = () => {
    let currentTotalCredits = 0;
    let currentWeightedScore = 0;
    let remainingCredits = 0;
    
    // Loop through semesters 1 to 8
    for (let sem = 1; sem <= 8; sem++) {
      const subs = semesters[sem]?.subjects ?? [];
      const completedSubs = subs.filter(s => s.marks !== null && s.credits > 0);
      const remainingSubs = subs.filter(s => s.marks === null && s.credits > 0);
      
      if (completedSubs.length > 0) {
        const completedCredits = completedSubs.reduce((acc, s) => acc + s.credits, 0);
        currentTotalCredits += completedCredits;
        currentWeightedScore += computeSGPA(completedSubs) * completedCredits;
      }
      
      if (semesters[sem]) {
        const remainingCrs = remainingSubs.reduce((acc, s) => acc + s.credits, 0);
        remainingCredits += remainingCrs;
      } else {
        const defaultSubs = SUBJECTS_DATA[activeBranch]?.[sem] ?? [];
        const defaultCredits = defaultSubs.reduce((acc, s) => acc + s.credits, 0) || 20;
        remainingCredits += defaultCredits;
      }
    }
    
    if (remainingCredits === 0) return null;
    
    const totalFutureCredits = currentTotalCredits + remainingCredits;
    const requiredWeightedScore = (val * totalFutureCredits) - currentWeightedScore;
    const requiredAvgSgpa = requiredWeightedScore / remainingCredits;
    
    return parseFloat(requiredAvgSgpa.toFixed(2));
  };

  const requiredSgpa = calculateRequiredSgpa();

  const getInsightTier = () => {
    if (requiredSgpa === null) return null;
    if (requiredSgpa > 10.0) {
      return {
        bg: 'rgba(248,113,113,0.08)',
        border: 'rgba(248,113,113,0.18)',
        color: '#F87171',
        title: 'Mathematically Impossible',
        desc: 'This target is mathematically out of range for your remaining credits.',
        icon: <X size={13} color="#F87171" />
      };
    } else if (requiredSgpa > 9.0) {
      return {
        bg: 'rgba(251,191,36,0.08)',
        border: 'rgba(251,191,36,0.18)',
        color: '#FBBF24',
        title: 'Extreme Challenge',
        desc: 'Requires near-perfect O/A+ grades across your remaining credits.',
        icon: <Sparkles size={13} color="#FBBF24" />
      };
    } else {
      return {
        bg: 'rgba(52,211,153,0.08)',
        border: 'rgba(52,211,153,0.18)',
        color: '#34D399',
        title: 'Realistic Target',
        desc: 'Target is achievable with steady academic performance.',
        icon: <Target size={13} color="#34D399" />
      };
    }
  };

  const insight = getInsightTier();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GlassCard style={{}} accent={insight?.color ? `${insight.color}22` : 'rgba(255,255,255,0.09)'}>
        <ChartTitle><Target size={12} color={insight?.color || 'var(--accent-primary)'} /> Set Target CGPA</ChartTitle>
        <div style={{ padding: '20px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: insight?.color || 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
            {val.toFixed(2)}
          </div>
          
          <div style={{ width: '100%', position: 'relative' }}>
            <input 
              type="range" 
              min="4" max="10" step="0.01" 
              value={val} 
              aria-label="Target CGPA Range Slider"
              onChange={e => {
                setVal(parseFloat(e.target.value));
              }}
              onMouseUp={() => setTargetCgpa(val)}
              onTouchEnd={() => setTargetCgpa(val)}
              style={{ width: '100%', accentColor: insight?.color || 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>4.00</span>
              <span>10.00</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {requiredSgpa !== null && insight && (
        <div style={{
          background: insight.bg,
          border: `1.5px solid ${insight.border}`,
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <h3 style={{ fontSize: 10, fontWeight: 600, color: insight.color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {insight.icon} {insight.title}
          </h3>
          <div style={{ padding: '10px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>To achieve a {val.toFixed(2)} CGPA, you need an average SGPA of:</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: insight.color, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {requiredSgpa.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {insight.desc}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
