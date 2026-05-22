import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Loader, Edit3,
  TrendingUp, TrendingDown, Target, Info, ChevronDown, ChevronUp,
  BarChart3, PieChart, Calendar, Plus, Minus, Calculator
} from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { DonutRing } from '../../components/Shared';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';
import type { AttendanceSubject } from '../../store/appStore';
import { useAppStore } from '../../store/appStore';
import { useAttendance, useSchedule } from '../../hooks/useSupabaseQuery';
import { useBulkUpsertAttendance, useEnsureSubjects, useUpdateSubject } from '../../hooks/useSupabaseMutations';

import { parseERPAttendance } from '../../lib/utils/attendance';
import type { ParsedSubject } from '../../lib/utils/attendance';

interface ParsedERPSubject extends ParsedSubject {
  subjectId: string | null;
}

const STATUS_COLOR = (pct: number) => {
  const rounded = Math.round(pct);
  return rounded >= 85 ? 'var(--status-safe)' : rounded >= 75 ? 'var(--status-warning)' : 'var(--status-critical)';
};

const STATUS_BG = (pct: number) => {
  const rounded = Math.round(pct);
  return rounded >= 85 ? 'var(--status-safe-bg)' : rounded >= 75 ? 'var(--status-warning-bg)' : 'var(--status-critical-bg)';
};

const HOLIDAYS = ["2026-02-15", "2026-03-02", "2026-03-03", "2026-03-26", "2026-08-15", "2026-08-28", "2026-09-04", "2026-10-20"];

function isHolidayOrSunday(date: Date): boolean {
  if (date.getDay() === 0) return true;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  
  if (HOLIDAYS.includes(dateStr)) return true;
  
  // Autumn Break: Nov 6 to Nov 15
  const diwaliStart = new Date(yyyy, 10, 6);
  const diwaliEnd = new Date(yyyy, 10, 15);
  if (date >= diwaliStart && date <= diwaliEnd) return true;
  
  // Winter Vacation: Dec 25 to Dec 31
  const winterStart = new Date(yyyy, 11, 25);
  const winterEnd = new Date(yyyy, 11, 31);
  if (date >= winterStart && date <= winterEnd) return true;
  
  return false;
}

function getArcSegment(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = centerX + radius * Math.cos(startRad);
  const y1 = centerY - radius * Math.sin(startRad);
  const x2 = centerX + radius * Math.cos(endRad);
  const y2 = centerY - radius * Math.sin(endRad);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}


function SubjectCard({ sub }: { sub: AttendanceSubject }) {
  const color = STATUS_COLOR(sub.percentage);
  const bg = STATUS_BG(sub.percentage);
  const pct = sub.percentage;

  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DonutRing percentage={pct} size={52}>
          <span className="t-mono" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
        </DonutRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <p className="truncate t-subtitle" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>
              {sub.name}
            </p>
          </div>
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
            {sub.code} · {sub.type} · {sub.present}/{sub.total} present
          </p>
          <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '8px 12px', background: bg, borderRadius: 'var(--radius-sm)' }}>
        {pct >= 75 ? (
          sub.canSkip > 0 ? (
            <p className="t-caption" style={{ color, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={13} /> Can skip <strong>{sub.canSkip}</strong> more class{sub.canSkip > 1 ? 'es' : ''}
            </p>
          ) : (
            <p className="t-caption" style={{ color, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={13} /> At threshold — don't skip any more
            </p>
          )
        ) : (
          <p className="t-caption" style={{ color, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} /> Attend next <strong>{sub.needToAttend}</strong> consecutively to recover
          </p>
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const authUser = useAppStore(s => s.authUser);
  const [erpOpen, setErpOpen] = useState(false);
  const [erpText, setErpText] = useState('');
  const [parsed, setParsed] = useState<ParsedERPSubject[] | null>(null);

  // Playground / Sandbox States
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<'boost' | 'bunk' | 'target' | 'od' | 'mix'>('boost');
  const [boostVal, setBoostVal] = useState<number>(5);
  const [bunkVal, setBunkVal] = useState<number>(3);
  const [targetVal, setTargetVal] = useState<number>(80);
  const [odVal, setOdVal] = useState<number>(2);
  const [mixAttendVal, setMixAttendVal] = useState<number>(4);
  const [mixBunkVal, setMixBunkVal] = useState<number>(2);

  // Timetable Sync and Date prediction
  const { data: fullSchedule = {} } = useSchedule();
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, number>>({
    Mon: 5, Tue: 5, Wed: 5, Thu: 6, Fri: 5, Sat: 5
  });
  const [hasLoadedSchedule, setHasLoadedSchedule] = useState(false);

  // Sync automatic slot frequencies from timetable DB
  useEffect(() => {
    if (fullSchedule && Object.keys(fullSchedule).length > 0 && !hasLoadedSchedule) {
      const timer = setTimeout(() => {
        setScheduleOverrides(prev => {
          const nextOverrides = { ...prev };
          let hasAnySlots = false;
          for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
            const slots = fullSchedule[day] ?? [];
            if (slots.length > 0) {
              nextOverrides[day] = slots.length;
              hasAnySlots = true;
            }
          }
          return hasAnySlots ? nextOverrides : prev;
        });
        setHasLoadedSchedule(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fullSchedule, hasLoadedSchedule]);

  const [predictedDate, setPredictedDate] = useState<string | null>(null);
  const [predictedDaysCount, setPredictedDaysCount] = useState<number | null>(null);

  // SVG Chart States
  const [chartType, setChartType] = useState<'bar' | 'doughnut'>('doughnut');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Collapsible Breakdown Lists
  const [listExpanded, setListExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [filterType, setFilterType] = useState<'all' | 'safe' | 'danger'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Info Help boxes states
  const [activeInfoBox, setActiveInfoBox] = useState<string | null>(null);

  const bulkUpsert = useBulkUpsertAttendance();
  const ensureSubjects = useEnsureSubjects();
  const updateSubjectMut = useUpdateSubject();
  const { data: attendance, isLoading } = useAttendance();

  const subjects = useMemo(() => attendance?.subjects ?? [], [attendance?.subjects]);
  const overall = attendance?.overall ?? 0;

  // Mathematically perfect sums to prevent sum-bugs
  const overallAttended = useMemo(() => subjects.reduce((sum, s) => sum + s.present, 0), [subjects]);
  const overallTotal = useMemo(() => subjects.reduce((sum, s) => sum + s.total, 0), [subjects]);
  const safeOverall = overallTotal > 0 ? (overallAttended / overallTotal) * 100 : overall;

  const arcSegments = useMemo(() => {
    if (subjects.length === 0) return [];
    
    // Group subjects into three tiers and sum up their total classes held
    let dangerTotal = 0;
    let warningTotal = 0;
    let safeTotal = 0;
    
    subjects.forEach(sub => {
      if (sub.percentage < 75) {
        dangerTotal += sub.total;
      } else if (sub.percentage < 85) {
        warningTotal += sub.total;
      } else {
        safeTotal += sub.total;
      }
    });
    
    const grandTotal = dangerTotal + warningTotal + safeTotal;
    if (grandTotal === 0) return [];
    
    // Create list of active status tiers to map onto the gauge from left (Danger) to right (Safe)
    const tiers = [
      { key: 'danger', total: dangerTotal, color: 'var(--status-critical)' },
      { key: 'warning', total: warningTotal, color: 'var(--status-warning)' },
      { key: 'safe', total: safeTotal, color: 'var(--status-safe)' }
    ].filter(t => t.total > 0);
    
    const K = tiers.length;
    if (K === 0) return [];
    
    // 14 degrees coordinate offset between segments allows strokeLinecap="round" ends to lay elegantly with a beautiful visual gap
    const gapDeg = 14;
    const totalGapsDeg = (K - 1) * gapDeg;
    const totalSegmentsDeg = 180 - totalGapsDeg;
    
    const segments: Array<{
      code: string;
      percentage: number;
      path: string;
      color: string;
    }> = [];
    
    let currentAngle = 180;
    
    tiers.forEach(tier => {
      const sweepAngle = (tier.total / grandTotal) * totalSegmentsDeg;
      const startAngle = currentAngle;
      const endAngle = currentAngle - sweepAngle;
      const path = getArcSegment(100, 100, 72, startAngle, endAngle);
      
      segments.push({
        code: tier.key.toUpperCase(),
        percentage: (tier.total / grandTotal) * 100,
        path,
        color: tier.color
      });
      
      currentAngle = endAngle - gapDeg;
    });
    
    return segments;
  }, [subjects]);

  const maxGroupText = useMemo(() => {
    let dangerCount = 0;
    let warningCount = 0;
    let safeCount = 0;

    subjects.forEach(s => {
      if (s.percentage < 75) {
        dangerCount++;
      } else if (s.percentage < 85) {
        warningCount++;
      } else {
        safeCount++;
      }
    });

    const maxVal = Math.max(dangerCount, warningCount, safeCount);
    if (maxVal === 0) return { text: 'No subjects', color: 'var(--text-muted)' };

    // Tie-breaker priority: Danger first, then Warning, then Safe
    if (dangerCount === maxVal) {
      return { text: `${dangerCount} Danger`, color: 'var(--status-critical)' };
    }
    if (warningCount === maxVal) {
      return { text: `${warningCount} Warning${warningCount !== 1 ? 's' : ''}`, color: 'var(--status-warning)' };
    }
    return { text: `${safeCount} Safe`, color: 'var(--status-safe)' };
  }, [subjects]);

  const tierStyleClass = useMemo(() => {
    if (safeOverall >= 85) return 'attendance-elite';
    if (safeOverall >= 75) return 'attendance-safe';
    if (safeOverall >= 65) return 'attendance-warning';
    if (safeOverall >= 45) return 'attendance-danger';
    return 'attendance-critical';
  }, [safeOverall]);

  const tierBadgeText = useMemo(() => {
    if (safeOverall >= 85) return '👑 ELITE STUDENT';
    if (safeOverall >= 75) return '😎 SAFE ZONE';
    if (safeOverall >= 65) return '⚠️ WARNING ZONE';
    if (safeOverall >= 45) return '🔥 DANGER ZONE';
    return '💀 LEGENDARY';
  }, [safeOverall]);

  const tierMessage = useMemo(() => {
    if (safeOverall >= 85) return "Attendance so high HOD is asking for your autograph. Nerd alert! 🤓";
    if (safeOverall >= 75) return "Perfect balance. Life is set, just keep maintaining it! ✨";
    if (safeOverall >= 65) return "Living on the edge? A couple of bunks and it's game over. Sambhal ja! 🛑";
    if (safeOverall >= 45) return "HOD room loading... parent call incoming. Prayers sent. 🙏";
    return "College is temporary, backlogs are permanent. Next sem phodenge! 🗿";
  }, [safeOverall]);

  // Dynamic simulation computations
  const boostSimResult = useMemo(() => {
    const nextAttended = overallAttended + boostVal;
    const nextTotal = overallTotal + boostVal;
    const nextPercent = nextTotal > 0 ? (nextAttended / nextTotal) * 100 : 0;
    const delta = nextPercent - safeOverall;
    return { percent: nextPercent, delta };
  }, [overallAttended, overallTotal, safeOverall, boostVal]);

  const bunkSimResult = useMemo(() => {
    const nextTotal = overallTotal + bunkVal;
    const nextPercent = nextTotal > 0 ? (overallAttended / nextTotal) * 100 : 0;
    const delta = safeOverall - nextPercent;
    const remainsSafe = nextPercent >= 75;
    return { percent: nextPercent, delta, remainsSafe };
  }, [overallAttended, overallTotal, safeOverall, bunkVal]);

  const targetSimResult = useMemo(() => {
    if (targetVal <= safeOverall) return 0;
    const targetFraction = targetVal / 100;
    if (targetFraction >= 1) return 0;
    return Math.max(0, Math.ceil((targetFraction * overallTotal - overallAttended) / (1 - targetFraction)));
  }, [overallAttended, overallTotal, safeOverall, targetVal]);

  const odSimResult = useMemo(() => {
    const nextAttended = overallAttended + odVal;
    const nextPercent = overallTotal > 0 ? (nextAttended / overallTotal) * 100 : 0;
    const delta = nextPercent - safeOverall;
    return { percent: nextPercent, delta };
  }, [overallAttended, overallTotal, safeOverall, odVal]);

  const mixSimResult = useMemo(() => {
    const nextAttended = overallAttended + mixAttendVal;
    const nextTotal = overallTotal + mixAttendVal + mixBunkVal;
    const nextPercent = nextTotal > 0 ? (nextAttended / nextTotal) * 100 : 0;
    const delta = nextPercent - safeOverall;
    return { percent: nextPercent, delta };
  }, [overallAttended, overallTotal, safeOverall, mixAttendVal, mixBunkVal]);

  // Date Prediction engine
  const runPredictionDateCalculation = () => {
    if (safeOverall >= 75) {
      setPredictedDate("Relax! You are already above 75%. Enjoy your life! 😎");
      setPredictedDaysCount(0);
      return;
    }

    let needed = Math.ceil((0.75 * overallTotal - overallAttended) / 0.25);
    let daysPassed = 0;
    const currentDate = new Date();

    const schedule = [
      0, // Sun
      scheduleOverrides.Mon || 0,
      scheduleOverrides.Tue || 0,
      scheduleOverrides.Wed || 0,
      scheduleOverrides.Thu || 0,
      scheduleOverrides.Fri || 0,
      scheduleOverrides.Sat || 0
    ];

    while (needed > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      daysPassed++;
      if (isHolidayOrSunday(currentDate)) continue;

      const classesToday = schedule[currentDate.getDay()] || 0;
      needed -= classesToday;

      if (daysPassed > 365) {
        setPredictedDate("Timetable slots are blank or 75% target is too far.");
        setPredictedDaysCount(null);
        return;
      }
    }

    const dateString = currentDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    setPredictedDate(dateString);
    setPredictedDaysCount(daysPassed);
  };

  const handleParse = async () => {
    const result = parseERPAttendance(erpText);
    if (result.length === 0) {
      showToast('Could not parse attendance. Check format.', 'error');
      return;
    }

    try {
      const mapping = await ensureSubjects.mutateAsync(result.map(r => ({ code: r.code, name: r.name })));
      const enriched = result.map(r => ({ ...r, subjectId: mapping[r.code] ?? null }));
      setParsed(enriched);
      showToast(`Parsed ${result.length} subjects. Review and confirm.`, 'info');
    } catch (err: unknown) {
      console.error('Error ensuring subjects', err);
      showToast(err instanceof Error ? err.message : 'Failed to prepare subjects', 'error');
      setParsed(result.map(r => ({ ...r, subjectId: null })));
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    bulkUpsert.mutate(parsed.map(p => ({ 
      code: p.code, 
      present: p.present, 
      absent: p.absent, 
      od: p.od, 
      makeup: p.makeup 
    })), {
      onSuccess: () => {
        showToast('ERP attendance imported successfully', 'success');
        setParsed(null);
        setErpOpen(false);
        setErpText('');
      },
      onError: (err: Error) => {
        console.error('ERP import error', err);
        showToast(err.message ?? 'Failed to import attendance', 'error');
      }
    });
  };

  // Filter and Sort Subjects for breakdown
  const processedSubjects = useMemo(() => {
    let list = [...subjects];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
    }

    // Filter pills
    if (filterType === 'safe') {
      list = list.filter(s => s.percentage >= 75);
    } else if (filterType === 'danger') {
      list = list.filter(s => s.percentage < 75);
    }

    // Sort order
    if (sortOrder === 'asc') {
      list.sort((a, b) => a.percentage - b.percentage);
    } else if (sortOrder === 'desc') {
      list.sort((a, b) => b.percentage - a.percentage);
    }

    return list;
  }, [subjects, searchQuery, filterType, sortOrder]);

  if (isAuthLoading && !authUser) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div className={`page-shell ${tierStyleClass}`}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button id="attend-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Attendance</h1>
        </div>
        <button className="t-label" id="update-erp-btn" onClick={() => setErpOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', color: 'var(--accent-primary)', cursor: 'pointer' }}>
          <RefreshCw size={13} /> Update from ERP
        </button>
      </header>

      <main className="page-content" style={{ gap: 20 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader size={24} color="var(--accent-primary)" className="spin" />
          </div>
        ) : (
          <>
            {/* Top Level Premium Header Stats Card */}
            <div className="tier-glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{
                position: 'absolute', top: 0, left: '20%', right: '20%', height: 1.5,
                background: `linear-gradient(90deg, transparent, var(--tier-color, var(--accent-primary)), transparent)`,
              }} />

              <span className="badge" style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--tier-border)',
                color: 'var(--tier-color)',
                fontSize: 10,
                letterSpacing: '1px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
                marginBottom: 14
              }}>{tierBadgeText}</span>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <DonutRing percentage={safeOverall} size={104} strokeWidth={9}>
                  <span className="t-feature" style={{ color: 'var(--tier-color)' }}>
                    {safeOverall.toFixed(1)}%
                  </span>
                </DonutRing>
              </div>

              <p className="t-button" style={{ color: 'var(--text-primary)', maxWidth: '90%', margin: '0 auto', lineHeight: 1.4 }}>
                {tierMessage}
              </p>

              <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border-default)', width: '100%', justifyContent: 'center' }}>
                <div>
                  <p className="t-mono" style={{ color: 'var(--text-primary)' }}>{overallAttended}</p>
                  <p className="t-helper" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 2 }}>Attended</p>
                </div>
                <div style={{ width: 1, background: 'var(--border-default)', alignSelf: 'stretch' }} />
                <div>
                  <p className="t-mono" style={{ color: 'var(--text-primary)' }}>{overallTotal}</p>
                  <p className="t-helper" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 2 }}>Total Held</p>
                </div>
              </div>
            </div>

            {/* Premium Custom SVG Charts Card */}
            {subjects.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart3 size={15} color="var(--accent-primary)" />
                    <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>Attendance Breakdown</span>
                  </div>
                  <div className="segment-switcher">
                    <button className={`segment-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>
                      <BarChart3 size={10} /> Bar
                    </button>
                    <button className={`segment-btn ${chartType === 'doughnut' ? 'active' : ''}`} onClick={() => setChartType('doughnut')}>
                      <PieChart size={10} /> Donut
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', minHeight: 220, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {chartType === 'bar' ? (
                    <svg width="100%" height="220" viewBox="0 0 500 220" style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="bar-green" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                        </linearGradient>
                        <linearGradient id="bar-red" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
                        </linearGradient>
                      </defs>

                      {/* Y-axis grid guides */}
                      {[25, 50, 75, 100].map(val => {
                        const y = 180 - (val / 100) * 150;
                        return (
                          <g key={val}>
                            <line x1="40" y1={y} x2="480" y2={y} className="chart-grid-line" />
                            <text x="32" y={y + 3} fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">{val}%</text>
                          </g>
                        );
                      })}

                      {/* 75% target reference line */}
                      <line x1="40" y1={180 - (75 / 100) * 150} x2="480" y2={180 - (75 / 100) * 150} className="chart-threshold-line" />
                      <text x="475" y={180 - (75 / 100) * 150 - 5} fill="#f59e0b" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700" textAnchor="end">75% Target</text>

                      {/* X-axis baseline */}
                      <line x1="40" y1="180" x2="480" y2="180" className="chart-axis-line" strokeWidth="1.5" />

                      {/* Bars */}
                      {subjects.map((sub, idx) => {
                        const count = subjects.length;
                        const availWidth = 440;
                        const colWidth = availWidth / count;
                        const barWidth = Math.min(24, colWidth - 8);
                        const x = 40 + idx * colWidth + (colWidth - barWidth) / 2;
                        const barHeight = (sub.percentage / 100) * 150;
                        const y = 180 - barHeight;
                        const isSafe = sub.percentage >= 75;

                        return (
                          <g key={sub.code}>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={Math.max(2, barHeight)}
                              rx="3"
                              className="chart-bar-rect"
                              fill={isSafe ? 'url(#bar-green)' : 'url(#bar-red)'}
                              stroke={isSafe ? '#10b981' : '#ef4444'}
                              strokeWidth="1"
                              onMouseEnter={(e) => {
                                setHoveredBarIndex(idx);
                                // relative coordinates to container
                                const rect = e.currentTarget.getBoundingClientRect();
                                const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                if (parentRect) {
                                  setTooltipPos({
                                    x: rect.left - parentRect.left + barWidth / 2,
                                    y: rect.top - parentRect.top
                                  });
                                }
                              }}
                              onMouseLeave={() => setHoveredBarIndex(null)}
                            />
                            {/* Label */}
                            <text
                              x={x + barWidth / 2}
                              y="196"
                              fill="var(--text-secondary)"
                              fontSize="8"
                              fontFamily="var(--font-mono)"
                              textAnchor="middle"
                              style={{ opacity: 0.8 }}
                            >
                              {sub.code.length > 5 ? sub.code.substring(0, 5) : sub.code}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', padding: '10px 0' }}>
                      <svg width="220" height="135" viewBox="0 0 200 115" style={{ overflow: 'visible' }}>
                        {/* Background arched track */}
                        <path 
                          d="M 28 100 A 72 72 0 0 1 172 100" 
                          stroke="rgba(255,255,255,0.03)" 
                          strokeWidth="14" 
                          strokeLinecap="round" 
                          fill="none" 
                        />
                        
                        {/* Segmented arched gauge layers */}
                        {arcSegments.map((seg) => (
                          <path
                            key={seg.code + '-donut'}
                            d={seg.path}
                            stroke={seg.color}
                            strokeWidth="14"
                            fill="none"
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.8s ease', opacity: 0.85 }}
                          />
                        ))}

                        {/* Centered label info inside the gauge */}
                        <text x="100" y="80" textAnchor="middle" fill={maxGroupText.color} fontSize="14" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="-0.02em">{maxGroupText.text}</text>
                        {overallTotal > 0 && (
                          <text x="100" y="98" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="500">
                            {overallAttended}/{overallTotal} Classes
                          </text>
                        )}
                      </svg>
                      
                      {/* legends mapping */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', justifyContent: 'center', width: '100%', padding: '0 4px' }}>
                        {subjects.map(s => (
                          <div key={s.code + '-legend'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR(s.percentage) }} />
                            <span className="t-badge" style={{ color: 'var(--text-secondary)' }}>{s.code}</span>
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({s.percentage.toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tooltip for Bar Chart */}
                  {chartType === 'bar' && hoveredBarIndex !== null && (
                    <div className="chart-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {subjects[hoveredBarIndex].name}
                      </span>
                      <br />
                      <span style={{ color: STATUS_COLOR(subjects[hoveredBarIndex].percentage) }}>
                        {subjects[hoveredBarIndex].percentage.toFixed(1)}%
                      </span>
                      <span style={{ opacity: 0.6, fontSize: 9 }}>
                        {` (${subjects[hoveredBarIndex].present}/${subjects[hoveredBarIndex].total} present)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Prediction Playground Accordion Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Calculator size={15} color="var(--accent-primary)" />
                <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>Prediction Playground</span>
                <button 
                  onClick={() => setActiveInfoBox(activeInfoBox === 'playground' ? null : 'playground')} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, marginLeft: 'auto' }}
                  aria-label="Info"
                >
                  <Info size={14} />
                </button>
              </div>

              {activeInfoBox === 'playground' && (
                <div className="t-mono-sm" style={{ padding: 10, background: 'var(--bg-base)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  <strong>Attendance Simulator:</strong> Simulate different attendance scenarios in real-time. Drag the sliders or edit values to see how your overall score reacts.
                </div>
              )}

              {/* Playground tabs switcher */}
              <div className="sandbox-tabs">
                <button className={`sandbox-tab ${activePlaygroundTab === 'boost' ? 'active' : ''}`} onClick={() => setActivePlaygroundTab('boost')}>
                  <TrendingUp size={11} /> Boost
                </button>
                <button className={`sandbox-tab ${activePlaygroundTab === 'bunk' ? 'active' : ''}`} onClick={() => setActivePlaygroundTab('bunk')}>
                  <TrendingDown size={11} /> Bunk
                </button>
                <button className={`sandbox-tab ${activePlaygroundTab === 'target' ? 'active' : ''}`} onClick={() => setActivePlaygroundTab('target')}>
                  <Target size={11} /> Target
                </button>
                <button className={`sandbox-tab ${activePlaygroundTab === 'od' ? 'active' : ''}`} onClick={() => setActivePlaygroundTab('od')}>
                  OD Check
                </button>
                <button className={`sandbox-tab ${activePlaygroundTab === 'mix' ? 'active' : ''}`} onClick={() => setActivePlaygroundTab('mix')}>
                  Mix Sandbox
                </button>
              </div>

              {/* Tab Panel contents */}
              <div style={{ marginTop: 18 }}>
                {activePlaygroundTab === 'boost' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Attend future classes:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setBoostVal(prev => Math.max(0, prev - 1))} aria-label="Decrease"><Minus size={12} /></button>
                        <span className="t-mono" style={{ color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{boostVal}</span>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setBoostVal(prev => prev + 1)} aria-label="Increase"><Plus size={12} /></button>
                      </div>
                    </div>
                    <input type="range" min="0" max="40" value={boostVal} onChange={e => setBoostVal(Number(e.target.value))} className="glass-slider" />
                    
                    <div style={{ padding: '12px 14px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Projected Overall:</span>
                      <span className="t-mono" style={{ color: '#3b82f6' }}>
                        {boostSimResult.percent.toFixed(2)}% <span style={{ fontSize: 10, fontWeight: 600 }}>({boostSimResult.delta >= 0 ? '+' : ''}{boostSimResult.delta.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                )}

                {activePlaygroundTab === 'bunk' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Bunk future classes:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setBunkVal(prev => Math.max(0, prev - 1))} aria-label="Decrease"><Minus size={12} /></button>
                        <span className="t-mono" style={{ color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{bunkVal}</span>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setBunkVal(prev => prev + 1)} aria-label="Increase"><Plus size={12} /></button>
                      </div>
                    </div>
                    <input type="range" min="0" max="30" value={bunkVal} onChange={e => setBunkVal(Number(e.target.value))} className="glass-slider" />

                    <div style={{ 
                      padding: '12px 14px', 
                      background: bunkSimResult.remainsSafe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', 
                      borderRadius: 'var(--radius-md)', 
                      border: bunkSimResult.remainsSafe ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Projected Overall:</span>
                      <span className="t-mono" style={{ color: bunkSimResult.remainsSafe ? '#10b981' : '#ef4444' }}>
                        {bunkSimResult.percent.toFixed(2)}% <span style={{ fontSize: 10, fontWeight: 600 }}>(-{bunkSimResult.delta.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                )}

                {activePlaygroundTab === 'target' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Target Percentage desired:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setTargetVal(prev => Math.max(50, prev - 1))} aria-label="Decrease"><Minus size={12} /></button>
                        <span className="t-mono" style={{ color: 'var(--text-primary)', minWidth: 32, textAlign: 'center' }}>{targetVal}%</span>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setTargetVal(prev => Math.min(99, prev + 1))} aria-label="Increase"><Plus size={12} /></button>
                      </div>
                    </div>
                    <input type="range" min="50" max="99" value={targetVal} onChange={e => setTargetVal(Number(e.target.value))} className="glass-slider" />

                    <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.15)', textAlign: 'center' }}>
                      <p className="t-label" style={{ color: 'var(--text-secondary)' }}>
                        {targetSimResult > 0 ? (
                          <>You need to attend next <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{targetSimResult}</strong> classes consecutively.</>
                        ) : (
                          <span style={{ color: '#10b981' }}>Target already met or below current percentage! 🎉</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {activePlaygroundTab === 'od' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Add On-Duty (OD) classes:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setOdVal(prev => Math.max(0, prev - 1))} aria-label="Decrease"><Minus size={12} /></button>
                        <span className="t-mono" style={{ color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{odVal}</span>
                        <button className="btn-secondary" style={{ padding: 4, borderRadius: 6 }} onClick={() => setOdVal(prev => prev + 1)} aria-label="Increase"><Plus size={12} /></button>
                      </div>
                    </div>
                    <input type="range" min="0" max="25" value={odVal} onChange={e => setOdVal(Number(e.target.value))} className="glass-slider" />

                    <div style={{ padding: '12px 14px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Projected Overall:</span>
                      <span className="t-mono" style={{ color: '#3b82f6' }}>
                        {odSimResult.percent.toFixed(2)}% <span style={{ fontSize: 10, fontWeight: 600 }}>({odSimResult.delta >= 0 ? '+' : ''}{odSimResult.delta.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                )}

                {activePlaygroundTab === 'mix' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Attend sliders */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="t-helper" style={{ color: 'var(--text-muted)' }}>Continuous Classes to Attend:</span>
                        <span className="t-mono" style={{ color: 'var(--text-primary)' }}>{mixAttendVal}</span>
                      </div>
                      <input type="range" min="0" max="30" value={mixAttendVal} onChange={e => setMixAttendVal(Number(e.target.value))} className="glass-slider" style={{ margin: '4px 0' }} />
                    </div>

                    {/* Bunk sliders */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="t-helper" style={{ color: 'var(--text-muted)' }}>Additional Classes to Bunk:</span>
                        <span className="t-mono" style={{ color: 'var(--text-primary)' }}>{mixBunkVal}</span>
                      </div>
                      <input type="range" min="0" max="20" value={mixBunkVal} onChange={e => setMixBunkVal(Number(e.target.value))} className="glass-slider" style={{ margin: '4px 0' }} />
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="t-label" style={{ color: 'var(--text-secondary)' }}>Projected Overall:</span>
                      <span className="t-mono" style={{ color: '#3b82f6' }}>
                        {mixSimResult.percent.toFixed(2)}% <span style={{ fontSize: 10, fontWeight: 600 }}>({mixSimResult.delta >= 0 ? '+' : ''}{mixSimResult.delta.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Smart 75% Prediction Date simulator */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Calendar size={15} color="var(--accent-primary)" />
                <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>75% Target Date Prediction</span>
                <button 
                  onClick={() => setActiveInfoBox(activeInfoBox === 'date' ? null : 'date')} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, marginLeft: 'auto' }}
                  aria-label="Info"
                >
                  <Info size={14} />
                </button>
              </div>

              {activeInfoBox === 'date' && (
                <div className="t-mono-sm" style={{ padding: 10, background: 'var(--bg-base)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  <strong>Date Simulator:</strong> Runs a chronological day-by-day calendar simulation. It automatically excludes Sundays, Rajasthan midterm holidays, public holidays, Autumn (Diwali) breaks, and Winter vacation slots. Initializes active class frequencies Mon-Sat directly from your section timetable.
                </div>
              )}

              <p className="t-helper" style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>Edit weekly frequencies (synced from Timetable DB):</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 14 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span className="t-badge" style={{ color: 'var(--text-muted)' }}>{day}</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="10"
                      value={scheduleOverrides[day] || 0}
                      onChange={e => {
                        const val = Math.max(0, Math.min(10, Number(e.target.value)));
                        setScheduleOverrides(prev => ({ ...prev, [day]: val }));
                      }}
                      className="input"
                      style={{ 
                        padding: '6px 0', 
                        textAlign: 'center', 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: 12, 
                        fontWeight: 700,
                        minHeight: 'fit-content'
                      }} 
                    />
                  </div>
                ))}
              </div>

              <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', gap: 6 }} onClick={runPredictionDateCalculation}>
                <Calendar size={14} /> Calculate Target Date
              </button>

              {predictedDate && (
                <div style={{ marginTop: 14, padding: 14, background: 'rgba(106, 17, 203, 0.05)', border: '1px solid rgba(106, 17, 203, 0.15)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p className="t-helper" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Predicted Date to hit 75%:</p>
                  <p className="t-body-medium" style={{ color: '#a78bfa' }}>{predictedDate}</p>
                  {predictedDaysCount !== null && predictedDaysCount > 0 && (
                    <p className="t-helper" style={{ color: 'var(--text-muted)', marginTop: 4 }}>({predictedDaysCount} days of college from now)</p>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Subject Breakdown Section (Moved to Backfoot) */}
            <div className="card" style={{ padding: '14px 16px', overflow: 'visible' }}>
              <button 
                onClick={() => setListExpanded(!listExpanded)}
                style={{ 
                  width: '100%', 
                  background: 'none', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  padding: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DonutRing percentage={safeOverall} size={24} />
                  <span className="t-subtitle">Subject Breakdown ({subjects.length})</span>
                </div>
                {listExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {listExpanded && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  
                  {/* Search, Sort and Filter Toolbar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--border-default)' }}>
                    <input 
                      type="text" 
                      placeholder="Search subject..." 
                      className="input" 
                      style={{ fontSize: 12, padding: '8px 12px', minHeight: 34 }}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className={`filter-pill ${filterType === 'all' ? 'active-info' : ''}`} onClick={() => setFilterType('all')}>All</button>
                      <button className={`filter-pill ${filterType === 'safe' ? 'active-safe' : ''}`} onClick={() => setFilterType('safe')}>Safe (≥75%)</button>
                      <button className={`filter-pill ${filterType === 'danger' ? 'active-danger' : ''}`} onClick={() => setFilterType('danger')}>Danger (&lt;75%)</button>
                      
                      <div style={{ width: 1, background: 'var(--border-default)', margin: '0 4px' }} />
                      
                      <button className={`filter-pill ${sortOrder === 'asc' ? 'active-warning' : ''}`} onClick={() => setSortOrder(sortOrder === 'asc' ? 'none' : 'asc')}>Low→High</button>
                      <button className={`filter-pill ${sortOrder === 'desc' ? 'active-warning' : ''}`} onClick={() => setSortOrder(sortOrder === 'desc' ? 'none' : 'desc')}>High→Low</button>
                    </div>
                  </div>

                  {processedSubjects.length > 0 ? (
                    processedSubjects.map(sub => <SubjectCard key={sub.code} sub={sub} />)
                  ) : (
                    <div className="t-label" style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>
                      No subjects found matching your filters.
                    </div>
                  )}
                </div>
              )}
            </div>

            {subjects.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <p className="t-body-medium" style={{ color: 'var(--text-secondary)' }}>No attendance data yet</p>
                <p className="t-caption" style={{ marginTop: 4 }}>Use "Update from ERP" to import your data</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ERP Paste Sheet */}
      <BottomSheet
        open={erpOpen}
        onClose={() => { setErpOpen(false); setParsed(null); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="t-card-title" style={{ color: 'var(--text-primary)' }}>Update from ERP</span>
            <a
              href="https://erp.skit.ac.in/reports/student_aggregate"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                minHeight: 'unset',
                height: '24px',
                fontSize: '11px',
                fontFamily: 'var(--font-body)',
                color: 'var(--accent-primary)',
                borderColor: 'var(--accent-primary-glow)',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              Go to ERP
            </a>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!parsed ? (
            <>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                Paste your ERP Attendance table below.
              </p>
              <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <p className="t-mono-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  How to copy:<br />
                  ERP → Student Info → Attendance Report<br />
                  → Select All → Copy → Paste here
                </p>
              </div>
              <textarea
                id="erp-textarea"
                className="input t-mono" style={{ minHeight: 160, resize: 'vertical' }}
                placeholder="Paste ERP attendance data here..."
                value={erpText}
                onChange={e => setErpText(e.target.value)}
              />
              <button id="parse-erp-btn" className="btn-primary" onClick={handleParse} disabled={!erpText.trim()}>
                Parse & Preview
              </button>
            </>
          ) : (
            <>
              <div style={{ padding: '12px', background: 'var(--status-safe-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52,201,123,0.25)' }}>
                <p className="t-body-medium" style={{ color: 'var(--status-safe)' }}>
                  ✓ Parsed {parsed.length} subjects successfully
                </p>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {parsed.map((s, idx) => (
                    <div key={s.code + idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                      {s.subjectId ? (
                        <button onClick={async () => {
                          const newName = prompt('Edit subject name', s.name);
                          if (!newName || newName.trim() === '' || newName === s.name) return;
                          try {
                            await updateSubjectMut.mutateAsync({ id: s.subjectId!, name: newName });
                            const copy = parsed.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, name: newName } : item
                            );
                            setParsed(copy);
                            showToast('Subject name updated', 'success');
                          } catch (err: unknown) {
                            console.error('Failed to update subject', err);
                            showToast(err instanceof Error ? err.message : 'Failed to update subject', 'error');
                          }
                        }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Edit subject name">
                          <Edit3 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="t-mono" style={{ color: STATUS_COLOR(s.percentage) }}>{s.percentage.toFixed(1)}%</span>
                      {s.subjectId ? <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Mapped</span> : <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>New</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button id="confirm-erp-btn" className="btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>Confirm & Update</button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setParsed(null)}>Re-paste</button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      <NavBar />
    </div>
  );
}
