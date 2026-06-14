import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { 
  Users, Check, Bell, 
  BookOpen, Clock, AlertCircle, Loader2,
  Trash2, Edit3, MessageSquare, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  useTeacherSessions, 
  useSessionDetails, 
  useLogAttendanceMutation, 
  useUpdateSessionMutation, 
  useDeleteSessionMutation, 
  useCancelClassMutation
} from '../../hooks/useTeacherAttendance';
import { useSchedule } from '../../hooks/useSchedule';

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

const EMPTY_ARRAY: never[] = [];

export default function TeacherDashboardPage() {
  const authUser = useAppStore(s => s.authUser);

  // Active Tab: 'mark' or 'logs'
  const [activeTab, setActiveTab] = useState<'mark' | 'logs'>('mark');

  // 1. Fetch sections and subjects taught by this teacher
  const { data: mappings = EMPTY_ARRAY, isLoading: isMappingsLoading } = useQuery<SectionTeacherRow[]>({
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

  // Extract distinct sections
  const sections = useMemo(() => {
    const distinct: Record<string, { id: string; name: string; inviteCode: string; teacherInviteCode: string }> = {};
    mappings.forEach(m => {
      if (m.section_id && m.sections) {
        distinct[m.section_id] = {
          id: m.section_id,
          name: m.sections.name,
          inviteCode: m.sections.invite_code,
          teacherInviteCode: m.sections.teacher_invite_code || '',
        };
      }
    });
    return Object.values(distinct);
  }, [mappings]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Auto-select first section and subject
  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const subjectsForSelectedSection = useMemo(() => {
    if (!selectedSectionId) return EMPTY_ARRAY;
    const subjs: Array<{ id: string; name: string; code: string }> = [];
    mappings.forEach(m => {
      if (m.section_id === selectedSectionId && m.subjects) {
        if (!subjs.find(s => s.id === m.subjects?.id)) {
          subjs.push({
            id: m.subjects.id,
            name: m.subjects.name,
            code: m.subjects.code,
          });
        }
      }
    });
    return subjs;
  }, [mappings, selectedSectionId]);

  useEffect(() => {
    if (subjectsForSelectedSection.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjectsForSelectedSection[0].id);
    } else if (subjectsForSelectedSection.length > 0 && !subjectsForSelectedSection.find(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectsForSelectedSection[0].id);
    }
  }, [subjectsForSelectedSection, selectedSubjectId]);

  const selectedSubjectCode = useMemo(() => {
    return subjectsForSelectedSection.find(s => s.id === selectedSubjectId)?.code || '';
  }, [subjectsForSelectedSection, selectedSubjectId]);

  const selectedSubjectName = useMemo(() => {
    return subjectsForSelectedSection.find(s => s.id === selectedSubjectId)?.name || '';
  }, [subjectsForSelectedSection, selectedSubjectId]);

  // Fetch timetable slots for standard slot mapping
  const { data: schedule = {} } = useSchedule();
  const subjectSlots = useMemo(() => {
    if (!selectedSubjectId || !schedule) return [];
    const slots: any[] = [];
    Object.entries(schedule).forEach(([day, daySlots]) => {
      daySlots.forEach(slot => {
        if (slot.subjectId === selectedSubjectId) {
          slots.push({
            id: slot.id,
            day,
            label: `${day} - ${slot.startTime}-${slot.endTime} (${slot.type})`,
          });
        }
      });
    });
    return slots;
  }, [schedule, selectedSubjectId]);

  // 2. Fetch students in the selected section
  const { data: students = EMPTY_ARRAY, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['section-students', selectedSectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, section_roll, university_roll, sub_batch')
        .eq('section_id', selectedSectionId)
        .order('section_roll', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSectionId,
  });

  // 3. Fetch cumulative attendance records to trigger loading states
  const { isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['section-attendance', selectedSectionId, selectedSubjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, present, absent, od, makeup, percentage')
        .eq('subject_id', selectedSubjectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSectionId && !!selectedSubjectId,
  });

  // 4. Fetch assignments created by this teacher
  const { data: assignments = EMPTY_ARRAY, isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments', authUser?.id, selectedSectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, subject_id, target_batch,
          submissions (id, student_id, submission_link, status)
        `)
        .eq('created_by', authUser?.id || '')
        .eq('section_id', selectedSectionId)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id && !!selectedSectionId,
  });

  // 5. Fetch logged sessions history
  const { data: sessions = EMPTY_ARRAY, isLoading: isSessionsLoading } = useTeacherSessions(selectedSectionId, selectedSubjectId);

  // --- Attendance Marking Form States ---
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timetableSlotId, setTimetableSlotId] = useState<string>('extra');
  const [extraLabel, setExtraLabel] = useState<string>('');
  const [targetBatch, setTargetBatch] = useState<'All' | '1' | '2'>('All');
  const [lectureCount, setLectureCount] = useState<number>(1);
  const [localMarkings, setLocalMarkings] = useState<Record<string, 'present' | 'absent' | 'od' | 'makeup'>>({});

  // Filter students based on active batch
  const visibleStudents = useMemo(() => {
    if (students.length === 0) return EMPTY_ARRAY;
    if (targetBatch === 'All') return students;
    return students.filter(s => s.sub_batch === targetBatch);
  }, [students, targetBatch]);

  // Reset markings to present when students list or targetBatch changes
  useEffect(() => {
    if (isStudentsLoading || students.length === 0) return;
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {};
    visibleStudents.forEach(s => {
      markings[s.id] = 'present';
    });
    setLocalMarkings(markings);
  }, [visibleStudents, isStudentsLoading, students.length]);

  const updateMarking = (studentId: string, status: 'present' | 'absent' | 'od' | 'makeup') => {
    setLocalMarkings(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const setAllMarkings = (status: 'present' | 'absent' | 'od' | 'makeup') => {
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {};
    visibleStudents.forEach(s => {
      markings[s.id] = status;
    });
    setLocalMarkings(markings);
  };

  // --- Submissions Drawer States ---
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);

  const selectedAssignment = useMemo(() => {
    return assignments.find(a => a.id === activeAssignmentId) || null;
  }, [assignments, activeAssignmentId]);

  // --- Cancellation / Lecture Alert States ---
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSlotId, setAlertSlotId] = useState<string>('');
  const [alertBatch, setAlertBatch] = useState<'All' | '1' | '2'>('All');

  // --- Edit Past Session States ---
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { data: editSessionMarkings = EMPTY_ARRAY, isLoading: isEditSessionLoading } = useSessionDetails(editingSessionId || '', selectedSectionId);
  const [localEditMarkings, setLocalEditMarkings] = useState<Record<string, 'present' | 'absent' | 'od' | 'makeup'>>({});

  // Populate local edit markings when fetched
  useEffect(() => {
    if (isEditSessionLoading || editSessionMarkings.length === 0) return;
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {};
    editSessionMarkings.forEach(m => {
      markings[m.student_id] = m.status;
    });
    setLocalEditMarkings(markings);
  }, [editSessionMarkings, isEditSessionLoading]);

  // --- Mutations ---
  const logAttendanceMut = useLogAttendanceMutation();
  const updateSessionMut = useUpdateSessionMutation();
  const deleteSessionMut = useDeleteSessionMutation();
  const cancelClassMut = useCancelClassMutation();

  const handleMarkSubmit = async () => {
    if (visibleStudents.length === 0) {
      toast.info('No students in this batch to mark!');
      return;
    }

    const sessionId = crypto.randomUUID(); // client UUID for idempotency
    const markings = Object.entries(localMarkings).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    toast.promise(
      logAttendanceMut.mutateAsync({
        sessionId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        date,
        timetableSlotId: timetableSlotId === 'extra' ? null : timetableSlotId,
        targetBatch: targetBatch === 'All' ? null : targetBatch,
        lectureCount,
        markings,
      }),
      {
        loading: 'Logging attendance session...',
        success: 'Attendance session logged successfully! ✓',
        error: 'Failed to submit attendance. Please try again.',
      }
    );
  };

  const handleEditSubmit = async () => {
    if (!editingSessionId) return;

    const updates = Object.entries(localEditMarkings).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    toast.promise(
      updateSessionMut.mutateAsync({
        sessionId: editingSessionId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        updates,
      }),
      {
        loading: 'Updating register records...',
        success: 'Register records updated successfully! ✓',
        error: 'Failed to update records.',
      }
    );

    setEditOpen(false);
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session? This will completely subtract these classes from students aggregate attendance.')) {
      toast.promise(
        deleteSessionMut.mutateAsync({
          sessionId,
          sectionId: selectedSectionId,
          subjectId: selectedSubjectId,
        }),
        {
          loading: 'Deleting session and reversing aggregates...',
          success: 'Session deleted and attendance counts reversed! ✓',
          error: 'Failed to delete session.',
        }
      );
    }
  };

  const handleNudgeAllPending = async () => {
    if (!selectedAssignment) return;

    const submittedStudentIds = new Set((selectedAssignment.submissions || []).map(s => s.student_id));
    const pendingStudents = students.filter(s => !submittedStudentIds.has(s.id));

    if (pendingStudents.length === 0) {
      toast.info('All students have submitted this assignment! 🎉');
      return;
    }

    const notificationsToInsert = pendingStudents.map(s => ({
      section_id: selectedSectionId,
      recipient_id: s.id,
      actor_id: authUser?.id,
      kind: 'ack_nudge' as const,
      status: 'sent' as const,
      title: 'Assignment Pending ⏳',
      body: `Review pending assignment: "${selectedAssignment.title}" in ${selectedSubjectCode}. Please submit your link.`,
      created_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('notification_events')
        .insert(notificationsToInsert);

      if (error) throw error;
      toast.success(`Nudged ${pendingStudents.length} pending students successfully! 🔔`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send nudges');
    }
  };

  const handleBroadcastCancellation = async () => {
    if (!selectedSectionId || !selectedSubjectId) return;

    const selectedSlot = subjectSlots.find(s => s.id === alertSlotId);
    const slotLabel = selectedSlot ? selectedSlot.label : 'Today\'s slot';

    toast.promise(
      cancelClassMut.mutateAsync({
        sectionId: selectedSectionId,
        subjectCode: selectedSubjectCode,
        subjectName: selectedSubjectName,
        dateStr: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        slotLabel,
        targetBatch: alertBatch === 'All' ? null : alertBatch,
      }),
      {
        loading: 'Broadcasting critical alert...',
        success: 'Cancellation broadcasted to all students! 🚨',
        error: 'Failed to broadcast class cancellation.',
      }
    );

    setAlertOpen(false);
  };

  const presentCount = useMemo(() => {
    return Object.values(localMarkings).filter(v => v === 'present').length;
  }, [localMarkings]);

  const absentCount = useMemo(() => {
    return Object.values(localMarkings).filter(v => v === 'absent').length;
  }, [localMarkings]);

  const odCount = useMemo(() => {
    return Object.values(localMarkings).filter(v => v === 'od').length;
  }, [localMarkings]);

  const makeupCount = useMemo(() => {
    return Object.values(localMarkings).filter(v => v === 'makeup').length;
  }, [localMarkings]);

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(13, 15, 20, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <p className="t-mono-sm" style={{ color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Teacher Console
          </p>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
            Welcome, {authUser?.name ? authUser.name.split(' ')[0] : 'Professor'} 🎓
          </h1>
        </div>
        <button 
          onClick={() => setAlertOpen(true)}
          className="btn-secondary"
          style={{
            padding: '6px 12px',
            minHeight: 'fit-content',
            borderRadius: 'var(--radius-pill)',
            borderColor: 'rgba(248, 113, 113, 0.25)',
            background: 'rgba(248, 113, 113, 0.05)',
            color: 'var(--status-critical)',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Bell size={13} /> Cancel Lecture
        </button>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isMappingsLoading ? (
          <div className="t-mono" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            Loading teacher configurations...
          </div>
        ) : sections.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(20,24,38,0.2)' }}>
            <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Joined Sections</h3>
            <p className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 280, margin: '0 auto 16px' }}>
              You haven't joined any section hubs. Get a Teacher Invite Code from a CR to register.
            </p>
          </div>
        ) : (
          <>
            {/* Mappings selector card */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(20,24,38,0.2)' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Active Section
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={e => { setSelectedSectionId(e.target.value); }}
                    className="input"
                    style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
                  >
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Course Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    className="input"
                    style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
                    disabled={subjectsForSelectedSection.length === 0}
                  >
                    {subjectsForSelectedSection.map(subj => (
                      <option key={subj.id} value={subj.id}>{subj.name} ({subj.code})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dashboard Tabs switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)' }}>
              <button 
                onClick={() => setActiveTab('mark')}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'mark' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'mark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Mark Attendance
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'logs' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'logs' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Attendance Log ({sessions.length})
              </button>
            </div>

            {/* Content Tabs */}
            {activeTab === 'mark' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Session Configurations Card */}
                <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(20,24,38,0.1)' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Session Date
                      </label>
                      <input 
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="input"
                        style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Timetable Period
                      </label>
                      <select
                        value={timetableSlotId}
                        onChange={e => setTimetableSlotId(e.target.value)}
                        className="input"
                        style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
                      >
                        {subjectSlots.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                        <option value="extra">Unscheduled / Extra Class</option>
                      </select>
                    </div>
                  </div>

                  {timetableSlotId === 'extra' && (
                    <div>
                      <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Unscheduled Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Extra Lab Session, Zero Period"
                        value={extraLabel}
                        onChange={e => setExtraLabel(e.target.value)}
                        className="input"
                        style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Target Batch
                      </label>
                      <div style={{
                        display: 'flex',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 2,
                        gap: 2
                      }}>
                        {(['All', '1', '2'] as const).map(b => (
                          <button
                            key={b}
                            onClick={() => setTargetBatch(b)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: targetBatch === b ? 'var(--bg-elevated)' : 'transparent',
                              color: targetBatch === b ? 'var(--text-primary)' : 'var(--text-muted)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            {b === 'All' ? 'All' : `Batch ${b}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Session Weight
                      </label>
                      <div style={{
                        display: 'flex',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 2,
                        gap: 2
                      }}>
                        {([1, 2] as const).map(w => (
                          <button
                            key={w}
                            onClick={() => setLectureCount(w)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: lectureCount === w ? 'var(--bg-elevated)' : 'transparent',
                              color: lectureCount === w ? 'var(--text-primary)' : 'var(--text-muted)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            {w} Period{w > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Attendance Marking Grid */}
                <div className="card" style={{ padding: '16px', background: 'rgba(20,24,38,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <h3 className="t-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                        <Users size={16} style={{ color: 'var(--accent-primary)' }} />
                        Visual Register Grid
                      </h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        Choose P/A/OD/M statuses for students.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setAllMarkings('present')}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minHeight: 'fit-content', fontSize: '10px', borderRadius: 'var(--radius-sm)' }}
                      >
                        All Present
                      </button>
                      <button 
                        onClick={() => setAllMarkings('absent')}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minHeight: 'fit-content', fontSize: '10px', borderRadius: 'var(--radius-sm)' }}
                      >
                        All Absent
                      </button>
                    </div>
                  </div>

                  {isStudentsLoading || isAttendanceLoading ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      Loading student roster...
                    </div>
                  ) : visibleStudents.length === 0 ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No students found in this batch.
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '12px',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        padding: '4px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(10, 12, 20, 0.25)',
                        border: '1px solid var(--border-default)'
                      }}>
                        {visibleStudents.map(student => {
                          const status = localMarkings[student.id] || 'present';
                          const avatar = student.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}`;
                          
                          let cardBorder = 'var(--border-default)';
                          let cardBg = 'rgba(20, 24, 38, 0.15)';
                          let avatarBorder = 'rgba(255, 255, 255, 0.1)';
                          if (status === 'present') {
                            cardBorder = 'rgba(52, 211, 153, 0.25)';
                            cardBg = 'rgba(52, 211, 153, 0.04)';
                            avatarBorder = 'var(--status-safe)';
                          } else if (status === 'absent') {
                            cardBorder = 'rgba(248, 113, 113, 0.25)';
                            cardBg = 'rgba(248, 113, 113, 0.04)';
                            avatarBorder = 'var(--status-critical)';
                          } else if (status === 'od') {
                            cardBorder = 'rgba(251, 191, 36, 0.25)';
                            cardBg = 'rgba(251, 191, 36, 0.04)';
                            avatarBorder = 'var(--status-warning)';
                          } else if (status === 'makeup') {
                            cardBorder = 'rgba(167, 139, 250, 0.25)';
                            cardBg = 'rgba(167, 139, 250, 0.04)';
                            avatarBorder = 'var(--status-announcement)';
                          }

                          return (
                            <div 
                              key={student.id} 
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '12px',
                                border: `1px solid ${cardBorder}`,
                                backgroundColor: cardBg,
                                borderRadius: 'var(--radius-md)',
                                position: 'relative',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <img 
                                src={avatar} 
                                alt={student.name}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '50%',
                                  border: `2px solid ${avatarBorder}`,
                                  objectFit: 'cover',
                                  marginBottom: '8px'
                                }}
                              />
                              <p className="t-mono-sm" style={{ fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
                                {student.name.split(' ')[0]}
                              </p>
                              <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                                Roll: {student.section_roll || '—'}
                              </p>

                              {/* Direct Select Badges */}
                              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                {(['present', 'absent', 'od', 'makeup'] as const).map(st => {
                                  const isActive = status === st;
                                  let color = '';
                                  let bg = '';
                                  if (st === 'present') {
                                    color = isActive ? '#ffffff' : 'var(--status-safe)';
                                    bg = isActive ? 'var(--status-safe)' : 'rgba(52, 211, 153, 0.1)';
                                  } else if (st === 'absent') {
                                    color = isActive ? '#ffffff' : 'var(--status-critical)';
                                    bg = isActive ? 'var(--status-critical)' : 'rgba(248, 113, 113, 0.1)';
                                  } else if (st === 'od') {
                                    color = isActive ? '#ffffff' : 'var(--status-warning)';
                                    bg = isActive ? 'var(--status-warning)' : 'rgba(251, 191, 36, 0.1)';
                                  } else if (st === 'makeup') {
                                    color = isActive ? '#ffffff' : 'var(--status-announcement)';
                                    bg = isActive ? 'var(--status-announcement)' : 'rgba(167, 139, 250, 0.1)';
                                  }

                                  return (
                                    <button
                                      key={st}
                                      onClick={() => updateMarking(student.id, st)}
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        color,
                                        backgroundColor: bg,
                                        cursor: 'pointer',
                                        transition: 'all var(--transition-fast)'
                                      }}
                                      title={st.toUpperCase()}
                                    >
                                      {st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'od' ? 'O' : 'M'}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary & Submit Action */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '16px', marginTop: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: 'var(--status-safe)', fontWeight: 'bold' }}>{presentCount} P</span>
                          <span style={{ color: 'var(--status-critical)', fontWeight: 'bold' }}>{absentCount} A</span>
                          <span style={{ color: 'var(--status-warning)', fontWeight: 'bold' }}>{odCount} O</span>
                          <span style={{ color: 'var(--status-announcement)', fontWeight: 'bold' }}>{makeupCount} M</span>
                        </div>

                        <button
                          onClick={handleMarkSubmit}
                          disabled={logAttendanceMut.isPending || visibleStudents.length === 0}
                          className="btn-primary"
                          style={{
                            width: 'auto',
                            padding: '10px 20px',
                            minHeight: '40px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {logAttendanceMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Log Session
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              // Attendance Log Tab
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {isSessionsLoading ? (
                  <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    Loading session history...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No sessions logged yet for this subject.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                    {sessions.map(session => {
                      const formattedDate = new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                      const slotLabel = session.timetable_slot_id 
                        ? subjectSlots.find(s => s.id === session.timetable_slot_id)?.label || 'Regular Slot'
                        : 'Unscheduled Session';

                      return (
                        <div 
                          key={session.id} 
                          className="card"
                          style={{
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            background: 'rgba(20, 24, 38, 0.15)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                            <h4 className="t-mono" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {formattedDate} 
                              <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                {session.lecture_count}x weight
                              </span>
                              {session.target_batch && (
                                <span style={{ background: 'rgba(96, 165, 250, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(96, 165, 250, 0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                                  Batch {session.target_batch}
                                </span>
                              )}
                            </h4>
                            <p className="t-mono-sm" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Slot: {slotLabel}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
                              <span style={{ color: 'var(--status-safe)', fontWeight: 'bold' }}>{session.present_count} P</span>
                              <span>•</span>
                              <span style={{ color: 'var(--status-critical)', fontWeight: 'bold' }}>{session.absent_count} A</span>
                              <span>•</span>
                              <span style={{ color: 'var(--status-warning)', fontWeight: 'bold' }}>{session.od_count} O</span>
                              <span>•</span>
                              <span style={{ color: 'var(--status-announcement)', fontWeight: 'bold' }}>{session.makeup_count} M</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                              onClick={() => { setEditingSessionId(session.id); setEditOpen(true); }}
                              className="btn-secondary"
                              style={{ padding: '8px', minWidth: '34px', minHeight: '34px', borderRadius: 'var(--radius-sm)' }}
                              title="Edit Register"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="btn-secondary"
                              style={{ padding: '8px', minWidth: '34px', minHeight: '34px', borderRadius: 'var(--radius-sm)', color: 'var(--status-critical)', borderColor: 'rgba(248, 113, 113, 0.2)' }}
                              title="Delete Session"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Course Submission Tracking (Always visible at bottom) */}
            <div className="card" style={{ padding: '16px', background: 'rgba(20,24,38,0.2)', marginTop: '8px' }}>
              <h3 className="t-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', marginBottom: '16px' }}>
                <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                Assignment Submissions Tracker
              </h3>

              {isAssignmentsLoading ? (
                <div className="t-mono" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  Loading assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div className="t-mono" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No assignments created by you in this section.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {assignments.map(ass => {
                    const submissionsCount = ass.submissions?.length || 0;
                    const totalStudents = students.length;
                    const percent = totalStudents > 0 ? Math.round((submissionsCount / totalStudents) * 100) : 0;

                    return (
                      <button
                        key={ass.id}
                        onClick={() => { setActiveAssignmentId(ass.id); setSubmissionsOpen(true); }}
                        className="card"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '14px',
                          background: 'rgba(20,24,38,0.1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 className="t-subtitle" style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ass.title}
                            </h4>
                            <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={10} /> Due: {new Date(ass.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className="t-mono" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-primary)', flexShrink: 0 }}>
                            {submissionsCount}/{totalStudents} ({percent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ height: '4px', width: '100%', background: 'var(--bg-base)', borderRadius: '100px', overflow: 'hidden' }}>
                          <div 
                            style={{ height: '100%', background: 'var(--accent-primary)', borderRadius: '100px', width: `${percent}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* --- 1. Edit Past Register Session Drawer --- */}
      <BottomSheet
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingSessionId(null); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={15} style={{ color: 'var(--accent-primary)' }} />
            <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Edit Historical Register</span>
          </div>
        }
      >
        {isEditSessionLoading ? (
          <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Loading registers...
          </div>
        ) : editSessionMarkings.length === 0 ? (
          <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No student records to load.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(10, 12, 20, 0.25)',
              border: '1px solid var(--border-default)'
            }}>
              {editSessionMarkings.map(student => {
                const status = localEditMarkings[student.student_id] || 'present';
                const avatar = student.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}`;
                
                let cardBorder = 'var(--border-default)';
                let cardBg = 'rgba(20, 24, 38, 0.15)';
                let avatarBorder = 'rgba(255, 255, 255, 0.1)';
                if (status === 'present') {
                  cardBorder = 'rgba(52, 211, 153, 0.25)';
                  cardBg = 'rgba(52, 211, 153, 0.04)';
                  avatarBorder = 'var(--status-safe)';
                } else if (status === 'absent') {
                  cardBorder = 'rgba(248, 113, 113, 0.25)';
                  cardBg = 'rgba(248, 113, 113, 0.04)';
                  avatarBorder = 'var(--status-critical)';
                } else if (status === 'od') {
                  cardBorder = 'rgba(251, 191, 36, 0.25)';
                  cardBg = 'rgba(251, 191, 36, 0.04)';
                  avatarBorder = 'var(--status-warning)';
                } else if (status === 'makeup') {
                  cardBorder = 'rgba(167, 139, 250, 0.25)';
                  cardBg = 'rgba(167, 139, 250, 0.04)';
                  avatarBorder = 'var(--status-announcement)';
                }

                return (
                  <div 
                    key={student.student_id} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px',
                      border: `1px solid ${cardBorder}`,
                      backgroundColor: cardBg,
                      borderRadius: 'var(--radius-md)',
                      position: 'relative',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <img 
                      src={avatar} 
                      alt={student.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: `2px solid ${avatarBorder}`,
                        objectFit: 'cover',
                        marginBottom: '8px'
                      }}
                    />
                    <p className="t-mono-sm" style={{ fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
                      {student.name.split(' ')[0]}
                    </p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                      Roll: {student.section_roll || '—'}
                    </p>

                    {/* Direct Select Badges */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                      {(['present', 'absent', 'od', 'makeup'] as const).map(st => {
                        const isActive = status === st;
                        let color = '';
                        let bg = '';
                        if (st === 'present') {
                          color = isActive ? '#ffffff' : 'var(--status-safe)';
                          bg = isActive ? 'var(--status-safe)' : 'rgba(52, 211, 153, 0.1)';
                        } else if (st === 'absent') {
                          color = isActive ? '#ffffff' : 'var(--status-critical)';
                          bg = isActive ? 'var(--status-critical)' : 'rgba(248, 113, 113, 0.1)';
                        } else if (st === 'od') {
                          color = isActive ? '#ffffff' : 'var(--status-warning)';
                          bg = isActive ? 'var(--status-warning)' : 'rgba(251, 191, 36, 0.1)';
                        } else if (st === 'makeup') {
                          color = isActive ? '#ffffff' : 'var(--status-announcement)';
                          bg = isActive ? 'var(--status-announcement)' : 'rgba(167, 139, 250, 0.1)';
                        }

                        return (
                          <button
                            key={st}
                            onClick={() => setLocalEditMarkings(prev => ({ ...prev, [student.student_id]: st }))}
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              color,
                              backgroundColor: bg,
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            {st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'od' ? 'O' : 'M'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleEditSubmit}
              disabled={updateSessionMut.isPending}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {updateSessionMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save Changes
            </button>
          </div>
        )}
      </BottomSheet>

      {/* --- 2. Assignment Submissions Details Drawer --- */}
      <BottomSheet
        open={submissionsOpen}
        onClose={() => { setSubmissionsOpen(false); setActiveAssignmentId(null); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <BookOpen size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAssignment?.title}
              </span>
            </div>
            <button
              onClick={handleNudgeAllPending}
              className="btn-secondary"
              style={{
                padding: '4px 8px',
                minHeight: 'fit-content',
                borderRadius: 'var(--radius-sm)',
                borderColor: 'rgba(251, 191, 36, 0.25)',
                background: 'rgba(251, 191, 36, 0.05)',
                color: 'var(--status-warning)',
                fontSize: '10px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <Bell size={10} /> Nudge Pending
            </button>
          </div>
        }
      >
        {selectedAssignment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {students.map(student => {
                const sub = (selectedAssignment.submissions || []).find(s => s.student_id === student.id);
                const hasSubmitted = sub && sub.status === 'submitted';

                return (
                  <div 
                    key={student.id} 
                    className="card"
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      background: 'rgba(20, 24, 38, 0.15)'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="t-mono" style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.name}
                      </span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                        Roll: {student.section_roll || '—'}
                      </span>
                    </div>

                    {hasSubmitted && sub.submission_link ? (
                      <a
                        href={sub.submission_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{
                          padding: '6px 12px',
                          minHeight: '28px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: 'var(--accent-primary)',
                          background: 'rgba(96, 165, 250, 0.05)',
                          borderColor: 'rgba(96, 165, 250, 0.25)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        Open Submission
                      </a>
                    ) : (
                      <span className="badge badge-critical" style={{ fontSize: '10px', padding: '4px 10px' }}>
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {/* --- 3. Cancel Lecture / Alert Drawer --- */}
      <BottomSheet
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={15} style={{ color: 'var(--status-critical)' }} />
            <span className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Broadcast Lecture Alert</span>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Broadcast a critical notice regarding cancellation or reschedule of today's slots. Students will be notified instantly via push notifications.
          </p>

          <div>
            <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              Slot to Cancel
            </label>
            <select
              value={alertSlotId}
              onChange={e => setAlertSlotId(e.target.value)}
              className="input"
              style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
            >
              <option value="">Choose timetable slot...</option>
              {subjectSlots.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Target Batch
              </label>
              <select
                value={alertBatch}
                onChange={e => setAlertBatch(e.target.value as any)}
                className="input"
                style={{ padding: '8px 12px', minHeight: '40px', fontSize: '13px' }}
              >
                <option value="All">All Section</option>
                <option value="1">Batch 1</option>
                <option value="2">Batch 2</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <button
                onClick={handleBroadcastCancellation}
                disabled={cancelClassMut.isPending || !alertSlotId}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  minHeight: '40px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'linear-gradient(180deg, #F87171 0%, #DC2626 100%)',
                  boxShadow: '0 4px 16px rgba(248, 113, 113, 0.30)'
                }}
              >
                {cancelClassMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send Alert
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      <NavBar />
    </div>
  );
}
