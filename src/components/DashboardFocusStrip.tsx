import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Sparkles } from 'lucide-react';
import { useAssignments, useAttendance, usePolls, useSchedule } from '../hooks/useSupabaseQuery';
import { DonutRing, Skeleton, deadlineBadgeClass, deadlineLabel, timeUntil } from './Shared';
import { isExpired } from '../store/appStore';

function todayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' });
}

function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function sortByDueDate(a: { dueDate: string | null }, b: { dueDate: string | null }) {
  const left = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const right = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  return left - right;
}

function attendanceBadge(overall: number | null) {
  if (overall === null) return 'badge-info';
  if (overall < 65) return 'badge-critical';
  if (overall < 75) return 'badge-warning';
  return 'badge-safe';
}

function badgeLabel(badge: string) {
  if (badge === 'badge-critical') return 'Urgent';
  if (badge === 'badge-warning') return 'Soon';
  if (badge === 'badge-safe') return 'Good';
  return 'Info';
}

export default function DashboardFocusStrip() {
  const navigate = useNavigate();
  const { data: schedule, isLoading: scheduleLoading } = useSchedule();
  const { data: attendance, isLoading: attendanceLoading } = useAttendance();
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const { data: polls, isLoading: pollsLoading } = usePolls();

  const loading = scheduleLoading || attendanceLoading || assignmentsLoading || pollsLoading;

  const todayClasses = useMemo(() => schedule?.[todayKey()] ?? [], [schedule]);
  const nextClass = useMemo(() => {
    if (!todayClasses.length) return null;
    const now = new Date();
    const current = todayClasses.find(cls => {
      const start = parseTime(cls.startTime);
      const end = parseTime(cls.endTime);
      return start <= now && now <= end;
    });
    if (current) return { status: 'now', item: current };

    const upcoming = todayClasses
      .filter(cls => parseTime(cls.startTime) > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return upcoming.length ? { status: 'next', item: upcoming[0] } : null;
  }, [todayClasses]);

  const activePoll = useMemo(() => {
    return polls?.find(p => p.status === 'active' && !isExpired(p.closesAt)) ?? null;
  }, [polls]);

  const nextAssignment = useMemo(() => {
    return assignments
      ?.filter(a => a.status !== 'submitted')
      .sort(sortByDueDate)
      .find(a => !!a.dueDate) ?? null;
  }, [assignments]);

  const taskTile = useMemo(() => {
    if (activePoll) {
      return {
        title: 'Campus poll',
        detail: activePoll.question,
        badgeClass: 'badge-info',
        badgeText: 'Now',
        secondary: `Closes ${timeUntil(activePoll.closesAt)}`,
        action: () => navigate('/app/polls'),
        icon: <Sparkles size={18} />,
      };
    }

    if (nextAssignment) {
      const badgeClass = deadlineBadgeClass(nextAssignment.dueDate);
      return {
        title: 'Next assignment',
        detail: nextAssignment.title,
        badgeClass,
        badgeText: badgeLabel(badgeClass),
        secondary: deadlineLabel(nextAssignment.dueDate),
        action: () => navigate('/app/assignments'),
        icon: <Sparkles size={18} />,
      };
    }

    return {
      title: 'All clear',
      detail: 'No active deadlines or polls right now.',
      badgeClass: 'badge-safe',
      badgeText: 'Good',
      secondary: 'Check assignments for more details',
      action: () => navigate('/app/assignments'),
      icon: <Sparkles size={18} />,
    };
  }, [activePoll, nextAssignment, navigate]);

  const attendanceOverall = attendance?.overall ?? null;
  const attendanceTitle = attendanceOverall !== null ? `${Math.round(attendanceOverall)}% overall` : 'Update attendance';
  const attendanceMeta = attendance?.subjects?.length
    ? `${attendance.subjects.length} subjects tracked`
    : 'Tap to log attendance';
  const attendanceBadgeClass = attendanceBadge(attendanceOverall);

  const classTile = {
    title: nextClass?.status === 'now' ? 'In session now' : nextClass?.status === 'next' ? 'Next class' : 'Today’s schedule',
    detail: nextClass?.item ? nextClass.item.subject : 'No classes scheduled today',
    badgeClass: nextClass?.status === 'now' ? 'badge-safe' : nextClass?.status === 'next' ? 'badge-info' : 'badge-info',
    badgeText: nextClass?.status === 'now' ? 'Now' : nextClass?.status === 'next' ? 'Upcoming' : 'Free',
    secondary: nextClass?.item
      ? nextClass.status === 'now'
        ? `Ends ${nextClass.item.endTime}`
        : `${nextClass.item.startTime} · ${nextClass.item.room}`
      : 'Enjoy your free time',
    action: () => navigate('/app/schedule'),
    icon: <CalendarDays size={18} />,
  };

  if (loading) {
    return (
      <div className="dashboard-focus-strip">
        <div className="card dashboard-focus-card">
          <div className="focus-card-header">What’s next</div>
          <div className="focus-card-grid">
            {[1, 2, 3].map(key => (
              <div key={key} className="focus-segment">
                <Skeleton width="40%" height={12} />
                <Skeleton width="65%" height={24} style={{ marginTop: 10 }} />
                <Skeleton width="85%" height={14} style={{ marginTop: 12 }} />
                <div className="focus-card-footer">
                  <Skeleton width="35%" height={20} />
                  <Skeleton width="20%" height={20} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-focus-strip">
      <div className="card dashboard-focus-card">
        <div className="focus-card-header">What’s next</div>
        <div className="focus-card-grid">
          <button type="button" className="focus-segment" onClick={classTile.action}>
            <div className="focus-segment-top">
              <div>
                <span className="focus-segment-label">{classTile.title}</span>
                <div className="focus-segment-main">{classTile.detail}</div>
              </div>
              <span className={`badge ${classTile.badgeClass}`}>{classTile.badgeText}</span>
            </div>
            <div className="focus-segment-detail">{classTile.secondary}</div>
          </button>

          <button type="button" className="focus-segment" onClick={() => navigate('/app/attendance')}>
            <div className="focus-segment-top">
              <div>
                <span className="focus-segment-label">Attendance</span>
                <div className="focus-segment-main">{attendanceTitle}</div>
              </div>
              <span className={`badge ${attendanceBadgeClass}`}>{attendanceOverall !== null ? `${Math.round(attendanceOverall)}%` : 'Track'}</span>
            </div>
            <div className="focus-segment-detail">{attendanceMeta}</div>
            <div className="focus-segment-footer">
              <DonutRing percentage={attendanceOverall ?? 0} size={32} strokeWidth={4} />
              <span className="focus-segment-lead">Update attendance</span>
            </div>
          </button>

          <button type="button" className="focus-segment" onClick={taskTile.action}>
            <div className="focus-segment-top">
              <div>
                <span className="focus-segment-label">{taskTile.title}</span>
                <div className="focus-segment-main">{taskTile.detail}</div>
              </div>
              <span className={`badge ${taskTile.badgeClass}`}>{taskTile.badgeText}</span>
            </div>
            <div className="focus-segment-detail">{taskTile.secondary}</div>
            <div className="focus-segment-footer">
              <span className="focus-segment-icon">{taskTile.icon}</span>
              <span className="focus-segment-lead">View details</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
