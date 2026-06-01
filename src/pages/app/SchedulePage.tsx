import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader, Info, ChevronDown, CalendarCheck, Copy, AlertTriangle, Calendar } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';
import { useSchedule, useUpsertScheduleSlot, useDeleteScheduleSlot, useClearDaySlots, useCopyDaySlots } from '../../hooks/useSchedule';
import { useSubjects } from '../../hooks/useSubjects';
import { type SubjectCategory, getCategory, CATEGORY_COLORS, CATEGORY_LABELS, calculateEndTime, TYPE_DURATIONS } from '../../lib/scheduleUtils';
import { ScheduleSkeleton } from '../../components/LoadingSkeletons';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type ScheduleDay = typeof DAYS[number];
const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const PX_PER_HOUR = 80;
const MIN_CARD_HEIGHT = 40;
const SUBJECT_TYPES = ['Tech Lecture', 'Lab', 'Non-Tech Lecture', 'Other'];

function mapUiTypeToDb(uiType: string): string {
  if (uiType === 'Tech Lecture') return 'lecture';
  if (uiType === 'Non-Tech Lecture') return 'tutorial';
  if (uiType === 'Lab') return 'lab';
  return 'other';
}

function currentDayKey(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' });
}

function isScheduleDay(day: string): day is ScheduleDay {
  return DAYS.some((d) => d === day);
}

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m break`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m break` : `${h}h break`;
}

// ── Add slot bottom sheet (Quick-add batch mode) ──────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
  outline: 'none', fontSize: 13,
};
const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 11,
};

interface AddSlotSheetProps {
  day: string;
  existingSlots: { subject: string; code: string; startTime: string; endTime: string; type: string }[];
  onClose: () => void;
}

function AddSlotSheet({ day, existingSlots, onClose }: AddSlotSheetProps) {
  const { data: subjects = [] } = useSubjects();
  const upsertSlot = useUpsertScheduleSlot();
  const [subjectId, setSubjectId] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [type, setType] = useState('Tech Lecture');
  const [addedCount, setAddedCount] = useState(0);

  // Smart defaults: start after last existing or added slot
  const lastEndTime = useMemo(() => {
    const allSlots = [...existingSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return allSlots.length > 0 ? allSlots[allSlots.length - 1].endTime : '08:15';
  }, [existingSlots]);

  const [startTime, setStartTime] = useState(lastEndTime);
  const [endTime, setEndTime] = useState(() => calculateEndTime(lastEndTime, 'Tech Lecture'));

  // Auto-recalculate end time when type changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    setEndTime(calculateEndTime(startTime, newType));
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(calculateEndTime(newStart, type));
  };

  const startHour = useMemo(() => {
    if (!startTime) return 8;
    return Number(startTime.split(':')[0]);
  }, [startTime]);

  const isEarlyAM = startHour >= 0 && startHour < 8;

  const handleSave = async () => {
    if (!subjectId || !startTime || !endTime) {
      showToast('Select a subject and set times', 'error');
      return;
    }
    try {
      await upsertSlot.mutateAsync({
        subjectId,
        dayOfWeek: DAY_MAP[day] ?? 1,
        startTime,
        endTime,
        room: room.trim() || undefined,
        type: mapUiTypeToDb(type),
        teacher: teacher.trim() || undefined,
      });
      setAddedCount(c => c + 1);
      showToast(`Slot added (${addedCount + 1})`, 'success');

      // Auto-advance: start time = this slot's end time
      const nextStart = endTime;
      setStartTime(nextStart);
      setEndTime(calculateEndTime(nextStart, type));
      // Room & teacher remembered, subject cleared for next pick
      setSubjectId('');
    } catch (err: any) { showToast(`Failed to add slot: ${err.message || 'Unknown'}`, 'error'); }
  };

  return (
    <BottomSheet onClose={onClose} title={`Add Classes — ${DAY_FULL[day] ?? day}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
        {/* Mini timeline preview */}
        {existingSlots.length > 0 && (
          <div className="mini-timeline">
            <span style={{ ...labelStyle, marginBottom: 2 }}>
              {existingSlots.length + addedCount} slot{existingSlots.length + addedCount !== 1 ? 's' : ''} on {DAY_FULL[day]}
            </span>
            {existingSlots.slice(-3).map((s, i) => {
              const cat = getCategory(s.code, s.type);
              return (
                <div key={i} className="mini-timeline-slot">
                  <div className="slot-accent" style={{ background: CATEGORY_COLORS[cat].color }} />
                  <span>{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</span>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <label htmlFor="slot-subject-select" style={labelStyle}>Subject *</label>
          <select id="slot-subject-select" style={inputStyle} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">Select subject…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="slot-type-select" style={labelStyle}>Type</label>
            <select id="slot-type-select" style={inputStyle} value={type} onChange={e => handleTypeChange(e.target.value)}>
              {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="slot-room-input" style={labelStyle}>Room</label>
            <input id="slot-room-input" style={inputStyle} placeholder="Block B-102" value={room} onChange={e => setRoom(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="slot-teacher-input" style={labelStyle}>Teacher (optional)</label>
          <input id="slot-teacher-input" style={inputStyle} placeholder="Prof. Name" value={teacher} onChange={e => setTeacher(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="slot-start-input" style={labelStyle}>Start *</label>
            <input id="slot-start-input" style={inputStyle} type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} />
          </div>
          <div>
            <label htmlFor="slot-end-input" style={labelStyle}>End * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({TYPE_DURATIONS[type] ?? 60}m)</span></label>
            <input id="slot-end-input" style={inputStyle} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        {isEarlyAM && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
            background: 'rgba(251, 191, 36, 0.06)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: 'var(--radius-md)',
            boxSizing: 'border-box',
          }}>
            <span className="t-caption" style={{ color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Scheduled at {formatTime(startTime)} (AM). Did you mean PM?
            </span>
            <button
              onClick={() => {
                const [h, m] = startTime.split(':');
                const newHour = (Number(h) + 12) % 24;
                const newTime = `${newHour.toString().padStart(2, '0')}:${m}`;
                handleStartTimeChange(newTime);
              }}
              className="t-button"
              style={{
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--status-warning)',
                padding: '4px 8px',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
            >
              Switch to PM
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            id="save-slot-btn"
            onClick={handleSave}
            disabled={upsertSlot.isPending}
            className="t-button"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px', background: upsertSlot.isPending ? 'var(--bg-elevated)' : 'var(--accent-primary)', border: 'none',
              borderRadius: 'var(--radius-md)', cursor: upsertSlot.isPending ? 'not-allowed' : 'pointer',
              color: upsertSlot.isPending ? 'var(--text-muted)' : '#fff',
            }}
          >
            {upsertSlot.isPending ? <Loader size={14} className="spin" /> : <Plus size={16} />}
            {upsertSlot.isPending ? 'Saving…' : 'Add & Next'}
          </button>
          <button
            onClick={onClose}
            className="t-button"
            style={{
              padding: '13px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Copy Day sheet ───────────────────────────────────────────────────────────

function CopyDaySheet({ targetDay, schedule, onClose }: {
  targetDay: string;
  schedule: Record<string, { id: string }[]>;
  onClose: () => void;
}) {
  const [sourceDay, setSourceDay] = useState('');
  const copyMutation = useCopyDaySlots();
  const sourceDays = DAYS.filter(d => d !== targetDay && (schedule[d]?.length ?? 0) > 0);
  const sourceCount = schedule[sourceDay]?.length ?? 0;
  const targetCount = schedule[targetDay]?.length ?? 0;

  const handleCopy = async () => {
    if (!sourceDay) return;
    try {
      await copyMutation.mutateAsync({ fromDay: DAY_MAP[sourceDay], toDay: DAY_MAP[targetDay] });
      showToast(`Copied ${sourceCount} slots from ${DAY_FULL[sourceDay]} → ${DAY_FULL[targetDay]}`, 'success');
      onClose();
    } catch { showToast('Failed to copy', 'error'); }
  };

  return (
    <BottomSheet onClose={onClose} title={`Copy to ${DAY_FULL[targetDay]}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
        <div>
          <label htmlFor="copy-source-select" style={labelStyle}>Copy from</label>
          <select id="copy-source-select" style={inputStyle} value={sourceDay} onChange={e => setSourceDay(e.target.value)}>
            <option value="">Select source day…</option>
            {sourceDays.map(d => (
              <option key={d} value={d}>{DAY_FULL[d]} ({schedule[d]?.length ?? 0} classes)</option>
            ))}
          </select>
        </div>
        {sourceDay && targetCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: 'var(--status-warning-bg)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 'var(--radius-md)' }}>
            <AlertTriangle size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
              This will replace {targetCount} existing class{targetCount !== 1 ? 'es' : ''} on {DAY_FULL[targetDay]} with {sourceCount} class{sourceCount !== 1 ? 'es' : ''} from {DAY_FULL[sourceDay]}.
            </span>
          </div>
        )}
        <button
          onClick={handleCopy}
          disabled={!sourceDay || copyMutation.isPending}
          className="t-button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: !sourceDay ? 'var(--bg-elevated)' : 'var(--accent-primary)', border: 'none',
            borderRadius: 'var(--radius-md)', cursor: !sourceDay ? 'not-allowed' : 'pointer',
            color: !sourceDay ? 'var(--text-muted)' : '#fff',
          }}
        >
          {copyMutation.isPending ? <Loader size={14} className="spin" /> : <Copy size={16} />}
          {copyMutation.isPending ? 'Copying…' : 'Copy & Replace'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Legend chip ───────────────────────────────────────────────────────────────

function LegendChip({ cat }: { cat: SubjectCategory }) {
  const { color } = CATEGORY_COLORS[cat];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
        {CATEGORY_LABELS[cat]}
      </span>
    </div>
  );
}

interface SwipeableCardSlot {
  id: string;
  subject: string;
  code: string;
  room: string;
  teacher: string;
  type: string;
  startTime: string;
  endTime: string;
}

// ── Swipeable schedule card ──────────────────────────────────────────────────

function SwipeableCard({ cls, isNow, isPast, isCR, onDelete, style }: {
  cls: SwipeableCardSlot;
  isNow: boolean;
  isPast: boolean;
  isCR: boolean;
  onDelete: (cls: SwipeableCardSlot) => void;
  style: React.CSSProperties;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const isSnappedRef = useRef(false);

  const cat = getCategory(cls.code, cls.type);
  const catStyle = CATEGORY_COLORS[cat];

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isCR) return;
    setIsSwiping(true);
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSwiping || !isCR) return;
    const diffX = e.clientX - startXRef.current;
    let targetX = isSnappedRef.current ? -80 + diffX : diffX;

    // Premium elastic rubber-band cap
    if (targetX > 0) {
      targetX = targetX * 0.15; // resist swiping right
    } else if (targetX < -80) {
      targetX = -80 + (targetX + 80) * 0.3; // resist past -80px
    }

    setSwipeX(targetX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isSwiping) return;
    setIsSwiping(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (swipeX < -70) {
      // Swipe deep to delete
      onDelete(cls);
      setSwipeX(0);
      isSnappedRef.current = false;
    } else if (swipeX < -40) {
      // Snap open to reveal trash button
      setSwipeX(-80);
      isSnappedRef.current = true;
    } else {
      // Snap shut
      setSwipeX(0);
      isSnappedRef.current = false;
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!isSwiping) return;
    setIsSwiping(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setSwipeX(0);
    isSnappedRef.current = false;
  };

  return (
    <div style={{ ...style, position: 'absolute', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
      {/* Delete zone behind */}
      {isCR && (
        <div 
          className="swipe-delete-zone" 
          onClick={() => onDelete(cls)}
          style={{
            opacity: swipeX < 0 ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        >
          <Trash2 size={18} />
        </div>
      )}
      <div
        className={`schedule-card ${isPast ? 'is-past' : ''} ${isNow ? 'is-now' : ''}`}
        style={{
          position: 'relative',
          left: 0, right: 0, top: 0, bottom: 0,
          height: '100%',
          transform: `translate3d(${swipeX}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
          background: catStyle.bg,
          borderColor: catStyle.border,
          touchAction: 'pan-y',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="schedule-card-accent" style={{ background: catStyle.color }} />
        <div className="schedule-card-body">
          <div className="schedule-subject">{cls.subject}</div>
          <div className="schedule-meta">
            {formatTime(cls.startTime)} – {formatTime(cls.endTime)} · {cls.code}{cls.room ? ` · ${cls.room}` : ''}{cls.teacher ? ` · ${cls.teacher}` : ''}
          </div>
          <div className="schedule-type">{CATEGORY_LABELS[cat] || cls.type}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const navigate = useNavigate();
  const todayKey = currentDayKey();
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(
    isScheduleDay(todayKey) ? todayKey : 'Mon'
  );
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showCopySheet, setShowCopySheet] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | ''>('');
  const [slideKey, setSlideKey] = useState(0);
  const [showJumpToNow, setShowJumpToNow] = useState(false);
  const [confirmClearDay, setConfirmClearDay] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<SwipeableCardSlot | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  const role = useAppStore(s => s.role);
  const isCR = role === 'cr';
  const { data: schedule = {}, isLoading } = useSchedule();
  const deleteSlotMutation = useDeleteScheduleSlot();
  const clearDayMutation = useClearDaySlots();

  const classes = useMemo(() =>
    (schedule[selectedDay] ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, selectedDay]
  );

  // Calculate class counts per day for badges
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DAYS.forEach(d => { counts[d] = schedule[d]?.length ?? 0; });
    return counts;
  }, [schedule]);

  // Proportional timeline calculations
  const timeRange = useMemo(() => {
    if (classes.length === 0) return { startHour: 8, endHour: 17 };
    const firstMin = toMinutes(classes[0].startTime);
    const lastMin = Math.max(...classes.map(c => toMinutes(c.endTime)));
    return {
      startHour: Math.floor(firstMin / 60),
      endHour: Math.ceil(lastMin / 60),
    };
  }, [classes]);

  const totalHours = timeRange.endHour - timeRange.startHour;
  const timelineHeight = Math.max(totalHours * PX_PER_HOUR, 200);

  // Hour marks
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let h = timeRange.startHour; h <= timeRange.endHour; h++) marks.push(h);
    return marks;
  }, [timeRange]);

  // Gap detection (>30 min)
  const gaps = useMemo(() => {
    const result: { startMin: number; endMin: number; duration: number }[] = [];
    for (let i = 0; i < classes.length - 1; i++) {
      const endCurrent = toMinutes(classes[i].endTime);
      const startNext = toMinutes(classes[i + 1].startTime);
      const gap = startNext - endCurrent;
      if (gap > 30) result.push({ startMin: endCurrent, endMin: startNext, duration: gap });
    }
    return result;
  }, [classes]);

  // Now line position
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000); // 1-minute ticking interval
    return () => clearInterval(timer);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = selectedDay === todayKey;
  const nowLineY = isToday ? ((nowMinutes / 60) - timeRange.startHour) * PX_PER_HOUR : -1;
  const showNowLine = isToday && nowLineY >= 0 && nowLineY <= timelineHeight;

  // Auto-scroll to now
  useEffect(() => {
    if (isToday && nowLineRef.current && timelineRef.current) {
      const container = timelineRef.current.closest('.page-content');
      if (container) {
        const rect = nowLineRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = rect.top - containerRect.top - containerRect.height / 2;
        container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
      }
    }
  }, [isToday, selectedDay]);

  // Jump to now visibility
  useEffect(() => {
    if (!isToday) {
      const timer = setTimeout(() => setShowJumpToNow(false), 0);
      return () => clearTimeout(timer);
    }
    const container = timelineRef.current?.closest('.page-content');
    if (!container) return;

    const handleScroll = () => {
      if (!nowLineRef.current) return;
      const rect = nowLineRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
      setShowJumpToNow(!isVisible);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isToday, selectedDay]);

  const jumpToNow = useCallback(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Day switching with real-time horizontal timeline slider
  const [dragX, setDragX] = useState(0);
  const [isTimelineDragging, setIsTimelineDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, isSwipe: false, isLocked: false });

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.schedule-card') || target.closest('.swipe-delete-zone') || target.closest('.t-button') || target.closest('button')) {
      return;
    }
    
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      isSwipe: false,
      isLocked: false
    };
    setIsTimelineDragging(true);
    setDragX(0);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTimelineDragging) return;
    
    const ref = dragStartRef.current;
    const diffX = e.clientX - ref.x;
    const diffY = e.clientY - ref.y;
    
    if (!ref.isLocked) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          ref.isSwipe = true;
        }
        ref.isLocked = true;
      }
    }
    
    if (ref.isSwipe) {
      if (e.cancelable) e.preventDefault();
      
      const idx = DAYS.indexOf(selectedDay);
      let targetX = diffX;
      
      // Rubber banding boundaries
      if (idx === 0 && diffX > 0) {
        targetX = diffX * 0.35;
      } else if (idx === DAYS.length - 1 && diffX < 0) {
        targetX = diffX * 0.35;
      }
      
      setDragX(targetX);
    }
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTimelineDragging) return;
    setIsTimelineDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const ref = dragStartRef.current;
    if (ref.isSwipe) {
      const idx = DAYS.indexOf(selectedDay);
      const threshold = 80;
      
      if (dragX < -threshold && idx < DAYS.length - 1) {
        // Switch to next day
        setSlideDir('');
        setSelectedDay(DAYS[idx + 1]);
        setDragX(150);
        setTimeout(() => {
          setDragX(0);
        }, 30);
      } else if (dragX > threshold && idx > 0) {
        // Switch to previous day
        setSlideDir('');
        setSelectedDay(DAYS[idx - 1]);
        setDragX(-150);
        setTimeout(() => {
          setDragX(0);
        }, 30);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }
  };

  const handleTimelinePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTimelineDragging) return;
    setIsTimelineDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragX(0);
  };

  const handleDaySelect = (day: ScheduleDay) => {
    const curIdx = DAYS.indexOf(selectedDay);
    const newIdx = DAYS.indexOf(day);
    setSlideDir(newIdx > curIdx ? 'right' : 'left');
    setSlideKey(k => k + 1);
    setSelectedDay(day);
  };

  const handleClearDay = async () => {
    try {
      await clearDayMutation.mutateAsync(DAY_MAP[selectedDay]);
      showToast(`Cleared all slots for ${DAY_FULL[selectedDay]}`, 'info');
      setConfirmClearDay(false);
    } catch { showToast('Failed to clear day', 'error'); }
  };

  // Date subheading
  const dateSubheading = isToday
    ? `Today — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : DAY_FULL[selectedDay] ?? selectedDay;

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13, 15, 20, 0.45)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 -1px 0 rgba(255, 255, 255, 0.06)',
        padding: '16px 20px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button id="schedule-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <Calendar size={18} color="var(--accent-primary)" />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Schedule</h1>
          </div>

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: showLegend ? 'var(--accent-primary)' : 'var(--text-muted)', padding: 4, display: 'flex' }}
            aria-label="Toggle legend"
          >
            <Info size={18} />
          </button>

          {/* CR actions */}
          {isCR && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setShowCopySheet(true)}
                style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                aria-label="Copy day"
              >
                <Copy size={12} /> Copy
              </button>
              {classes.length > 0 && (
                <button
                  onClick={() => setConfirmClearDay(true)}
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--status-critical)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  aria-label="Clear day"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Day tabs with class count badges */}
        <div className="day-tabs" style={{ paddingBottom: 12 }} role="tablist" aria-label="Schedule days">
          {DAYS.map(day => {
            const isActive = day === selectedDay;
            const isDayToday = day === todayKey;
            const count = dayCounts[day] ?? 0;
            return (
              <button
                key={day}
                id={`day-tab-${day}`}
                className={`day-tab${isActive ? ' active' : ''}${isDayToday ? ' today' : ''}`}
                onClick={() => handleDaySelect(day)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`schedule-panel-${day}`}
              >
                <span>{day}</span>
                {count > 0 && <span className="day-badge">{count}</span>}
                <div className="day-dot" style={{ background: isDayToday ? 'currentColor' : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </header>

      {/* Collapsible legend */}
      <div className={`legend-collapsible${showLegend ? ' open' : ''}`}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {(['technical', 'lab', 'non-technical', 'other'] as SubjectCategory[]).map(c => (
            <LegendChip key={c} cat={c} />
          ))}
        </div>
      </div>

      <main 
        className="page-content"
        role="tabpanel"
        id={`schedule-panel-${selectedDay}`}
        aria-labelledby={`day-tab-${selectedDay}`}
        onPointerDown={handleTimelinePointerDown}
        onPointerMove={handleTimelinePointerMove}
        onPointerUp={handleTimelinePointerUp}
        onPointerCancel={handleTimelinePointerCancel}
        style={{
          touchAction: 'pan-y'
        }}
      >
        <p className="t-caption" style={{ color: 'var(--text-secondary)', padding: '8px 0 4px' }}>
          {dateSubheading}
        </p>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            transform: `translate3d(${dragX}px, 0, 0)`,
            transition: isTimelineDragging ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
          }}
        >
          {isLoading ? (
            <ScheduleSkeleton />
          ) : classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div className="schedule-empty-icon">
                <CalendarCheck size={28} color="var(--status-safe)" />
              </div>
              <p className="t-card-title" style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>No classes{isToday ? ' today' : ''}!</p>
              <p className="t-body">{isToday ? 'Enjoy your free day.' : `${DAY_FULL[selectedDay]} is free.`}</p>
            </div>
          ) : (
            <div
              ref={timelineRef}
              className={`schedule-timeline ${slideDir === 'right' ? 'schedule-slide-right' : slideDir === 'left' ? 'schedule-slide-left' : ''}`}
              key={slideKey}
              style={{ height: timelineHeight + 16, marginTop: 8 }}
            >
              {/* Hour marks */}
              {hourMarks.map(h => {
                const y = (h - timeRange.startHour) * PX_PER_HOUR;
                return (
                  <div key={h} className="schedule-hour-mark" style={{ top: y }}>
                    <span className="schedule-hour-label">
                      {h % 12 || 12}{h < 12 ? 'a' : 'p'}
                    </span>
                    <div className="schedule-hour-line" />
                  </div>
                );
              })}

              {/* Gap indicators */}
              {gaps.map((gap, i) => {
                const y = ((gap.startMin / 60) - timeRange.startHour) * PX_PER_HOUR;
                const h = (gap.duration / 60) * PX_PER_HOUR;
                return (
                  <div key={`gap-${i}`} className="schedule-gap" style={{ top: y, height: h }}>
                    <span className="schedule-gap-label">{formatDuration(gap.duration)}</span>
                  </div>
                );
              })}

              {/* Class cards */}
              {classes.map((cls, i) => {
                const startMin = toMinutes(cls.startTime);
                const endMin = toMinutes(cls.endTime);
                const durationMin = endMin - startMin;
                const y = ((startMin / 60) - timeRange.startHour) * PX_PER_HOUR;
                const h = Math.max((durationMin / 60) * PX_PER_HOUR - 2, MIN_CARD_HEIGHT); // -2 for gap between cards
                const isNowClass = isToday && startMin <= nowMinutes && nowMinutes <= endMin;
                const isPastClass = isToday && endMin < nowMinutes;

                return (
                  <SwipeableCard
                    key={cls.id}
                    cls={cls}
                    isNow={isNowClass}
                    isPast={isPastClass}
                    isCR={isCR}
                    onDelete={setSlotToDelete}
                    style={{
                      top: y,
                      height: h,
                      left: 52,
                      right: 8,
                      animationDelay: `${i * 40}ms`,
                    }}
                  />
                );
              })}

              {/* Now line */}
              {showNowLine && (
                <div ref={nowLineRef} className="schedule-now-line" style={{ top: nowLineY }} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Jump to now pill */}
      {showJumpToNow && isToday && (
        <button className="jump-to-now" onClick={jumpToNow}>
          <ChevronDown size={14} /> Jump to now
        </button>
      )}

      {/* CR: add slot FAB */}
      <CROnly>
        <button
          id="add-schedule-fab"
          className="fab"
          aria-label="Add schedule slot"
          onClick={() => setShowAddSheet(true)}
        >
          <Plus size={22} />
        </button>
      </CROnly>

      {/* Bottom sheets */}
      {showAddSheet && (
        <AddSlotSheet
          day={selectedDay}
          existingSlots={classes.map(c => ({ subject: c.subject, code: c.code, startTime: c.startTime, endTime: c.endTime, type: c.type }))}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {showCopySheet && (
        <CopyDaySheet
          targetDay={selectedDay}
          schedule={schedule}
          onClose={() => setShowCopySheet(false)}
        />
      )}

      {slotToDelete && (
        <BottomSheet onClose={() => setSlotToDelete(null)} title="Remove Class from Timetable">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 20px' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 16,
              background: 'var(--status-critical-bg)',
              border: '1px solid rgba(248, 113, 113, 0.2)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="var(--status-critical)" />
                <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Confirm Deletion</span>
              </div>
              
              <p className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to remove this class from the schedule?
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                marginTop: 4
              }}>
                <div style={{
                  width: 4,
                  alignSelf: 'stretch',
                  background: CATEGORY_COLORS[getCategory(slotToDelete.code, slotToDelete.type)].color,
                  borderRadius: 2
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-button" style={{ color: 'var(--text-primary)', margin: 0 }}>{slotToDelete.subject}</p>
                  <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatTime(slotToDelete.startTime)} – {formatTime(slotToDelete.endTime)} · {slotToDelete.room || 'No Room'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setSlotToDelete(null)}
                className="t-button"
                style={{
                  flex: 1,
                  padding: 13,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (slotToDelete) {
                    try {
                      await deleteSlotMutation.mutateAsync(slotToDelete.id);
                      showToast('Class successfully removed', 'info');
                    } catch (err: any) {
                      showToast(`Failed to remove class: ${err.message || 'Unknown'}`, 'error');
                    }
                    setSlotToDelete(null);
                  }
                }}
                disabled={deleteSlotMutation.isPending}
                className="t-button"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 13,
                  background: 'var(--status-critical)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s',
                }}
              >
                {deleteSlotMutation.isPending ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                {deleteSlotMutation.isPending ? 'Removing…' : 'Delete Class'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Clear day confirmation */}
      {confirmClearDay && (
        <BottomSheet onClose={() => setConfirmClearDay(false)} title="Clear All Classes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14, background: 'var(--status-critical-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={18} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span className="t-body" style={{ color: 'var(--text-secondary)' }}>
                This will permanently remove all {classes.length} class{classes.length !== 1 ? 'es' : ''} from {DAY_FULL[selectedDay]}. This cannot be undone.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmClearDay(false)}
                className="t-button"
                style={{ flex: 1, padding: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearDay}
                disabled={clearDayMutation.isPending}
                className="t-button"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: 'var(--status-critical)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#fff' }}
              >
                {clearDayMutation.isPending ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                {clearDayMutation.isPending ? 'Clearing…' : 'Clear All'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      <NavBar />
    </div>
  );
}
