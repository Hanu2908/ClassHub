import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { useSchedule, useUpsertScheduleSlot, useDeleteScheduleSlot } from '../../hooks/useSchedule';
import { useSubjects } from '../../hooks/useSubjects';
import { useCreateAnnouncement } from '../../hooks/useAnnouncements';
import {
  Calendar, Clock, MapPin, User,
  Plus, Edit3, Trash2, X, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { BottomSheet } from '../../components/BottomSheet';
import { getCategory, CATEGORY_COLORS } from '../../lib/scheduleUtils';

// Types from database schema
interface SectionTeacherRow {
  section_id: string;
  sections: {
    name: string;
    invite_code: string;
    teacher_invite_code: string | null;
  } | null;
  subject_id: string | null;
  subjects: {
    id: string;
    name: string;
    code: string;
  } | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
  outline: 'none', fontSize: 13,
};
const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 12,
};

export default function TeacherScheduleManager() {
  const authUser = useAppStore(s => s.authUser);
  const role = useAppStore(s => s.role);
  const navigate = useNavigate();

  // Selected Section & Subject from Store
  const selectedSectionId = useAppStore(s => s.selectedSectionId) || '';
  const setSelectedSectionId = useAppStore(s => s.setSelectedSectionId)!;

  // 1. Fetch teacher section-subject mappings
  const { data: mappings = [] } = useQuery<SectionTeacherRow[]>({
    queryKey: ['teacher-mappings', authUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          section_id,
          sections:section_id (name, invite_code, teacher_invite_code),
          subject_id,
          subjects:subject_id (id, name, code)
        `)
        .eq('teacher_id', authUser?.id || '');
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!authUser?.id,
  });

  // Unique sections
  const teacherSectionId = authUser?.sectionId;
  const sections = useMemo(() => {
    const distinct: Record<string, { id: string; name: string }> = {};
    mappings.forEach(m => {
      if (m.section_id && m.sections) {
        distinct[m.section_id] = { id: m.section_id, name: m.sections.name };
      }
    });
    const list = Object.values(distinct);
    if (list.length === 0 && teacherSectionId) {
      list.push({ id: teacherSectionId, name: 'My Section' });
    }
    return list;
  }, [mappings, teacherSectionId]);

  // Set default section
  useState(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].id);
    }
  });

  // Timetable slots
  const { data: schedule = {} } = useSchedule({
    sectionId: selectedSectionId || undefined
  });

  // Subjects in section
  const { data: subjects = [] } = useSubjects({
    sectionId: selectedSectionId || undefined
  });

  // Teacher's subject IDs in the selected section
  const teacherSubjectIds = useMemo(() => {
    const set = new Set<string>();
    mappings
      .filter(m => m.section_id === selectedSectionId && m.subject_id)
      .forEach(m => set.add(m.subject_id as string));
    
    if (set.size === 0 && role !== 'teacher') {
      subjects.forEach((s: any) => set.add(s.id));
    }
    return set;
  }, [mappings, selectedSectionId, subjects, role]);

  const [activeDay, setActiveDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'>('Mon');
  const [filterMySubjects, setFilterMySubjects] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  
  // Sheet states for slot edits
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [showEditOptionSheet, setShowEditOptionSheet] = useState(false);
  const [showTemplateEditSheet, setShowTemplateEditSheet] = useState(false);
  const [showCancelTodaySheet, setShowCancelTodaySheet] = useState(false);
  const [showMakeupSheet, setShowMakeupSheet] = useState(false);

  // Queries/Mutations
  const upsertMutation = useUpsertScheduleSlot();
  const deleteMutation = useDeleteScheduleSlot();
  const createAnnMutation = useCreateAnnouncement();

  // Local dialog fields
  const [subjectId, setSubjectId] = useState('');
  const [room, setRoom] = useState('');
  const [teacherName, setTeacherName] = useState(authUser?.name || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState('lecture');
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>('all');
  
  // Announcement fields
  const [notifyClass, setNotifyClass] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticePriority, setNoticePriority] = useState<'general' | 'critical'>('general');
  const [cancellationReason, setCancellationReason] = useState('');

  // Makeup fields
  const [makeupDate, setMakeupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [makeupStart, setMakeupStart] = useState('10:00');
  const [makeupEnd, setMakeupEnd] = useState('11:00');
  const [makeupRoom, setMakeupRoom] = useState('');

  const daySlots = schedule[activeDay];
  const sortedSlots = useMemo(() => {
    const slots = daySlots ?? [];
    return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [daySlots]);

  const filteredSlots = filterMySubjects
    ? sortedSlots.filter(s => s.subjectId && teacherSubjectIds.has(s.subjectId))
    : sortedSlots;

  // Auto-end time calculation
  const handleTypeChange = (newType: string) => {
    setType(newType);
    const duration = newType === 'lab' ? 120 : 60;
    const [h, m] = startTime.split(':').map(Number);
    const endM = (m + duration) % 60;
    const endH = h + Math.floor((m + duration) / 60);
    setEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`);
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const duration = type === 'lab' ? 120 : 60;
    const [h, m] = newStart.split(':').map(Number);
    const endM = (m + duration) % 60;
    const endH = h + Math.floor((m + duration) / 60);
    setEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`);
  };

  // Add a slot to the weekly timetable
  const handleAddSlot = async () => {
    if (!subjectId) {
      toast.error('Select a subject');
      return;
    }
    const sub = subjects.find(s => s.id === subjectId);
    const subName = sub?.name || '';
    
    try {
      const payload: any = {
        subjectId,
        dayOfWeek: DAY_MAP[activeDay],
        startTime,
        endTime,
        room: room.trim() || undefined,
        type,
        teacher: teacherName.trim() || undefined,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
        sectionId: selectedSectionId,
      };

      if (notifyClass) {
        payload.publishNotice = true;
        payload.noticeTitle = noticeTitle.trim() || `📅 Schedule Update: ${subName}`;
        payload.noticeBody = noticeBody.trim() || `A new weekly class has been added to the timetable.`;
        payload.priority = noticePriority;
      }

      await upsertMutation.mutateAsync(payload);
      toast.success('Slot added successfully! ✓');
      setShowAddSheet(false);
      setSubjectId('');
      setRoom('');
      setNotifyClass(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add slot');
    }
  };

  // Pre-fill fields for editing weekly template
  const openWeeklyEdit = (slot: any) => {
    setSelectedSlot(slot);
    setSubjectId(slot.subjectId || '');
    setRoom(slot.room || '');
    setTeacherName(slot.teacher || '');
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setType(slot.type || 'lecture');
    setTargetBatch(slot.targetBatch || 'all');
    setShowEditOptionSheet(false);
    setShowTemplateEditSheet(true);
  };

  const handleUpdateWeeklySlot = async () => {
    if (!subjectId || !selectedSlot) return;
    try {
      await upsertMutation.mutateAsync({
        id: selectedSlot.id,
        subjectId,
        dayOfWeek: DAY_MAP[activeDay],
        startTime,
        endTime,
        room: room.trim() || undefined,
        type,
        teacher: teacherName.trim() || undefined,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
        sectionId: selectedSectionId
      });
      toast.success('Weekly template slot updated successfully ✓');
      setShowTemplateEditSheet(false);
      setSelectedSlot(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update slot');
    }
  };

  // Cancel Class Today (one-time override announcement)
  const openCancelToday = (slot: any) => {
    setSelectedSlot(slot);
    setCancellationReason('');
    setNoticeTitle(`❌ Notice: ${slot.subject} Class Cancelled`);
    setNoticeBody(`The ${slot.subject} (${slot.type || 'Lecture'}) class scheduled for today (${DAY_FULL[activeDay]}) has been cancelled.\n\nReason: `);
    setNoticePriority('general');
    setShowEditOptionSheet(false);
    setShowCancelTodaySheet(true);
  };

  const handlePublishCancellation = async () => {
    if (!selectedSlot) return;
    try {
      const finalBody = noticeBody + (cancellationReason.trim() || 'Not specified.');
      await deleteMutation.mutateAsync({
        id: selectedSlot.id,
        publishNotice: true,
        noticeTitle,
        noticeBody: finalBody,
        sectionId: selectedSectionId,
        priority: noticePriority
      });
      toast.success('Cancellation notice published to class ❌');
      setShowCancelTodaySheet(false);
      setSelectedSlot(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel occurrence');
    }
  };

  // Schedule Makeup / Reschedule (one-time override announcement)
  const openMakeupClass = (slot: any) => {
    setSelectedSlot(slot);
    setMakeupDate(new Date().toISOString().split('T')[0]);
    setMakeupStart(slot.startTime);
    setMakeupEnd(slot.endTime);
    setMakeupRoom(slot.room || '');
    setNoticeTitle(`📅 Makeup Class: ${slot.subject}`);
    setNoticePriority('general');
    setShowEditOptionSheet(false);
    setShowMakeupSheet(true);
  };

  const handlePublishMakeup = async () => {
    if (!selectedSlot) return;
    
    try {
      const formattedDate = new Date(makeupDate).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      const bodyContent = `A makeup/extra class has been scheduled for ${selectedSlot.subject} (${selectedSlot.code}):\n\n` +
        `🗓️ Date: ${formattedDate}\n` +
        `⏰ Time: ${makeupStart} - ${makeupEnd}\n` +
        `📍 Room: ${makeupRoom || 'TBD'}\n\n` +
        `Attendance will be registered accordingly. Please make sure to attend.`;

      await createAnnMutation.mutateAsync({
        title: noticeTitle,
        message: bodyContent,
        priority: noticePriority,
        targetBatch: selectedSlot.targetBatch || null,
      });

      toast.success('One-time makeup class announced successfully! 📅');
      setShowMakeupSheet(false);
      setSelectedSlot(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule makeup');
    }
  };

  // Delete Template Slot permanently
  const handleDeleteWeeklySlot = async () => {
    if (!selectedSlot) return;
    if (confirm(`Remove this slot permanently from the weekly repeating timetable?`)) {
      try {
        await deleteMutation.mutateAsync(selectedSlot.id);
        toast.info('Weekly slot deleted ✓');
        setShowEditOptionSheet(false);
        setSelectedSlot(null);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete slot');
      }
    }
  };

  return (
    <div className="page-shell" style={{ minHeight: '100dvh', paddingBottom: '90px' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13, 15, 20, 0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/app/teacher-dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--accent-primary)" />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)', fontSize: 17 }}>Schedule Manager</h1>
          </div>
        </div>

        {/* Section Selector */}
        <select
          value={selectedSectionId}
          onChange={e => setSelectedSectionId(e.target.value)}
          className="input"
          style={{ width: 'auto', minHeight: '32px', padding: '4px 8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
        >
          {sections.map(s => (
            <option key={s.id} value={s.id}>Section {s.name}</option>
          ))}
          {sections.length === 0 && <option value="">No Sections Linked</option>}
        </select>
      </header>

      {/* Content */}
      <main className="page-content" style={{ padding: '16px 20px' }}>
        {/* Filter / Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterMySubjects}
              onChange={e => setFilterMySubjects(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
            />
            <span className="t-mono-sm" style={{ color: 'var(--text-primary)', fontSize: 13 }}>
              Show only my subjects
            </span>
          </label>

          <button
            onClick={() => {
              setSubjectId('');
              setRoom('');
              setNotifyClass(false);
              setStartTime('09:00');
              setEndTime('10:00');
              setType('lecture');
              setTargetBatch('all');
              setShowAddSheet(true);
            }}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12 }}
          >
            <Plus size={14} /> Add Slot
          </button>
        </div>

        {/* Days Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`filter-tab${activeDay === d ? ' active' : ''}`}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12, textAlign: 'center' }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Slots List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSlots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: 12 }}>
              No slots scheduled for {DAY_FULL[activeDay]}.
            </div>
          ) : (
            filteredSlots.map(slot => {
              const isMine = slot.subjectId && teacherSubjectIds.has(slot.subjectId);
              const cat = getCategory(slot.code, slot.type);
              const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS.lecture;

              return (
                <div
                  key={slot.id}
                  className="card"
                  style={{
                    display: 'flex', borderLeft: `4px solid ${style.color}`,
                    justifyContent: 'space-between', alignItems: 'center', padding: 14,
                    background: isMine ? 'rgba(74, 158, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                    opacity: filterMySubjects ? 1 : (isMine ? 1 : 0.7)
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {slot.subject}
                      </span>
                      {slot.targetBatch && (
                        <span className="t-mono-sm" style={{
                          padding: '1px 5px', fontSize: 12, background: 'rgba(96, 165, 250, 0.15)',
                          color: 'var(--accent-primary)', borderRadius: 4, fontWeight: 700
                        }}>
                          Batch {slot.targetBatch}
                        </span>
                      )}
                      {isMine && (
                        <span style={{
                          padding: '1px 5px', fontSize: 12, background: 'rgba(52, 211, 153, 0.15)',
                          color: 'var(--status-safe)', borderRadius: 4, fontWeight: 700
                        }}>
                          My Subject
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>{slot.startTime} - {slot.endTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} />
                        <span>{slot.room || 'No Room'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} />
                        <span>{slot.teacher || 'Not Assigned'}</span>
                      </div>
                    </div>
                  </div>

                  {isMine && (
                    <button
                      onClick={() => { setSelectedSlot(slot); setShowEditOptionSheet(true); }}
                      className="btn-secondary"
                      style={{ padding: 8, borderColor: 'var(--border-default)' }}
                      title="Manage Class"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Add Trigger Button */}
      <button
        onClick={() => {
          setSubjectId('');
          setRoom('');
          setNotifyClass(false);
          setStartTime('09:00');
          setEndTime('10:00');
          setType('lecture');
          setTargetBatch('all');
          setShowAddSheet(true);
        }}
        style={{
          position: 'fixed', bottom: '20px', right: '20px',
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-primary)', color: '#fff',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 1000
        }}
        title="Add Period"
      >
        <Plus size={24} />
      </button>

      {/* 1. Add Slot Sheet */}
      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title={`Add Slot — ${DAY_FULL[activeDay]}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
          <div>
            <label style={labelStyle}>Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={inputStyle}>
              <option value="">Select subject...</option>
              {subjects.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start Time</label>
              <input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Room</label>
              <input type="text" placeholder="e.g. 302" value={room} onChange={e => setRoom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Class Type</label>
              <select value={type} onChange={e => handleTypeChange(e.target.value)} style={inputStyle}>
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="tutorial">Tutorial</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Target Batch</label>
              <select value={targetBatch} onChange={e => setTargetBatch(e.target.value as any)} style={inputStyle}>
                <option value="all">Full Section</option>
                <option value="1">Batch 1</option>
                <option value="2">Batch 2</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Teacher Name</label>
              <input type="text" placeholder="Your Name" value={teacherName} onChange={e => setTeacherName(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Announcement Bridge Toggle */}
          <div style={{ padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notifyClass}
                onChange={e => {
                  setNotifyClass(e.target.checked);
                  if (e.target.checked && subjectId) {
                    const subName = subjects.find(s => s.id === subjectId)?.name || 'Class';
                    setNoticeTitle(`📅 Class Scheduled: ${subName}`);
                    setNoticeBody(`A new ${type} for ${subName} has been scheduled on ${DAY_FULL[activeDay]} from ${startTime} to ${endTime} in Room ${room || 'TBD'}.`);
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

          <button
            onClick={handleAddSlot}
            className="btn-primary"
            style={{ padding: 12, marginTop: 8 }}
          >
            Save Slot to Weekly Timetable
          </button>
        </div>
      </BottomSheet>

      {/* 2. Slot Action Sheet */}
      <BottomSheet open={showEditOptionSheet} onClose={() => setShowEditOptionSheet(false)} title="Manage Class Slot">
        {selectedSlot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 20px' }}>
            <p className="t-mono-sm" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 10 }}>
              Adjust or reschedule the weekly slot for <strong>{selectedSlot.subject}</strong> ({selectedSlot.startTime} - {selectedSlot.endTime}).
            </p>

            <button
              onClick={() => openCancelToday(selectedSlot)}
              className="btn-secondary"
              style={{ padding: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--status-critical)', borderColor: 'rgba(248, 113, 113, 0.2)' }}
            >
              <X size={15} /> Cancel Class for Today (Post Notice ❌)
            </button>

            <button
              onClick={() => openMakeupClass(selectedSlot)}
              className="btn-secondary"
              style={{ padding: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--status-warning)', borderColor: 'rgba(251, 191, 36, 0.2)' }}
            >
              <Calendar size={15} /> Schedule Makeup/Extra Class (Post Notice 📅)
            </button>

            <button
              onClick={() => openWeeklyEdit(selectedSlot)}
              className="btn-secondary"
              style={{ padding: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <Edit3 size={15} /> Edit Weekly Template (Permanent change)
            </button>

            <button
              onClick={handleDeleteWeeklySlot}
              className="btn-secondary"
              style={{ padding: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--status-critical)', borderColor: 'rgba(248, 113, 113, 0.2)', marginTop: 8 }}
            >
              <Trash2 size={15} /> Delete Slot Permanently
            </button>
          </div>
        )}
      </BottomSheet>

      {/* 3. Cancellation Notice Sheet */}
      <BottomSheet open={showCancelTodaySheet} onClose={() => setShowCancelTodaySheet(false)} title="Cancel Class Notice">
        {selectedSlot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 20px' }}>
            <div style={{ display: 'flex', gap: 10, background: 'rgba(248, 113, 113, 0.04)', border: '1px solid rgba(248, 113, 113, 0.15)', padding: 10, borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
              <AlertTriangle size={16} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                This will delete the timetable slot for today, send a push notification, and post a cancellation alert to the Notice board.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Notice Title</label>
              <input type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Notice Pre-filled Body</label>
              <textarea value={noticeBody} readOnly style={{ ...inputStyle, minHeight: 60, opacity: 0.8, background: 'var(--bg-base)', border: 'none' }} />
            </div>

            <div>
              <label style={labelStyle}>Reason for Cancellation (Appends to notice)</label>
              <input type="text" placeholder="e.g. Unwell / Urgent meeting / Holiday" value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Notice Priority</label>
              <select value={noticePriority} onChange={e => setNoticePriority(e.target.value as any)} style={inputStyle}>
                <option value="general">General (Appears on notices tab)</option>
                <option value="critical">Critical (Send real-time Push Notification 🚨)</option>
              </select>
            </div>

            <button
              onClick={handlePublishCancellation}
              className="btn-primary"
              style={{ padding: 12, background: 'var(--status-critical)', borderColor: 'var(--status-critical)', marginTop: 8 }}
            >
              Publish Cancellation Notice
            </button>
          </div>
        )}
      </BottomSheet>

      {/* 4. Makeup/Extra Class Sheet */}
      <BottomSheet open={showMakeupSheet} onClose={() => setShowMakeupSheet(false)} title="Schedule Makeup Class">
        {selectedSlot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 20px' }}>
            <div>
              <label style={labelStyle}>Notice Title</label>
              <input type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Makeup Date</label>
              <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start Time</label>
                <input type="time" value={makeupStart} onChange={e => setMakeupStart(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>End Time</label>
                <input type="time" value={makeupEnd} onChange={e => setMakeupEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Room</label>
              <input type="text" placeholder="e.g. 302 / Lab 3" value={makeupRoom} onChange={e => setMakeupRoom(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Notice Priority</label>
              <select value={noticePriority} onChange={e => setNoticePriority(e.target.value as any)} style={inputStyle}>
                <option value="general">General (Standard notice)</option>
                <option value="critical">Critical (Send Push notification 🚨)</option>
              </select>
            </div>

            <button
              onClick={handlePublishMakeup}
              className="btn-primary"
              style={{ padding: 12, background: 'var(--status-warning)', borderColor: 'var(--status-warning)', marginTop: 8 }}
            >
              Publish Makeup Class Notice
            </button>
          </div>
        )}
      </BottomSheet>

      {/* 5. Edit Weekly Template Form Sheet */}
      <BottomSheet open={showTemplateEditSheet} onClose={() => setShowTemplateEditSheet(false)} title="Edit Weekly Template Slot">
        {selectedSlot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={inputStyle}>
                <option value="">Select subject...</option>
                {subjects.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start Time</label>
                <input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>End Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Room</label>
                <input type="text" placeholder="e.g. 302" value={room} onChange={e => setRoom(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Class Type</label>
                <select value={type} onChange={e => handleTypeChange(e.target.value)} style={inputStyle}>
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Target Batch</label>
                <select value={targetBatch} onChange={e => setTargetBatch(e.target.value as any)} style={inputStyle}>
                  <option value="all">Full Section</option>
                  <option value="1">Batch 1</option>
                  <option value="2">Batch 2</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Teacher Name</label>
                <input type="text" value={teacherName} onChange={e => setTeacherName(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button
              onClick={handleUpdateWeeklySlot}
              className="btn-primary"
              style={{ padding: 12, marginTop: 8 }}
            >
              Save Changes to Template
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
