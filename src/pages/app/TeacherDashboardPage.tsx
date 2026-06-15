import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { 
  Users, Check, Bell, 
  BookOpen, Clock, Loader2,
  Trash2, Edit3, MessageSquare, Send,
  Grid, List, MoreVertical, Search, Plus
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
  const qc = useQueryClient();

  // Active Tab: 'mark' | 'register' | 'logs' | 'assignments'
  const [activeTab, setActiveTab] = useState<'mark' | 'register' | 'logs' | 'assignments'>('mark');

  // Custom visual marking states
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [optionsStudent, setOptionsStudent] = useState<any | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  // Spreadsheet register states
  const [updatingCell, setUpdatingCell] = useState<{ studentId: string; sessionId: string } | null>(null);
  const [spreadsheetSearch, setSpreadsheetSearch] = useState('');

  // Course linking drawer state
  const [showLinkSubjectsDrawer, setShowLinkSubjectsDrawer] = useState(false);

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

  const selectedSectionId = useAppStore(s => s.selectedSectionId) || '';
  const selectedSubjectId = useAppStore(s => s.selectedSubjectId) || '';
  const setSelectedSectionId = useAppStore(s => s.setSelectedSectionId)!;
  const setSelectedSubjectId = useAppStore(s => s.setSelectedSubjectId)!;

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
  // 4. Fetch assignments for the selected subject (created by CR or Teacher)
  const { data: assignments = EMPTY_ARRAY, isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments', selectedSectionId, selectedSubjectId],
    queryFn: async () => {
      if (!selectedSectionId || !selectedSubjectId) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, subject_id, target_batch,
          submissions (id, student_id, submission_link, status)
        `)
        .eq('section_id', selectedSectionId)
        .eq('subject_id', selectedSubjectId)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSectionId && !!selectedSubjectId,
  });

  // 5. Fetch logged sessions history
  const { data: sessions = EMPTY_ARRAY, isLoading: isSessionsLoading } = useTeacherSessions(selectedSectionId, selectedSubjectId);

  // Fetch detailed session markings for horizontal spreadsheet register
  const { data: spreadsheetMarkings = EMPTY_ARRAY, isLoading: isSpreadsheetMarkingsLoading, refetch: refetchSpreadsheet } = useQuery({
    queryKey: ['spreadsheet-markings', selectedSectionId, selectedSubjectId, sessions.length],
    queryFn: async () => {
      if (!selectedSectionId || !selectedSubjectId || sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const { data, error } = await supabase
        .from('student_session_attendance' as any)
        .select('session_id, student_id, status')
        .in('session_id', sessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSectionId && !!selectedSubjectId && sessions.length > 0,
  });

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
        success: 'Cancellation broadcasted successfully!',
        error: (err: any) => 'Failed to broadcast alert: ' + (err?.message || err),
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

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions]);

  const markingsMap = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'od' | 'makeup'>();
    spreadsheetMarkings.forEach((m: any) => {
      map.set(`${m.session_id}-${m.student_id}`, m.status);
    });
    return map;
  }, [spreadsheetMarkings]);

  const filteredStudentsForSpreadsheet = useMemo(() => {
    if (!spreadsheetSearch.trim()) return students;
    const q = spreadsheetSearch.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.section_roll && s.section_roll.toLowerCase().includes(q))
    );
  }, [students, spreadsheetSearch]);

  const handleCellTap = async (studentId: string, sessionId: string, currentStatus: 'present' | 'absent' | 'od' | 'makeup') => {
    const cycle = ['present', 'absent', 'od', 'makeup'] as const;
    const nextStatus = cycle[(cycle.indexOf(currentStatus) + 1) % cycle.length];
    
    setUpdatingCell({ studentId, sessionId });
    try {
      await updateSessionMut.mutateAsync({
        sessionId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        updates: [{ studentId, status: nextStatus }]
      });
      refetchSpreadsheet();
      toast.success('Status updated ✓');
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    } finally {
      setUpdatingCell(null);
    }
  };

  const handleStudentTap = (studentId: string) => {
    const current = localMarkings[studentId] || 'present';
    const next = current === 'present' ? 'absent' : 'present';
    updateMarking(studentId, next);
  };

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
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)', fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedSubjectCode || 'Teacher Console'}
          </h1>
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {selectedSubjectName || 'Section Course Mappings'}
          </p>
        </div>

        {/* Global Section & Course Selector */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sections.length > 0 && (
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="input mono"
              style={{
                padding: '4px 10px',
                height: 32,
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                width: 'auto',
                minWidth: 70
              }}
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          )}

          {subjectsForSelectedSection.length > 0 && (
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="input mono"
              style={{
                padding: '4px 10px',
                height: 32,
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                width: 'auto',
                minWidth: 90
              }}
            >
              {subjectsForSelectedSection.map(subj => (
                <option key={subj.id} value={subj.id}>{subj.code}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isMappingsLoading ? (
          <div className="t-mono" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            Loading teacher configurations...
          </div>
        ) : sections.length === 0 ? (
          <div className="card" style={{
            textAlign: 'center', padding: '48px 24px',
            background: 'linear-gradient(145deg, rgba(74, 158, 255, 0.05) 0%, rgba(74, 158, 255, 0.01) 100%)',
            border: '1px dashed var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            margin: '24px 0',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <Users size={28} color="var(--accent-primary)" />
            </div>
            <h3 className="t-feature" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Welcome, Professor!</h3>
            <p className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto 24px', lineHeight: 1.5 }}>
              You haven't linked any subjects to your account yet. Let's link your courses to start marking attendance.
            </p>
            <button
              onClick={() => setShowLinkSubjectsDrawer(true)}
              className="btn-primary"
              style={{ padding: '12px 24px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={16} /> Link Subject
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Tabs switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { id: 'mark', label: 'Mark Attendance' },
                { id: 'register', label: 'Attendance Register' },
                { id: 'logs', label: `Attendance Log (${sessions.length})` },
                { id: 'assignments', label: 'Assignments Tracker' },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    flex: '1 0 auto',
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    background: 'none',
                    color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Tabs */}
            {activeTab === 'mark' && (
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
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
                      <Bell size={13} /> Broadcast Cancel Alert
                    </button>
                  </div>
                </div>

                {/* Visual Attendance Marking Grid/List */}
                <div className="card" style={{ padding: '16px', background: 'rgba(20,24,38,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <h3 className="t-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                        <Users size={16} style={{ color: 'var(--accent-primary)' }} />
                        Roll Register
                      </h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tap to toggle Present/Absent. Options for OD/Makeup.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Grid/List toggle button */}
                      <button
                        onClick={() => setLayoutMode(prev => prev === 'grid' ? 'list' : 'grid')}
                        className="btn-secondary"
                        style={{ padding: '6px', minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={layoutMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
                      >
                        {layoutMode === 'grid' ? <List size={16} /> : <Grid size={16} />}
                      </button>

                      {/* Bulk markings three-dot menu */}
                      <button
                        onClick={() => setBulkMenuOpen(true)}
                        className="btn-secondary"
                        style={{ padding: '6px', minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Bulk Actions"
                      >
                        <MoreVertical size={16} />
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
                      {layoutMode === 'grid' ? (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                          gap: '12px',
                          maxHeight: '380px',
                          overflowY: 'auto',
                          padding: '4px',
                          borderRadius: 'var(--radius-md)',
                        }}>
                          {visibleStudents.map(student => {
                            const status = localMarkings[student.id] || 'present';
                            const avatar = student.avatar_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(student.name)}`;
                            
                            let cardBorder = 'var(--border-default)';
                            let cardBg = 'rgba(20, 24, 38, 0.15)';
                            let avatarBorder = 'rgba(255, 255, 255, 0.1)';
                            if (status === 'present') {
                              cardBorder = 'rgba(52, 211, 153, 0.4)';
                              cardBg = 'rgba(52, 211, 153, 0.05)';
                              avatarBorder = 'var(--status-safe)';
                            } else if (status === 'absent') {
                              cardBorder = 'rgba(248, 113, 113, 0.4)';
                              cardBg = 'rgba(248, 113, 113, 0.05)';
                              avatarBorder = 'var(--status-critical)';
                            } else if (status === 'od') {
                              cardBorder = 'rgba(251, 191, 36, 0.4)';
                              cardBg = 'rgba(251, 191, 36, 0.05)';
                              avatarBorder = 'var(--status-warning)';
                            } else if (status === 'makeup') {
                              cardBorder = 'rgba(167, 139, 250, 0.4)';
                              cardBg = 'rgba(167, 139, 250, 0.05)';
                              avatarBorder = 'var(--status-announcement)';
                            }

                            return (
                              <div 
                                key={student.id} 
                                onClick={() => handleStudentTap(student.id)}
                                onContextMenu={(e) => { e.preventDefault(); setOptionsStudent(student); }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  padding: '16px 12px 12px',
                                  border: `1px solid ${cardBorder}`,
                                  backgroundColor: cardBg,
                                  borderRadius: 'var(--radius-md)',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'all var(--transition-fast)',
                                  userSelect: 'none'
                                }}
                              >
                                {/* Mini options indicator/trigger */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOptionsStudent(student); }}
                                  style={{
                                    position: 'absolute', top: 4, right: 4, background: 'none', border: 'none',
                                    color: 'var(--text-muted)', cursor: 'pointer', padding: 4
                                  }}
                                >
                                  <MoreVertical size={12} />
                                </button>

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
                                <p className="t-mono-sm" style={{ fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {student.name.split(' ')[0]}
                                </p>
                                <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                                  Roll: {student.section_roll || '—'}
                                </p>

                                {/* Mini Status Badge */}
                                <span className="t-mono-sm" style={{
                                  fontSize: 9, fontWeight: 700, marginTop: 8, padding: '2px 6px', borderRadius: 4,
                                  background: status === 'present' ? 'rgba(52, 211, 153, 0.15)' : status === 'absent' ? 'rgba(248, 113, 113, 0.15)' : status === 'od' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                                  color: status === 'present' ? 'var(--status-safe)' : status === 'absent' ? 'var(--status-critical)' : status === 'od' ? 'var(--status-warning)' : 'var(--status-announcement)'
                                }}>
                                  {status.toUpperCase()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          maxHeight: '380px',
                          overflowY: 'auto',
                          padding: '4px',
                        }}>
                          {visibleStudents.map(student => {
                            const status = localMarkings[student.id] || 'present';
                            const avatar = student.avatar_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(student.name)}`;

                            let borderLColor = 'var(--border-default)';
                            if (status === 'present') borderLColor = 'var(--status-safe)';
                            else if (status === 'absent') borderLColor = 'var(--status-critical)';
                            else if (status === 'od') borderLColor = 'var(--status-warning)';
                            else if (status === 'makeup') borderLColor = 'var(--status-announcement)';

                            return (
                              <div
                                key={student.id}
                                onClick={() => handleStudentTap(student.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: 'rgba(20, 24, 38, 0.15)',
                                  border: '1px solid var(--border-default)',
                                  borderLeft: `4px solid ${borderLColor}`,
                                  borderRadius: 'var(--radius-md)',
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <img 
                                    src={avatar} 
                                    alt={student.name}
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                  <div>
                                    <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</p>
                                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10 }}>Roll: {student.section_roll || '—'}</p>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span className="badge" style={{
                                    background: status === 'present' ? 'rgba(52, 211, 153, 0.15)' : status === 'absent' ? 'rgba(248, 113, 113, 0.15)' : status === 'od' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                                    color: status === 'present' ? 'var(--status-safe)' : status === 'absent' ? 'var(--status-critical)' : status === 'od' ? 'var(--status-warning)' : 'var(--status-announcement)'
                                  }}>
                                    {status.toUpperCase()}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOptionsStudent(student); }}
                                    className="btn-secondary"
                                    style={{ padding: 6, minWidth: 28, minHeight: 28 }}
                                  >
                                    <MoreVertical size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

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
            )}

            {activeTab === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '16px', background: 'rgba(20,24,38,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                    <div>
                      <h3 className="t-card-title" style={{ color: 'var(--text-primary)' }}>Spreadsheet Register</h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Tap cells to cycle status (P → A → O → M)</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', maxWidth: 180, width: '100%' }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                      <input
                        type="text"
                        className="input"
                        placeholder="Search student..."
                        value={spreadsheetSearch}
                        onChange={e => setSpreadsheetSearch(e.target.value)}
                        style={{ padding: '6px 10px 6px 30px', fontSize: 12, minHeight: 32 }}
                      />
                    </div>
                  </div>

                  {isSessionsLoading || isSpreadsheetMarkingsLoading || isStudentsLoading ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      Loading register matrix...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      No attendance sessions logged yet for this subject.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                            <th style={{
                              position: 'sticky', left: 0, background: 'var(--bg-elevated)', zIndex: 10,
                              borderRight: '2px solid var(--border-default)', padding: '10px 12px', textAlign: 'left', minWidth: 140
                            }}>Student</th>
                            {sortedSessions.map(s => {
                              const dateLabel = new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              return (
                                <th key={s.id} style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid var(--border-default)', minWidth: 80 }}>
                                  {dateLabel}
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal', marginTop: 2 }}>
                                    {s.target_batch ? `B-${s.target_batch}` : 'All'}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudentsForSpreadsheet.map(student => (
                            <tr key={student.id} style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                              <td style={{
                                position: 'sticky', left: 0, background: 'var(--bg-elevated)', zIndex: 10,
                                borderRight: '2px solid var(--border-default)', padding: '10px 12px', fontWeight: 600
                              }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                                  {student.name.split(' ')[0]} ({student.section_roll || '—'})
                                </div>
                              </td>
                              {sortedSessions.map(s => {
                                const isUpdating = updatingCell?.studentId === student.id && updatingCell?.sessionId === s.id;
                                const status = markingsMap.get(`${s.id}-${student.id}`) || 'present';
                                
                                // Check if student belongs to this session's batch
                                const isTargeted = !s.target_batch || s.target_batch === student.sub_batch;
                                
                                if (!isTargeted) {
                                  return (
                                    <td key={s.id} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid var(--border-default)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', fontSize: 11 }}>
                                      N/A
                                    </td>
                                  );
                                }

                                let color = '';
                                let bg = '';
                                let text = '';
                                if (status === 'present') { color = 'var(--status-safe)'; bg = 'rgba(52, 211, 153, 0.1)'; text = 'P'; }
                                else if (status === 'absent') { color = 'var(--status-critical)'; bg = 'rgba(248, 113, 113, 0.1)'; text = 'A'; }
                                else if (status === 'od') { color = 'var(--status-warning)'; bg = 'rgba(251, 191, 36, 0.1)'; text = 'O'; }
                                else if (status === 'makeup') { color = 'var(--status-announcement)'; bg = 'rgba(167, 139, 250, 0.1)'; text = 'M'; }

                                return (
                                  <td
                                    key={s.id}
                                    onClick={() => handleCellTap(student.id, s.id, status)}
                                    style={{
                                      padding: '8px', textAlign: 'center', borderRight: '1px solid var(--border-default)',
                                      cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s ease',
                                      backgroundColor: bg, color
                                    }}
                                  >
                                    {isUpdating ? (
                                      <Loader2 size={12} className="animate-spin" style={{ margin: '0 auto' }} />
                                    ) : (
                                      <span style={{ fontWeight: 'bold' }}>{text}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
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

            {activeTab === 'assignments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '16px', background: 'rgba(20,24,38,0.2)' }}>
                  <h3 className="t-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                    Assignment Progress
                  </h3>

                  {isAssignmentsLoading ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                      Loading assignments...
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="t-mono" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No assignments found for this subject in this section.
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
                            className="card animate-hover"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '14px',
                              background: 'rgba(20,24,38,0.1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              cursor: 'pointer',
                              border: '1px solid var(--border-default)',
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
              </div>
            )}
          </>
        )}
      </main>

      {/* --- Bulk Attendance Mark Sheet --- */}
      <BottomSheet
        open={bulkMenuOpen}
        onClose={() => setBulkMenuOpen(false)}
        title="Bulk Roster Marking"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t-caption" style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            Set all active roster students in this batch to the chosen status at once.
          </p>
          {[
            { status: 'present', label: 'Mark All Present', color: 'var(--status-safe)', bg: 'rgba(52, 211, 153, 0.1)' },
            { status: 'absent', label: 'Mark All Absent', color: 'var(--status-critical)', bg: 'rgba(248, 113, 113, 0.1)' },
            { status: 'od', label: 'Mark All On Duty (OD)', color: 'var(--status-warning)', bg: 'rgba(251, 191, 36, 0.1)' },
            { status: 'makeup', label: 'Mark All Makeup', color: 'var(--status-announcement)', bg: 'rgba(167, 139, 250, 0.1)' },
          ].map(opt => (
            <button
              key={opt.status}
              onClick={() => { setAllMarkings(opt.status as any); setBulkMenuOpen(false); toast.success(`Marked all as ${opt.status}`); }}
              className="list-row animate-hover"
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: opt.bg, border: 'none',
                color: opt.color, fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* --- Student Options Sheet (OD/Makeup selection) --- */}
      <BottomSheet
        open={!!optionsStudent}
        onClose={() => setOptionsStudent(null)}
        title={optionsStudent ? `Set Status: ${optionsStudent.name}` : ''}
      >
        {optionsStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="t-caption" style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Change status for {optionsStudent.name} (Roll: {optionsStudent.section_roll || '—'}).
            </p>
            {[
              { status: 'present', label: 'Present', color: 'var(--status-safe)', bg: 'rgba(52, 211, 153, 0.1)' },
              { status: 'absent', label: 'Absent', color: 'var(--status-critical)', bg: 'rgba(248, 113, 113, 0.1)' },
              { status: 'od', label: 'On Duty (OD)', color: 'var(--status-warning)', bg: 'rgba(251, 191, 36, 0.1)' },
              { status: 'makeup', label: 'Makeup Class', color: 'var(--status-announcement)', bg: 'rgba(167, 139, 250, 0.1)' },
            ].map(opt => (
              <button
                key={opt.status}
                onClick={() => { updateMarking(optionsStudent.id, opt.status as any); setOptionsStudent(null); }}
                className="list-row animate-hover"
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', background: opt.bg, border: 'none',
                  color: opt.color, fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                <span>{opt.label}</span>
                {localMarkings[optionsStudent.id] === opt.status && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

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
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
            }}>
              {editSessionMarkings.map(student => {
                const status = localEditMarkings[student.student_id] || 'present';
                const avatar = student.avatar_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(student.name)}`;
                
                let cardBorder = 'var(--border-default)';
                let cardBg = 'rgba(20, 24, 38, 0.15)';
                let avatarBorder = 'rgba(255, 255, 255, 0.1)';
                if (status === 'present') {
                  cardBorder = 'rgba(52, 211, 153, 0.4)';
                  cardBg = 'rgba(52, 211, 153, 0.05)';
                  avatarBorder = 'var(--status-safe)';
                } else if (status === 'absent') {
                  cardBorder = 'rgba(248, 113, 113, 0.4)';
                  cardBg = 'rgba(248, 113, 113, 0.05)';
                  avatarBorder = 'var(--status-critical)';
                } else if (status === 'od') {
                  cardBorder = 'rgba(251, 191, 36, 0.4)';
                  cardBg = 'rgba(251, 191, 36, 0.05)';
                  avatarBorder = 'var(--status-warning)';
                } else if (status === 'makeup') {
                  cardBorder = 'rgba(167, 139, 250, 0.4)';
                  cardBg = 'rgba(167, 139, 250, 0.05)';
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
                    }}
                  >
                    <img 
                      src={avatar} 
                      alt={student.name}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: `2px solid ${avatarBorder}`,
                        objectFit: 'cover',
                        marginBottom: '8px'
                      }}
                    />
                    <p className="t-mono-sm" style={{ fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {student.name.split(' ')[0]}
                    </p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                      Roll: {student.section_roll || '—'}
                    </p>

                    {/* Direct Select Badges */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
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
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              color,
                              backgroundColor: bg,
                              cursor: 'pointer',
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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
                  boxShadow: '0 4px 16px rgba(248, 113, 113, 0.30)',
                  border: 'none'
                }}
              >
                {cancelClassMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send Alert
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* --- 4. Course Linking Sheet --- */}
      {showLinkSubjectsDrawer && authUser && (
        <LinkSubjectsSheet
          open={showLinkSubjectsDrawer}
          onClose={() => setShowLinkSubjectsDrawer(false)}
          teacherId={authUser.id}
          sectionId={selectedSectionId || (sections[0]?.id || '')}
          linkedSubjects={mappings}
          refetchLinked={() => {
            qc.invalidateQueries({ queryKey: ['teacher-mappings', authUser.id] });
          }}
        />
      )}

      <NavBar />
    </div>
  );
}

interface LinkSubjectsSheetProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  sectionId: string;
  linkedSubjects: any[];
  refetchLinked: () => void;
}

function LinkSubjectsSheet({ open, onClose, teacherId, sectionId, linkedSubjects, refetchLinked }: LinkSubjectsSheetProps) {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [globalChecked, setGlobalChecked] = useState<Record<string, boolean>>({});

  const { data: sectionSubjects = [] } = useQuery({
    queryKey: ['subjects-for-linking-dash', sectionId],
    queryFn: async () => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('section_id', sectionId)
        .order('code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId && open,
  });

  const handleToggleSubject = async (subjectId: string, subjectCode: string, currentLinked: boolean) => {
    setLoadingMap(prev => ({ ...prev, [subjectId]: true }));
    try {
      const applyAll = !!globalChecked[subjectId];

      if (currentLinked) {
        // Unlink
        // 1. Delete for current section
        const { error: delErr } = await supabase
          .from('section_teachers')
          .delete()
          .eq('section_id', sectionId)
          .eq('teacher_id', teacherId)
          .eq('subject_id', subjectId);
        if (delErr) throw delErr;

        // 2. If applyAll, find sections taught by teacher and delete subject with same code
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== sectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const matchSubjectIds = matchSubjects.map(ms => ms.id);
              await supabase
                .from('section_teachers')
                .delete()
                .eq('teacher_id', teacherId)
                .in('subject_id', matchSubjectIds);
            }
          }
        }
        toast.success('Subject unlinked ✓');
      } else {
        // Link
        // 1. Insert for current section
        const { error: insErr } = await supabase
          .from('section_teachers')
          .insert({
            section_id: sectionId,
            teacher_id: teacherId,
            subject_id: subjectId
          });
        if (insErr) throw insErr;

        // 2. If applyAll, find sections taught by teacher and insert subject with same code
        if (applyAll) {
          const { data: stData } = await supabase
            .from('section_teachers')
            .select('section_id')
            .eq('teacher_id', teacherId);
          const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== sectionId)));

          if (otherSections.length > 0) {
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', subjectCode)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const insertRows = matchSubjects.map(ms => ({
                section_id: ms.section_id,
                teacher_id: teacherId,
                subject_id: ms.id
              }));
              await supabase.from('section_teachers').insert(insertRows);
            }
          }
        }
        toast.success('Subject linked ✓');
      }
      refetchLinked();
    } catch (err: any) {
      toast.error('Failed to link subject: ' + err.message);
    } finally {
      setLoadingMap(prev => ({ ...prev, [subjectId]: false }));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Link Subjects">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sectionSubjects.length === 0 ? (
          <p className="t-body" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
            No subjects found in this section.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
            {sectionSubjects.map(subject => {
              const isLinked = linkedSubjects.some(ls => ls.subject_id === subject.id);
              const isLoading = !!loadingMap[subject.id];
              const isGlobal = !!globalChecked[subject.id];

              return (
                <div key={subject.id} style={{
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: isLoading ? 0.6 : 1,
                  pointerEvents: isLoading ? 'none' : 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isLinked}
                      disabled={isLoading}
                      onChange={() => handleToggleSubject(subject.id, subject.code, isLinked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          padding: '1px 5px', borderRadius: 4, background: `${subject.accent}20`,
                          color: subject.accent, fontSize: 10, fontWeight: 600, fontFamily: 'monospace'
                        }}>{subject.code}</span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sem {subject.semester}</span>
                      </div>
                      <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>{subject.name}</p>
                    </div>
                  </div>

                  {isLinked && (
                    <div style={{
                      paddingTop: 6,
                      borderTop: '1px dashed var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isGlobal}
                          onChange={() => setGlobalChecked(prev => ({ ...prev, [subject.id]: !prev[subject.id] }))}
                          style={{ width: 13, height: 13, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                        />
                        <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Apply globally to all my sections</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%', padding: '12px' }}
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
