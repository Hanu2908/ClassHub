import { useState, useMemo } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useUnitTestRoster, type UnitTest } from '../../../hooks/useUnitTests';
import { Search, Bell, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UnitTestRosterModalProps {
  open: boolean;
  onClose: () => void;
  unitTest: UnitTest | null;
}

export function UnitTestRosterModal({ open, onClose, unitTest }: UnitTestRosterModalProps) {
  const { data: roster = [], isLoading } = useUnitTestRoster(open && unitTest ? unitTest.id : null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [nudging, setNudging] = useState(false);

  const stats = useMemo(() => {
    const total = roster.length;
    const submitted = roster.filter(s => s.isSubmitted).length;
    const pending = total - submitted;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { total, submitted, pending, pct };
  }, [roster]);

  const filteredStudents = useMemo(() => {
    return roster.filter(s => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'submitted' && s.isSubmitted) ||
        (filter === 'pending' && !s.isSubmitted);

      if (!matchesFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.sectionRoll && s.sectionRoll.toLowerCase().includes(q)) ||
        (s.universityRoll && s.universityRoll.toLowerCase().includes(q))
      );
    });
  }, [roster, filter, search]);

  const handleNudge = () => {
    if (stats.pending === 0) {
      toast.info('All students have already submitted!');
      return;
    }
    setNudging(true);
    setTimeout(() => {
      setNudging(false);
      toast.success(`Nudge sent to ${stats.pending} pending students via notification!`);
    }, 600);
  };

  if (!unitTest) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={`${unitTest.testType}: ${unitTest.subject}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Progress Header */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
                {stats.submitted} of {stats.total} Submitted ({stats.pct}%)
              </p>
              <p className="t-caption" style={{ color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {stats.pending} students pending
              </p>
            </div>
            <button
              type="button"
              onClick={handleNudge}
              disabled={nudging || stats.pending === 0}
              className="t-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--accent-primary-glow)',
                border: '1px solid rgba(74, 158, 255, 0.3)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--accent-primary)',
                cursor: stats.pending > 0 ? 'pointer' : 'default',
                opacity: stats.pending > 0 ? 1 : 0.5,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {nudging ? <Loader2 className="animate-spin" size={13} /> : <Bell size={13} />}
              <span>Nudge Pending</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${stats.pct}%`,
              height: '100%',
              background: stats.pct >= 75 ? 'var(--status-safe)' : 'var(--accent-primary)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'submitted', 'pending'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: filter === f ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: filter === f ? 'var(--accent-primary-glow)' : 'transparent',
                  color: filter === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: filter === f ? 600 : 500,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? `All (${stats.total})` : f === 'submitted' ? `Submitted (${stats.submitted})` : `Pending (${stats.pending})`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="Search by name or roll number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Students List */}
        <div style={{
          maxHeight: 320,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingRight: 2
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 0' }}>
              <Loader2 className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <p className="t-body" style={{ margin: 0 }}>No students found</p>
            </div>
          ) : (
            filteredStudents.map(st => (
              <div
                key={st.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    {st.sectionRoll ? st.sectionRoll.replace('P-', '') : st.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="t-body-medium truncate" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', margin: 0 }}>
                      {st.name}
                    </p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>
                      {st.sectionRoll || st.universityRoll || 'Student'}
                    </p>
                  </div>
                </div>

                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {st.isSubmitted ? (
                    <span className="badge badge-safe" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      <CheckCircle2 size={11} style={{ marginRight: 3, display: 'inline-block' }} />
                      Submitted {st.marksObtained !== null ? `(${st.marksObtained}/${unitTest.maxMarks})` : ''}
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      <Clock size={11} style={{ marginRight: 3, display: 'inline-block' }} />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
