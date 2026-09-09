import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, AlertTriangle, UserCheck } from 'lucide-react';
import { useSectionMembers, useSectionAttendance } from '../../../hooks/useSectionMembers';

export function SectionRosterCard({ onOpenAttendance }: { onOpenAttendance: () => void }) {
  const navigate = useNavigate();
  const { data: members = [] } = useSectionMembers();
  const { data: attendanceMap = {}, isLoading: isAttendanceLoading } = useSectionAttendance();

  const studentMembers = useMemo(() => members.filter(m => m.role !== 'teacher'), [members]);

  const membersWithAttendance = useMemo(() => {
    return studentMembers.map(m => {
      const att = attendanceMap[m.id];
      return {
        ...m,
        overallPercentage: att?.overallPercentage ?? null,
        totalHeld: att?.totalHeld ?? 0,
      };
    });
  }, [studentMembers, attendanceMap]);

  // Section Attendance Average
  const validPercent = membersWithAttendance.filter(m => m.overallPercentage !== null);
  const sectionAvg = validPercent.length > 0
    ? validPercent.reduce((sum, m) => sum + m.overallPercentage!, 0) / validPercent.length
    : null;

  // Critical at-risk (< 75%)
  const criticalCount = membersWithAttendance.filter(
    m => m.overallPercentage !== null && m.overallPercentage < 75
  ).length;

  // Demographics
  const dsCount = membersWithAttendance.filter(m => m.dayScholar === true).length;
  const hostelCount = membersWithAttendance.filter(m => m.dayScholar === false).length;
  const b1Count = membersWithAttendance.filter(m => m.subBatch === '1').length;
  const b2Count = membersWithAttendance.filter(m => m.subBatch === '2').length;
  const unassignedCount = membersWithAttendance.filter(m => !m.subBatch).length;
  const missingRollCount = membersWithAttendance.filter(m => !m.classRoll).length;

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Users size={16} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px', fontWeight: 700 }}>
              Section Roster
            </h3>
            <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>
              {studentMembers.length} enrolled students
            </p>
          </div>
        </div>

        <button
          id="manage-roster-top-btn"
          onClick={() => navigate('/app/members')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--accent-primary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <span>Manage</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Vitals Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}>
        <div>
          <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Class Average</p>
          <p className="t-title" style={{ color: 'var(--text-primary)', margin: '2px 0 0', fontWeight: 800 }}>
            {isAttendanceLoading ? '…' : sectionAvg !== null ? `${sectionAvg.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>Debarment Risk</p>
          <p className="t-title" style={{ color: criticalCount > 0 ? 'var(--status-critical)' : 'var(--status-safe)', margin: '2px 0 0', fontWeight: 800 }}>
            {isAttendanceLoading ? '…' : `${criticalCount} below 75%`}
          </p>
        </div>
      </div>

      {/* Demographics & Roster Health */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Practical Batches</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            G1: {b1Count} • G2: {b2Count}{unassignedCount > 0 ? ` (${unassignedCount} unassigned)` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Transit Breakdown</span>
          <span style={{ color: 'var(--text-primary)' }}>
            🚌 {dsCount} Day Scholars • 🏠 {hostelCount} Hostel
          </span>
        </div>
        {missingRollCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            padding: '6px 10px',
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#FBBF24',
            fontSize: '11.5px',
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            <span>{missingRollCount} {missingRollCount === 1 ? 'student is' : 'students are'} missing section roll number.</span>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        <button
          id="roster-take-attendance-btn"
          onClick={onOpenAttendance}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-primary-glow)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            color: 'var(--accent-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <UserCheck size={15} />
          <span>Take Attendance</span>
        </button>
        <button
          id="roster-full-dir-btn"
          onClick={() => navigate('/app/members')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Users size={15} />
          <span>Open Roster</span>
        </button>
      </div>
    </div>
  );
}
