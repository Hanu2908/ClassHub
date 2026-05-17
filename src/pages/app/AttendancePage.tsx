import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, ShieldOff, Loader } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { DonutRing } from '../../components/Shared';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';
import type { AttendanceSubject } from '../../store/appStore';
import { useAttendance } from '../../hooks/useSupabaseQuery';

function parseERPAttendance(rawText: string) {
  // Handle both \r\n (Windows) and \n line endings
  const lines = rawText.trim().split(/\r?\n/);
  const subjects = [];
  const TYPES = new Set(['Lecture', 'Tutorial', 'Lab', 'Practical', 'Laboratory', 'Tut']);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ERP tables are copied as TSV (tab-separated) from the browser.
    // Split by tab first to preserve spaces inside subject codes/names.
    // Fall back to 2+ spaces for plain-text ERP exports.
    const cols = trimmed.includes('\t')
      ? trimmed.split('\t').map(c => c.trim()).filter(c => c.length > 0)
      : trimmed.split(/\s{2,}/).map(c => c.trim()).filter(c => c.length > 0);

    // Find the Subject Type column (Lecture / Tutorial / Lab / Practical …)
    const typeColIdx = cols.findIndex(c => TYPES.has(c));
    if (typeColIdx < 0) continue; // header row or unrecognised line

    // All columns after the type must be numeric
    const numericCols = cols.slice(typeColIdx + 1);
    if (numericCols.length < 2) continue;
    if (numericCols.some(c => isNaN(Number(c)))) continue;

    // Last numeric column = percentage; rest are attendance counts
    const pct = parseFloat(numericCols[numericCols.length - 1]);
    const counts = numericCols.slice(0, -1).map(Number);

    let attended: number, absent: number, total: number;
    if (counts.length >= 4) {
      // present  OD  makeup  absent  [optional extra]
      const [pres, od, makeup, ab] = counts;
      attended = pres + od + makeup;
      absent = ab;
      total = attended + absent;
    } else if (counts.length === 3) {
      // present  absent  total
      const [pres, ab, tot] = counts;
      attended = pres; absent = ab; total = tot;
    } else {
      // attended  total
      const [att, tot] = counts;
      attended = att; total = tot; absent = total - attended;
    }

    // Columns before type: [serial?,  code,  name]
    const beforeType = cols.slice(0, typeColIdx);
    // If first col is a bare serial number, skip it
    const startIdx = /^\d+$/.test(beforeType[0] ?? '') ? 1 : 0;
    if (beforeType.length <= startIdx) continue;

    const code = beforeType[startIdx];
    // Name is everything after the code up to (but not including) the type col
    const name = beforeType.slice(startIdx + 1).join(' ').trim() || code;
    const type = cols[typeColIdx];

    if (!code) continue;

    const canSkip = pct >= 75 ? Math.floor((attended - 0.75 * total) / 0.75) : 0;
    const needToAttend = pct < 75 ? Math.ceil((0.75 * total - attended) / 0.25) : 0;
    subjects.push({ code, name, type, present: attended, absent, total, percentage: pct, canSkip, needToAttend });
  }
  return subjects;
}

const STATUS_COLOR = (pct: number) => {
  const rounded = Math.round(pct);
  return rounded >= 85 ? 'var(--status-safe)' : rounded >= 75 ? 'var(--status-warning)' : 'var(--status-critical)';
};

const STATUS_BG = (pct: number) => {
  const rounded = Math.round(pct);
  return rounded >= 85 ? 'var(--status-safe-bg)' : rounded >= 75 ? 'var(--status-warning-bg)' : 'var(--status-critical-bg)';
};

function SubjectCard({ sub }: { sub: AttendanceSubject }) {
  const color = STATUS_COLOR(sub.percentage);
  const bg = STATUS_BG(sub.percentage);
  const pct = sub.percentage;

  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DonutRing percentage={pct} size={52}>
          <span style={{ font: '700 12px var(--font-mono)', color }}>
            {pct.toFixed(0)}%
          </span>
        </DonutRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <p className="truncate" style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', marginBottom: 2 }}>
              {sub.name}
            </p>
          </div>
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>
            {sub.code} · {sub.type} · {sub.present}/{sub.total} present
          </p>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '8px 12px', background: bg, borderRadius: 'var(--radius-sm)' }}>
        {pct >= 75 ? (
          sub.canSkip > 0 ? (
            <p style={{ font: '400 12px var(--font-body)', color, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={13} /> Can skip <strong>{sub.canSkip}</strong> more class{sub.canSkip > 1 ? 'es' : ''}
            </p>
          ) : (
            <p style={{ font: '400 12px var(--font-body)', color, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={13} /> At threshold — don't skip any more
            </p>
          )
        ) : (
          <p style={{ font: '400 12px var(--font-body)', color, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} /> Attend next <strong>{sub.needToAttend}</strong> consecutively to recover
          </p>
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const [erpOpen, setErpOpen] = useState(false);
  const [erpText, setErpText] = useState('');
  const [parsed, setParsed] = useState<AttendanceSubject[] | null>(null);
  const { data: attendance, isLoading } = useAttendance();

  const subjects = attendance?.subjects ?? [];
  const overall = attendance?.overall ?? 0;

  const handleParse = () => {
    const result = parseERPAttendance(erpText);
    if (result.length === 0) {
      showToast('Could not parse attendance. Check format.', 'error');
      return;
    }
    setParsed(result);
    showToast(`Parsed ${result.length} subjects. Review and confirm.`, 'info');
  };

  const handleConfirm = () => {
    // TODO: bulk upsert attendance_records via mutation
    if (parsed) {
      showToast('ERP import will be available after full backend integration', 'info');
      setParsed(null);
      setErpOpen(false);
      setErpText('');
    }
  };

  const safeOverall = isNaN(overall) ? 0 : overall;
  const overallColor = STATUS_COLOR(safeOverall);

  return (
    <div className="page-shell">
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
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Attendance</h1>
        </div>
        <button id="update-erp-btn" onClick={() => setErpOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', font: '500 12px var(--font-body)', color: 'var(--accent-primary)', cursor: 'pointer' }}>
          <RefreshCw size={13} /> Update from ERP
        </button>
      </header>

      <main className="page-content">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader size={24} color="var(--accent-primary)" className="spin" />
          </div>
        ) : (
          <>
            {/* Overall donut */}
            <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <DonutRing percentage={safeOverall} size={100} strokeWidth={8}>
                  <span style={{ font: '700 24px var(--font-mono)', color: overallColor }}>
                    {safeOverall.toFixed(1)}%
                  </span>
                </DonutRing>
              </div>
              <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {safeOverall >= 85
                  ? <><CheckCircle2 size={14} color="var(--status-safe)" /> Safe — great attendance!</>
                  : safeOverall >= 75
                  ? <><AlertTriangle size={14} color="var(--status-warning)" /> Caution — stay regular</>
                  : <><ShieldOff size={14} color="var(--status-critical)" /> Danger — attend all classes</>
                }
              </p>
              <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 8 }}>
                {subjects.filter(s => s.percentage < 75).length} subject{subjects.filter(s => s.percentage < 75).length !== 1 ? 's' : ''} below 75%
              </p>
            </div>

            {subjects.length > 0 && (
              <>
                <p style={{ font: '600 12px var(--font-body)', color: 'var(--text-muted)', paddingLeft: 4 }}>BY SUBJECT</p>
                {subjects.map(sub => <SubjectCard key={sub.code} sub={sub} />)}
              </>
            )}

            {subjects.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <p style={{ font: '500 14px var(--font-body)', color: 'var(--text-secondary)' }}>No attendance data yet</p>
                <p style={{ font: '400 12px var(--font-body)', marginTop: 4 }}>Use "Update from ERP" to import your data</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ERP Paste Sheet */}
      <BottomSheet open={erpOpen} onClose={() => { setErpOpen(false); setParsed(null); }} title="Update from ERP">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!parsed ? (
            <>
              <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>
                Paste your ERP Attendance table below.
              </p>
              <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  How to copy:<br />
                  ERP → Student Info → Attendance Report<br />
                  → Select All → Copy → Paste here
                </p>
              </div>
              <textarea
                id="erp-textarea"
                className="input"
                style={{ minHeight: 160, resize: 'vertical', font: '400 12px var(--font-mono)' }}
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
                <p style={{ font: '500 13px var(--font-body)', color: 'var(--status-safe)' }}>
                  ✓ Parsed {parsed.length} subjects successfully
                </p>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parsed.map(s => (
                  <div key={s.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)' }}>{s.name}</span>
                    <span style={{ font: '600 12px var(--font-mono)', color: STATUS_COLOR(s.percentage) }}>{s.percentage.toFixed(1)}%</span>
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
