import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader, Info, ChevronDown, CalendarCheck, Copy, AlertTriangle, Calendar, Layout, Table, Clock, MapPin, User } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import { BottomSheet } from '../../components/BottomSheet';
import { toast } from 'sonner';
import { useSchedule, useUpsertScheduleSlot, useDeleteScheduleSlot, useClearDaySlots, useCopyDaySlots } from '../../hooks/useSchedule';
import { useSubjects } from '../../hooks/useSubjects';
import { useAttendance } from '../../hooks/useAttendance';
import { useSection } from '../../hooks/useSectionMembers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { type SubjectCategory, getCategory, CATEGORY_COLORS, CATEGORY_LABELS, calculateEndTime, TYPE_DURATIONS, formatTime, formatTimeRange, getSubjectAcronym } from '../../lib/scheduleUtils';
import Skeleton from 'react-loading-skeleton';
import TeacherScheduleManager from './TeacherScheduleManager';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type ScheduleDay = typeof DAYS[number];
const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const PX_PER_HOUR = 80;
const MIN_CARD_HEIGHT = 40;
const SUBJECT_TYPES = ['Lecture', 'Lab', 'Tutorial'];

function mapUiTypeToDb(uiType: string): string {
  if (uiType === 'Lecture') return 'lecture';
  if (uiType === 'Lab') return 'lab';
  if (uiType === 'Tutorial') return 'tutorial';
  return 'lecture';
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
  color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 12,
};

const LECTURE_PRESETS = [
  { label: 'P1', start: '08:15', end: '09:15' },
  { label: 'P2', start: '09:15', end: '10:15' },
  { label: 'P3', start: '10:15', end: '11:15' },
  { label: 'P4', start: '12:00', end: '13:00' },
];
const LAB_PRESETS = [
  { label: 'Morning Lab', start: '08:15', end: '11:15' },
  { label: 'Afternoon Lab', start: '12:00', end: '15:00' },
];


interface AddSlotSheetProps {
  open: boolean;
  day: string;
  existingSlots: { subject: string; code: string; startTime: string; endTime: string; type: string }[];
  onClose: () => void;
}

function AddSlotSheet({ open, day, existingSlots, onClose }: AddSlotSheetProps) {
  const role = useAppStore(s => s.role);
  const globalSelectedSectionId = useAppStore(s => s.selectedSectionId);
  const authUser = useAppStore(s => s.authUser);
  const sectionId = role === 'teacher' ? (globalSelectedSectionId || authUser?.sectionId) : authUser?.sectionId;

  const { data: subjects = [] } = useSubjects({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const upsertSlot = useUpsertScheduleSlot();
  const { data: section } = useSection({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const sectionName = section?.name || '';
  const [subjectId, setSubjectId] = useState('');
  const [room, setRoom] = useState('');

  // Query section teachers
  const { data: sectionTeachers = [] } = useQuery({
    queryKey: ['section-teachers-list', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select('subject_id, users(name)')
        .eq('section_id', sectionId || '');
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId
  });

  const teacherNames = useMemo(() => {
    const names = sectionTeachers
      .map((st: any) => st.users?.name)
      .filter((name: string | null | undefined): name is string => typeof name === 'string' && name.trim().length > 0);
    return Array.from(new Set(names)).sort();
  }, [sectionTeachers]);

  // Fetch full schedule slots for historical auto-fill
  const { data: schedule = {} } = useSchedule({
    sectionId: sectionId || undefined
  });

  const historicalTeacherNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(schedule).forEach(daySlots => {
      daySlots.forEach(s => {
        if (s.teacher && s.teacher.trim().length > 0) {
          names.add(s.teacher.trim());
        }
      });
    });
    return Array.from(names).sort();
  }, [schedule]);

  const subjectToLastTeacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(schedule).forEach(daySlots => {
      daySlots.forEach(s => {
        if (s.subjectId && s.teacher && s.teacher.trim().length > 0) {
          map[s.subjectId] = s.teacher.trim();
        }
      });
    });
    return map;
  }, [schedule]);

  const historicalOnlyNames = useMemo(() => {
    const registeredSet = new Set(teacherNames);
    return historicalTeacherNames.filter(name => !registeredSet.has(name));
  }, [teacherNames, historicalTeacherNames]);


  const [selectedTeacherOption, setSelectedTeacherOption] = useState('');
  const [customTeacher, setCustomTeacher] = useState('');
  const [type, setType] = useState('Lecture');
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>('all');
  const [addedCount, setAddedCount] = useState(0);

  const [notifyClass, setNotifyClass] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticePriority, setNoticePriority] = useState<'general' | 'critical'>('general');

  // Smart defaults: start after last existing or added slot
  const lastEndTime = useMemo(() => {
    const allSlots = [...existingSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return allSlots.length > 0 ? allSlots[allSlots.length - 1].endTime : '08:15';
  }, [existingSlots]);

  const [startTime, setStartTime] = useState(lastEndTime);
  const [endTime, setEndTime] = useState(() => calculateEndTime(lastEndTime, 'Lecture'));

  // Auto-recalculate end time when type changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    setEndTime(calculateEndTime(startTime, newType));
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(calculateEndTime(newStart, type));
  };

  const parseBatchFromText = (text: string): 'all' | '1' | '2' => {
    const lower = text.toLowerCase();
    const m1 = /\b(batch\s*1|group\s*1|[a-z]1)\b/i.test(lower);
    const m2 = /\b(batch\s*2|group\s*2|[a-z]2)\b/i.test(lower);
    if (m1 && !m2) return '1';
    if (m2 && !m1) return '2';
    return 'all';
  };

  const handleSubjectChange = (val: string) => {
    setSubjectId(val);
    const sub = subjects.find(s => s.id === val);
    if (sub) {
      const parsed = parseBatchFromText(sub.name + ' ' + sub.code);
      if (parsed !== 'all') setTargetBatch(parsed);
    }

    // Auto-fill teacher
    const matchedSt = sectionTeachers.find((st: any) => st.subject_id === val);
    const registeredTeacherName = matchedSt?.users?.name;
    const historicalTeacherName = subjectToLastTeacherMap[val];
    const teacherToFill = registeredTeacherName || historicalTeacherName;

    if (teacherToFill) {
      const cleanName = teacherToFill.trim();
      const isRegistered = teacherNames.includes(cleanName);
      const isHistorical = historicalOnlyNames.includes(cleanName);

      if (isRegistered || isHistorical) {
        setSelectedTeacherOption(cleanName);
        setCustomTeacher('');
      } else {
        setSelectedTeacherOption('custom');
        setCustomTeacher(cleanName);
      }
    } else {
      setSelectedTeacherOption('');
      setCustomTeacher('');
    }
  };


  const handleRoomChange = (val: string) => {
    setRoom(val);
    const parsed = parseBatchFromText(val);
    if (parsed !== 'all') setTargetBatch(parsed);
  };

  const handleCustomTeacherChange = (val: string) => {
    setCustomTeacher(val);
    const parsed = parseBatchFromText(val);
    if (parsed !== 'all') setTargetBatch(parsed);
  };

  const handleTeacherSelectChange = (val: string) => {
    setSelectedTeacherOption(val);
    if (val !== 'custom') {
      setCustomTeacher('');
      const parsed = parseBatchFromText(val);
      if (parsed !== 'all') setTargetBatch(parsed);
    }
  };

  const startHour = useMemo(() => {
    if (!startTime) return 8;
    return Number(startTime.split(':')[0]);
  }, [startTime]);

  const isEarlyAM = startHour >= 0 && startHour < 8;

  const handleSave = async () => {
    if (!subjectId || !startTime || !endTime) {
      toast.error('Select a subject and set times');
      return;
    }

    const hasDropdownOptions = teacherNames.length > 0 || historicalOnlyNames.length > 0;
    const finalTeacher = hasDropdownOptions
      ? (selectedTeacherOption === 'custom' ? customTeacher : selectedTeacherOption)
      : customTeacher;


    try {
      const payload: any = {
        subjectId,
        dayOfWeek: DAY_MAP[day] ?? 1,
        startTime,
        endTime,
        room: room.trim() || undefined,
        type: mapUiTypeToDb(type),
        teacher: finalTeacher.trim() || undefined,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
        sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined,
      };

      if (notifyClass) {
        const sub = subjects.find(s => s.id === subjectId);
        const subName = sub?.name || 'Class';
        payload.publishNotice = true;
        payload.noticeTitle = noticeTitle.trim() || `📅 Schedule Update: ${subName}`;
        payload.noticeBody = noticeBody.trim() || `A new weekly class slot has been scheduled.`;
        payload.priority = noticePriority;
      }

      await upsertSlot.mutateAsync(payload);
      setAddedCount(c => c + 1);
      toast.success(`Slot added (${addedCount + 1})`);

      // Auto-advance: start time = this slot's end time
      const nextStart = endTime;
      setStartTime(nextStart);
      setEndTime(calculateEndTime(nextStart, type));
      // Room & teacher remembered, subject cleared for next pick, reset batch scoping
      setSubjectId('');
      setTargetBatch('all');
      setNotifyClass(false);
    } catch (err: any) { toast.error(`Failed to add slot: ${err.message || 'Unknown'}`); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Add Classes — ${DAY_FULL[day] ?? day}`}>
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
                  <span>{formatTimeRange(s.startTime, s.endTime)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</span>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <label htmlFor="slot-subject-select" style={labelStyle}>Subject *</label>
          <select id="slot-subject-select" style={inputStyle} value={subjectId} onChange={e => handleSubjectChange(e.target.value)}>
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
            <input id="slot-room-input" style={inputStyle} placeholder="Block B-102" value={room} onChange={e => handleRoomChange(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="slot-batch-select" style={labelStyle}>Target Batch</label>
          <select id="slot-batch-select" style={inputStyle} value={targetBatch} onChange={e => setTargetBatch(e.target.value as any)}>
            <option value="all">Full Section (All)</option>
            <option value="1">Batch {sectionName || 'B'}1</option>
            <option value="2">Batch {sectionName || 'B'}2</option>
          </select>
        </div>
        <div>
          <label htmlFor="slot-teacher-input" style={labelStyle}>Teacher (optional)</label>
          {teacherNames.length === 0 && historicalOnlyNames.length === 0 ? (
            <input
              id="slot-teacher-input"
              style={inputStyle}
              placeholder="Prof. Name"
              value={customTeacher}
              onChange={e => handleCustomTeacherChange(e.target.value)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                id="slot-teacher-select"
                style={inputStyle}
                value={selectedTeacherOption}
                onChange={e => handleTeacherSelectChange(e.target.value)}
              >
                <option value="">Select teacher…</option>
                {teacherNames.length > 0 && (
                  <optgroup label="Section Teachers (Registered)">
                    {teacherNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
                {historicalOnlyNames.length > 0 && (
                  <optgroup label="Previously Used Names">
                    {historicalOnlyNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
                <option value="custom">Other / Write custom name...</option>
              </select>
              {selectedTeacherOption === 'custom' && (
                <input
                  id="slot-teacher-custom-input"
                  style={inputStyle}
                  placeholder="Enter custom teacher name"
                  value={customTeacher}
                  onChange={e => handleCustomTeacherChange(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        {/* Timing Presets */}
        <div>
          <span style={labelStyle}>Standard Timings</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 12 }}>
            {(type.toLowerCase() === 'lab' ? LAB_PRESETS : LECTURE_PRESETS).map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setStartTime(p.start);
                  setEndTime(p.end);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  borderRadius: '9999px',
                  background: startTime === p.start && endTime === p.end ? '#ffffff' : '#27272a',
                  border: '1px solid transparent',
                  color: startTime === p.start && endTime === p.end ? '#18181b' : '#a1a1aa',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {p.start} - {p.end}
              </button>
            ))}
          </div>
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


        {/* Announcement Bridge Toggle */}
        <div style={{ padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notifyClass}
              onChange={e => {
                setNotifyClass(e.target.checked);
                if (e.target.checked && subjectId) {
                  const subName = subjects.find(s => s.id === subjectId)?.name || 'Class';
                  setNoticeTitle(`📅 Class Scheduled: ${subName}`);
                  setNoticeBody(`A new ${type} for ${subName} has been scheduled on ${DAY_FULL[day] || day} from ${startTime} to ${endTime} in Room ${room || 'TBD'}.`);
                }
              }}
              style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
            />
            <span className="t-mono-sm" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
              Notify Class & Post formal Notice
            </span>
          </label>
          
          {notifyClass && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 3 }}>Notice Title</label>
                <input type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 3 }}>Notice Content</label>
                <textarea value={noticeBody} onChange={e => setNoticeBody(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 3 }}>Priority</label>
                <select value={noticePriority} onChange={e => setNoticePriority(e.target.value as any)} style={inputStyle}>
                  <option value="general">General (Standard post)</option>
                  <option value="critical">Critical (Send Push notification instantly 🚨)</option>
                </select>
              </div>
            </div>
          )}
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
                fontSize: 12,
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

function CopyDaySheet({ open, targetDay, schedule, onClose }: {
  open: boolean;
  targetDay: string;
  schedule: Record<string, { id: string }[]>;
  onClose: () => void;
}) {
  const role = useAppStore(s => s.role);
  const globalSelectedSectionId = useAppStore(s => s.selectedSectionId);
  const [sourceDay, setSourceDay] = useState('');
  const copyMutation = useCopyDaySlots({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const sourceDays = DAYS.filter(d => d !== targetDay && (schedule[d]?.length ?? 0) > 0);
  const sourceCount = schedule[sourceDay]?.length ?? 0;
  const targetCount = schedule[targetDay]?.length ?? 0;

  const handleCopy = async () => {
    if (!sourceDay) return;
    try {
      await copyMutation.mutateAsync({ fromDay: DAY_MAP[sourceDay], toDay: DAY_MAP[targetDay] });
      toast.success(`Copied ${sourceCount} slots from ${DAY_FULL[sourceDay]} → ${DAY_FULL[targetDay]}`);
      onClose();
    } catch { toast.error('Failed to copy'); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Copy to ${DAY_FULL[targetDay]}`}>
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
  targetBatch?: string | null;
}

// ── Swipeable schedule card ──────────────────────────────────────────────────

function SwipeableCard({ cls, isNow, isPast, isCR, onDelete, style, sectionName, attendancePct }: {
  cls: SwipeableCardSlot;
  isNow: boolean;
  isPast: boolean;
  isCR: boolean;
  onDelete: (cls: SwipeableCardSlot) => void;
  style: React.CSSProperties;
  sectionName?: string;
  attendancePct?: number;
}) {
  const navigate = useNavigate();
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
          <Trash2 size={18} aria-hidden="true" />
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
          background: `linear-gradient(135deg, ${catStyle.bg} 0%, #121520 100%)`,
          borderColor: catStyle.border,
          touchAction: 'pan-y',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="schedule-card-accent" style={{ background: catStyle.color }} />
        <div 
          className="schedule-card-body" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            padding: '8px 10px 8px 12px', 
            flex: 1, 
            minWidth: 0, 
            boxSizing: 'border-box' 
          }}
        >
          {/* Top section */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Title & Batch */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cls.subject}
              </span>
              {cls.targetBatch && (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(96, 165, 250, 0.15)', color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>
                  {(sectionName || 'B') + cls.targetBatch}
                </span>
              )}
              {attendancePct !== undefined && (
                <button
                  className={`attendance-pill ${
                    attendancePct >= 85
                      ? 'attendance-pill-safe'
                      : attendancePct >= 75
                        ? 'attendance-pill-warning'
                        : 'attendance-pill-critical'
                  }`}
                  aria-label={`${cls.subject} attendance: ${attendancePct.toFixed(0)}%`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/app/attendance?subject=${encodeURIComponent(cls.code)}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/app/attendance?subject=${encodeURIComponent(cls.code)}`);
                    }
                  }}
                >
                  {attendancePct.toFixed(0)}%
                </button>
              )}
            </div>

            {/* Time & Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Clock size={10} style={{ opacity: 0.6 }} aria-hidden="true" />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTimeRange(cls.startTime, cls.endTime).replace(/\s/g, '\u00A0')}</span>
              <span>·</span>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: catStyle.color }}>{CATEGORY_LABELS[cat] || cls.type}</span>
            </div>
          </div>

          {/* Bottom metadata section with Divider */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: 6, marginTop: 4 }}>
            {/* Room */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={10} style={{ opacity: 0.6 }} aria-hidden="true" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cls.room || 'No Room'}</span>
            </div>

            {/* Instructor */}
            {cls.teacher && (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  minWidth: 0, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  maxWidth: '60%'
                }}
                title={cls.teacher}
              >
                <User size={10} style={{ opacity: 0.6 }} aria-hidden="true" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.teacher}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="schedule-timeline" style={{ position: 'relative', height: 350, marginTop: 8 }}>
        {[8, 9, 10, 11, 12, 13].map((h, i) => (
          <div key={h} className="schedule-hour-mark" style={{ top: i * 70, position: 'absolute', left: 0, right: 0 }}>
            <span className="schedule-hour-label" style={{ color: 'var(--text-muted)' }}>
              {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
            </span>
            <div className="schedule-hour-line" />
          </div>
        ))}
        <div style={{ position: 'absolute', top: 15, left: 52, right: 8, height: 90, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="65%" height={11} />
        </div>
        <div style={{ position: 'absolute', top: 135, left: 52, right: 8, height: 60, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 6 }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="50%" height={11} />
        </div>
        <div style={{ position: 'absolute', top: 215, left: 52, right: 8, height: 110, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', gap: 8 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="70%" height={11} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function StudentSchedulePage() {
  const navigate = useNavigate();
  const todayKey = currentDayKey();
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(
    isScheduleDay(todayKey) ? todayKey : 'Mon'
  );
  const [viewLayout, setViewLayout] = useState<'timeline' | 'week'>('timeline');
  const [selectedCellSlots, setSelectedCellSlots] = useState<SwipeableCardSlot[] | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showCopySheet, setShowCopySheet] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | ''>('');
  const [slideKey, setSlideKey] = useState(0);
  const [showJumpToNow, setShowJumpToNow] = useState(false);
  const [confirmClearDay, setConfirmClearDay] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<SwipeableCardSlot | null>(null);
  const [prevSlotToDelete, setPrevSlotToDelete] = useState<SwipeableCardSlot | null>(null);

  const [deleteNotifyClass, setDeleteNotifyClass] = useState(false);
  const [deleteNoticeTitle, setDeleteNoticeTitle] = useState('');
  const [deleteNoticeBody, setDeleteNoticeBody] = useState('');
  const [deleteNoticePriority, setDeleteNoticePriority] = useState<'general' | 'critical'>('general');

  useEffect(() => {
    if (slotToDelete) {
      setPrevSlotToDelete(slotToDelete);
      setDeleteNotifyClass(false);
      setDeleteNoticeTitle(`❌ Class Cancelled: ${slotToDelete.subject}`);
      setDeleteNoticeBody(`The class for ${slotToDelete.subject} scheduled for ${selectedDay} at ${formatTime(slotToDelete.startTime)} has been cancelled/removed from the schedule.`);
      setDeleteNoticePriority('general');
    }
  }, [slotToDelete, selectedDay]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  const role = useAppStore(s => s.role);
  const isCR = role === 'cr';
  const globalSelectedSectionId = useAppStore(s => s.selectedSectionId);

  const { data: schedule = {}, isLoading } = useSchedule({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const { data: section } = useSection({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const sectionName = section?.name || '';
  const deleteSlotMutation = useDeleteScheduleSlot();
  const clearDayMutation = useClearDaySlots({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });

  const authUser = useAppStore(s => s.authUser);
  const subBatch = authUser?.subBatch;
  const [viewMode, setViewMode] = useState<'my-batch' | 'full'>('my-batch');

  // Attendance data for badge overlay on schedule cards
  const { data: attendanceData } = useAttendance();
  const codeToPct = useMemo(() => {
    const map: Record<string, number> = {};
    if (attendanceData?.subjects) {
      for (const sub of attendanceData.subjects) {
        map[sub.code.toLowerCase().trim()] = sub.percentage;
      }
    }
    return map;
  }, [attendanceData]);

  const classes = useMemo(() => {
    const raw = (schedule[selectedDay] ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (viewMode === 'my-batch' && subBatch) {
      return raw.filter(cls => !cls.targetBatch || cls.targetBatch === subBatch);
    }
    return raw;
  }, [schedule, selectedDay, viewMode, subBatch]);

  // Group parallel items for Timeline overlapping layout
  const groupedClasses = useMemo(() => {
    const annotated: { slot: typeof classes[number]; colIndex: number; colCount: number }[] = [];
    const clusters: { slots: typeof classes[number][]; start: number; end: number }[] = [];
    
    classes.forEach(slot => {
      const start = toMinutes(slot.startTime);
      const end = toMinutes(slot.endTime);
      
      let merged = false;
      for (const cluster of clusters) {
        if (!(end <= cluster.start || start >= cluster.end)) {
          cluster.slots.push(slot);
          cluster.start = Math.min(cluster.start, start);
          cluster.end = Math.max(cluster.end, end);
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        clusters.push({ slots: [slot], start, end });
      }
    });

    clusters.forEach(cluster => {
      const count = cluster.slots.length;
      cluster.slots.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
      cluster.slots.forEach((slot, index) => {
        annotated.push({
          slot,
          colIndex: index,
          colCount: count
        });
      });
    });

    return annotated.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
  }, [classes]);

  // Weekly grid time range calculation
  const weeklyTimeRange = useMemo(() => {
    const allSlots: any[] = [];
    DAYS.forEach(d => {
      const raw = schedule[d] ?? [];
      let list = raw;
      if (viewMode === 'my-batch' && subBatch) {
        list = raw.filter(cls => !cls.targetBatch || cls.targetBatch === subBatch);
      }
      allSlots.push(...list);
    });
    if (allSlots.length === 0) return { startHour: 8, endHour: 17 };
    const firstMin = Math.min(...allSlots.map(c => toMinutes(c.startTime)));
    const lastMin = Math.max(...allSlots.map(c => toMinutes(c.endTime)));
    return {
      startHour: Math.max(0, Math.floor(firstMin / 60)),
      endHour: Math.min(23, Math.ceil(lastMin / 60)),
    };
  }, [schedule, viewMode, subBatch]);

  const weeklyHours = useMemo(() => {
    const hours: string[] = [];
    for (let h = weeklyTimeRange.startHour; h < weeklyTimeRange.endHour; h++) {
      hours.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return hours;
  }, [weeklyTimeRange]);

  // Calculate class counts per day for badges
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DAYS.forEach(d => {
      let list = schedule[d] ?? [];
      if (viewMode === 'my-batch' && subBatch) {
        list = list.filter(cls => !cls.targetBatch || cls.targetBatch === subBatch);
      }
      counts[d] = list.length;
    });
    return counts;
  }, [schedule, viewMode, subBatch]);

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
    if (viewLayout === 'week') return;
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
    if (viewLayout === 'week') return;
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
    if (viewLayout === 'week') return;
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
      toast.info(`Cleared all slots for ${DAY_FULL[selectedDay]}`);
      setConfirmClearDay(false);
    } catch { toast.error('Failed to clear day'); }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <Calendar size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Schedule</h1>
          </div>

          {/* Segmented Layout Switcher */}
          <div className="schedule-layout-switcher" style={{ marginRight: 6 }}>
            <button
              onClick={() => setViewLayout('timeline')}
              className={`layout-btn ${viewLayout === 'timeline' ? 'active' : ''}`}
              aria-label="Timeline view"
            >
              <Layout size={11} aria-hidden="true" />
              Timeline
            </button>
            <button
              onClick={() => setViewLayout('week')}
              className={`layout-btn ${viewLayout === 'week' ? 'active' : ''}`}
              aria-label="Week view"
            >
              <Table size={11} aria-hidden="true" />
              Week
            </button>
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
                style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                aria-label="Copy day"
              >
                <Copy size={12} /> Copy
              </button>
              {classes.length > 0 && (
                <button
                  onClick={() => setConfirmClearDay(true)}
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--status-critical)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  aria-label="Clear day"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sliding Backdrop Day Tabs Container */}
        <div className="schedule-day-tabs-container" style={{ marginBottom: 12 }} role="tablist" aria-label="Schedule days">
          <div 
            className="schedule-day-tab-sliding-pill"
            style={{
              left: `calc(${(DAYS.indexOf(selectedDay) * 16.66)}% + 4px)`,
            }}
          />
          {DAYS.map(day => {
            const isActive = day === selectedDay;
            const isDayToday = day === todayKey;
            const count = dayCounts[day] ?? 0;
            return (
              <button
                key={day}
                id={`day-tab-${day}`}
                className={`schedule-day-tab-btn${isActive ? ' active' : ''}`}
                onClick={() => handleDaySelect(day)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`schedule-panel-${day}`}
              >
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{day}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  {isDayToday && <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />}
                  {count > 0 && (
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </header>

      {/* Collapsible legend */}
      <div className={`legend-collapsible${showLegend ? ' open' : ''}`}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {(['lecture', 'lab', 'tutorial'] as SubjectCategory[]).map(c => (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 12px' }}>
          <p className="t-caption" style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {dateSubheading}
          </p>
          {subBatch && (
            <div style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              padding: 2,
            }}>
              <button
                onClick={() => setViewMode('my-batch')}
                style={{
                  padding: '4px 12px',
                  background: viewMode === 'my-batch' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'my-batch' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                My Batch ({subBatch === '1' ? `${sectionName || 'B'}1` : `${sectionName || 'B'}2`})
              </button>
              <button
                onClick={() => setViewMode('full')}
                style={{
                  padding: '4px 12px',
                  background: viewMode === 'full' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'full' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Full Section
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            transform: viewLayout === 'timeline' ? `translate3d(${dragX}px, 0, 0)` : 'none',
            transition: isTimelineDragging ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
          }}
        >
          {isLoading ? (
            <ScheduleSkeleton />
          ) : viewLayout === 'week' ? (
            <div className="week-grid-container" role="grid" aria-label="Weekly schedule grid">
              <div className="week-grid-header" role="row">
                <div role="columnheader" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.04)' }}>Time</div>
                {DAYS.map(day => (
                  <div 
                    key={day} 
                    role="columnheader" 
                    aria-sort={day === selectedDay ? 'ascending' : 'none'}
                    style={{ 
                      backgroundColor: day === selectedDay ? 'rgba(96, 165, 250, 0.05)' : 'transparent', 
                      color: day === selectedDay ? 'var(--accent-primary)' : 'inherit' 
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {weeklyHours.map(hourStr => (
                  <div 
                    key={hourStr} 
                    className="week-grid-row"
                    role="row"
                  >
                    <div className="week-grid-hour-col" role="gridcell">
                      {hourStr.replace(/\s/g, '\u00A0')}
                    </div>

                    {DAYS.map(day => {
                      const daySlots = (schedule[day] ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
                      
                      const filteredSlots = viewMode === 'my-batch' && subBatch
                        ? daySlots.filter(cls => !cls.targetBatch || cls.targetBatch === subBatch)
                        : daySlots;

                      const currentHourNum = Number(hourStr.split(':')[0]);
                      const cellSlots = filteredSlots.filter(s => {
                        const sh = Number(s.startTime.split(':')[0]);
                        const eh = Number(s.endTime.split(':')[0]);
                        return currentHourNum >= sh && currentHourNum < eh;
                      });

                      const isSelectedDay = day === selectedDay;

                      if (cellSlots.length > 0) {
                        const firstSlot = cellSlots[0];
                        const cat = getCategory(firstSlot.code, firstSlot.type);
                        const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.lecture;
                        const isStartHour = cellSlots.some(s => Number(s.startTime.split(':')[0]) === currentHourNum);

                        const labelText = cellSlots.map(s => `${s.subject} (${s.code}) in Room ${s.room || 'N/A'}`).join(', ');

                        return (
                          <div 
                            key={day}
                            onClick={() => {
                              handleDaySelect(day);
                              setSelectedCellSlots(cellSlots);
                            }}
                            className="week-grid-cell week-grid-cell-filled"
                            style={{ 
                              backgroundColor: `${catStyle.color}15`,
                              borderBottom: `1px solid ${catStyle.border}`,
                              outline: isSelectedDay ? '1.5px solid var(--accent-primary)' : 'none',
                              zIndex: isSelectedDay ? 2 : 1
                            }}
                            role="gridcell"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDaySelect(day);
                                setSelectedCellSlots(cellSlots);
                              }
                            }}
                            aria-label={`${day} at ${hourStr}: ${labelText}`}
                          >
                            <div className="week-grid-cell-accent-strip" style={{ backgroundColor: catStyle.color }} />
                            {isStartHour ? (
                              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxSizing: 'border-box', paddingLeft: 4 }}>
                                <span style={{ fontWeight: 700, color: '#fff', fontSize: 12, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getSubjectAcronym(firstSlot.subject)}{cellSlots.length > 1 ? `+${cellSlots.length - 1}` : ''}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                                  {cellSlots.map(s => s.room).filter(Boolean).join('/')}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.15)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: 12 }}>CONT.</div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={day} 
                          onClick={() => handleDaySelect(day)}
                          className="week-grid-cell"
                          style={{ 
                            backgroundColor: isSelectedDay ? 'rgba(96, 165, 250, 0.01)' : 'transparent',
                          }}
                          role="gridcell"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleDaySelect(day);
                            }
                          }}
                          aria-label={`${day} at ${hourStr}: Empty slot`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
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
                    <span className="schedule-gap-label">{formatDuration(gap.duration).replace(/\s/g, '\u00A0')}</span>
                  </div>
                );
              })}

              {/* Class cards */}
              {groupedClasses.map(({ slot: cls, colIndex, colCount }, i) => {
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
                      top: y + 2,
                      height: h - 2,
                      left: `calc(52px + (${colIndex} * (100% - 60px) / ${colCount}))`,
                      width: `calc(((100% - 60px) / ${colCount}) - 4px)`,
                      animationDelay: `${i * 40}ms`,
                    }}
                    sectionName={sectionName}
                    attendancePct={codeToPct[cls.code.toLowerCase().trim()]}
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
      <AddSlotSheet
        open={showAddSheet}
        day={selectedDay}
        existingSlots={classes.map(c => ({ subject: c.subject, code: c.code, startTime: c.startTime, endTime: c.endTime, type: c.type }))}
        onClose={() => setShowAddSheet(false)}
      />

      <CopyDaySheet
        open={showCopySheet}
        targetDay={selectedDay}
        schedule={schedule}
        onClose={() => setShowCopySheet(false)}
      />

      <BottomSheet open={!!selectedCellSlots} onClose={() => setSelectedCellSlots(null)} title="Class Inspector">
        {selectedCellSlots && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 20px' }} aria-live="polite">
            {selectedCellSlots.map((slot) => {
              const cat = getCategory(slot.code, slot.type);
              const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.lecture;
              return (
                <div 
                  key={slot.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 12, 
                    padding: 14, 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: `1px solid ${catStyle.border}`, 
                    borderRadius: 'var(--radius-lg)', 
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, backgroundColor: catStyle.color }} />
                  <div style={{ paddingLeft: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: catStyle.color, letterSpacing: '0.05em' }}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                      {slot.subject}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                      Code: {slot.code}
                    </p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 8 }}>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, border: '1px solid var(--border-default)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>TIME</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(slot.startTime).replace(/\s/g, '\u00A0')} – {formatTime(slot.endTime).replace(/\s/g, '\u00A0')}
                      </span>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, border: '1px solid var(--border-default)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>ROOM</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {slot.room || 'No Room'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 8 }}>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, border: '1px solid var(--border-default)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>INSTRUCTOR</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {slot.teacher || 'Not Assigned'}
                      </span>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, border: '1px solid var(--border-default)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>BATCH SCOPING</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {slot.targetBatch ? `Batch B${slot.targetBatch}` : 'Full Section'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setSelectedCellSlots(null)}
              className="t-button"
              style={{
                marginTop: 4,
                padding: '13px',
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: '#fff',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              Close
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(slotToDelete)} onClose={() => setSlotToDelete(null)} title="Remove Class from Timetable">
        {prevSlotToDelete && (
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
                  background: CATEGORY_COLORS[getCategory(prevSlotToDelete.code, prevSlotToDelete.type)].color,
                  borderRadius: 2
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-button" style={{ color: 'var(--text-primary)', margin: 0 }}>{prevSlotToDelete.subject}</p>
                  <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatTime(prevSlotToDelete.startTime)} – {formatTime(prevSlotToDelete.endTime)} · {prevSlotToDelete.room || 'No Room'}
                  </p>
                </div>
              </div>
            </div>

            {/* Announcement Bridge Toggle for Deletion */}
            <div style={{ padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', width: '100%', boxSizing: 'border-box' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteNotifyClass}
                  onChange={e => setDeleteNotifyClass(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
                />
                <span className="t-mono-sm" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                  Notify Class & Post formal Notice
                </span>
              </label>
              
              {deleteNotifyClass && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Notice Title</label>
                    <input type="text" value={deleteNoticeTitle} onChange={e => setDeleteNoticeTitle(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Notice Content</label>
                    <textarea value={deleteNoticeBody} onChange={e => setDeleteNoticeBody(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Priority</label>
                    <select value={deleteNoticePriority} onChange={e => setDeleteNoticePriority(e.target.value as any)} style={inputStyle}>
                      <option value="general">General (Standard post)</option>
                      <option value="critical">Critical (Send Push notification instantly 🚨)</option>
                    </select>
                  </div>
                </div>
              )}
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
                  if (prevSlotToDelete) {
                    try {
                      await deleteSlotMutation.mutateAsync(
                        deleteNotifyClass
                          ? {
                              id: prevSlotToDelete.id,
                              publishNotice: true,
                              noticeTitle: deleteNoticeTitle.trim() || `❌ Class Cancelled: ${prevSlotToDelete.subject}`,
                              noticeBody: deleteNoticeBody.trim() || `The class for ${prevSlotToDelete.subject} has been cancelled.`,
                              priority: deleteNoticePriority,
                            }
                          : prevSlotToDelete.id
                      );
                      toast.info('Class successfully removed');
                    } catch (err: any) {
                      toast.error(`Failed to remove class: ${err.message || 'Unknown'}`);
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
        )}
      </BottomSheet>

      <BottomSheet open={confirmClearDay} onClose={() => setConfirmClearDay(false)} title="Clear All Classes">
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

      <NavBar />
    </div>
  );
}

export default function SchedulePage() {
  const role = useAppStore(s => s.role);

  if (role === 'teacher') {
    return <TeacherScheduleManager />;
  }
  return <StudentSchedulePage />;
}

