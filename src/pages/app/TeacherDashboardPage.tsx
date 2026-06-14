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

export default function TeacherDashboardPage() {
  const authUser = useAppStore(s => s.authUser);

  // Active Tab: 'mark' or 'logs'
  const [activeTab, setActiveTab] = useState<'mark' | 'logs'>('mark');

  // 1. Fetch sections and subjects taught by this teacher
  const { data: mappings = [], isLoading: isMappingsLoading } = useQuery<SectionTeacherRow[]>({
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
    if (!selectedSectionId) return [];
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
  const { data: students = [], isLoading: isStudentsLoading } = useQuery({
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
  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
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
  const { data: sessions = [], isLoading: isSessionsLoading } = useTeacherSessions(selectedSectionId, selectedSubjectId);

  // --- Attendance Marking Form States ---
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timetableSlotId, setTimetableSlotId] = useState<string>('extra');
  const [extraLabel, setExtraLabel] = useState<string>('');
  const [targetBatch, setTargetBatch] = useState<'All' | '1' | '2'>('All');
  const [lectureCount, setLectureCount] = useState<number>(1);
  const [localMarkings, setLocalMarkings] = useState<Record<string, 'present' | 'absent' | 'od' | 'makeup'>>({});

  // Filter students based on active batch
  const visibleStudents = useMemo(() => {
    if (targetBatch === 'All') return students;
    return students.filter(s => s.sub_batch === targetBatch);
  }, [students, targetBatch]);

  // Reset markings to present when students list or targetBatch changes
  useEffect(() => {
    const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {};
    visibleStudents.forEach(s => {
      markings[s.id] = 'present';
    });
    setLocalMarkings(markings);
  }, [visibleStudents]);

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
  const { data: editSessionMarkings = [], isLoading: isEditSessionLoading } = useSessionDetails(editingSessionId || '', selectedSectionId);
  const [localEditMarkings, setLocalEditMarkings] = useState<Record<string, 'present' | 'absent' | 'od' | 'makeup'>>({});

  // Populate local edit markings when fetched
  useEffect(() => {
    if (editSessionMarkings.length > 0) {
      const markings: Record<string, 'present' | 'absent' | 'od' | 'makeup'> = {};
      editSessionMarkings.forEach(m => {
        markings[m.student_id] = m.status;
      });
      setLocalEditMarkings(markings);
    }
  }, [editSessionMarkings]);

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
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 p-4 backdrop-blur-md">
        <div>
          <p className="font-mono text-xs font-bold tracking-wider text-blue-500 uppercase">
            Teacher Console
          </p>
          <h1 className="font-display text-xl font-bold text-white mt-1">
            Welcome, {authUser?.name ? authUser.name.split(' ')[0] : 'Professor'} 🎓
          </h1>
        </div>
        <button 
          onClick={() => setAlertOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1.5 text-xs font-semibold text-red-400 cursor-pointer hover:bg-red-950/60"
        >
          <Bell size={13} /> Cancel Lecture
        </button>
      </header>

      <main className="page-content p-4 pb-24 flex flex-col gap-5">
        {isMappingsLoading ? (
          <div className="text-center py-12 text-slate-500 font-mono">
            Loading teacher configurations...
          </div>
        ) : sections.length === 0 ? (
          <div className="card text-center p-8 border border-slate-800 rounded-2xl bg-slate-900/30">
            <AlertCircle size={36} className="mx-auto mb-3 text-slate-600" />
            <h3 className="font-display text-base font-bold text-white mb-2">No Joined Sections</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto mb-4">
              You haven't joined any section hubs. Get a Teacher Invite Code from a CR to register.
            </p>
          </div>
        ) : (
          <>
            {/* Mappings selector card */}
            <div className="card p-4 flex flex-col gap-4 border border-slate-800 rounded-2xl bg-slate-900/20">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                    Active Section
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={e => { setSelectedSectionId(e.target.value); }}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
                  >
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                    Course Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
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
            <div className="flex border-b border-slate-800">
              <button 
                onClick={() => setActiveTab('mark')}
                className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 cursor-pointer transition-colors ${activeTab === 'mark' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500'}`}
              >
                Mark Attendance
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 cursor-pointer transition-colors ${activeTab === 'logs' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500'}`}
              >
                Attendance Log ({sessions.length})
              </button>
            </div>

            {/* Content Tabs */}
            {activeTab === 'mark' ? (
              <div className="flex flex-col gap-4">
                {/* Session Configurations Card */}
                <div className="card p-4 flex flex-col gap-4 border border-slate-800 rounded-2xl bg-slate-900/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                        Session Date
                      </label>
                      <input 
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                        Timetable Period
                      </label>
                      <select
                        value={timetableSlotId}
                        onChange={e => setTimetableSlotId(e.target.value)}
                        className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
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
                      <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                        Unscheduled Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Extra Lab Session, Zero Period"
                        value={extraLabel}
                        onChange={e => setExtraLabel(e.target.value)}
                        className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                    <div>
                      <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                        Target Batch
                      </label>
                      <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850">
                        {(['All', '1', '2'] as const).map(b => (
                          <button
                            key={b}
                            onClick={() => setTargetBatch(b)}
                            className={`flex-1 py-1 rounded text-xs font-semibold cursor-pointer ${targetBatch === b ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}
                          >
                            {b === 'All' ? 'All Section' : `Batch ${b}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                        Session Weight
                      </label>
                      <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850">
                        {([1, 2] as const).map(w => (
                          <button
                            key={w}
                            onClick={() => setLectureCount(w)}
                            className={`flex-1 py-1 rounded text-xs font-semibold cursor-pointer ${lectureCount === w ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}
                          >
                            {w} Period{w > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Attendance Marking Grid */}
                <div className="card p-4 border border-slate-800 rounded-2xl bg-slate-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                        <Users size={16} className="text-blue-500" />
                        Visual Register Grid
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Choose P/A/OD/M statuses for students.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAllMarkings('present')}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white"
                      >
                        All Present
                      </button>
                      <button 
                        onClick={() => setAllMarkings('absent')}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white"
                      >
                        All Absent
                      </button>
                    </div>
                  </div>

                  {isStudentsLoading || isAttendanceLoading ? (
                    <div className="text-center py-12 text-slate-500 font-mono">
                      Loading student roster...
                    </div>
                  ) : visibleStudents.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 font-mono text-sm">
                      No students found in this batch.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 max-h-[380px] overflow-y-auto p-1 border border-slate-900/50 rounded-xl bg-slate-950/20">
                        {visibleStudents.map(student => {
                          const status = localMarkings[student.id] || 'present';
                          const avatar = student.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}`;
                          
                          let cardBorder = 'border-slate-800';
                          let avatarBorder = 'border-slate-800';
                          if (status === 'present') {
                            cardBorder = 'border-emerald-500/20 bg-emerald-950/5';
                            avatarBorder = 'border-emerald-500';
                          } else if (status === 'absent') {
                            cardBorder = 'border-red-500/25 bg-red-950/5';
                            avatarBorder = 'border-red-500';
                          } else if (status === 'od') {
                            cardBorder = 'border-amber-500/20 bg-amber-950/5';
                            avatarBorder = 'border-amber-500';
                          } else if (status === 'makeup') {
                            cardBorder = 'border-purple-500/20 bg-purple-950/5';
                            avatarBorder = 'border-purple-500';
                          }

                          return (
                            <div 
                              key={student.id} 
                              className={`flex flex-col items-center p-3 border rounded-xl relative transition-all ${cardBorder}`}
                            >
                              <img 
                                src={avatar} 
                                alt={student.name}
                                className={`w-11 h-11 rounded-full border-2 object-cover mb-2 ${avatarBorder}`}
                              />
                              <p className="font-mono text-xs font-bold text-white text-center line-clamp-1 w-full px-1">
                                {student.name.split(' ')[0]}
                              </p>
                              <p className="font-mono text-[9px] text-slate-500 mt-0.5">
                                Roll: {student.section_roll || '—'}
                              </p>

                              {/* Direct Select Badges */}
                              <div className="flex gap-1.5 mt-2.5">
                                {(['present', 'absent', 'od', 'makeup'] as const).map(st => {
                                  const isActive = status === st;
                                  let colorClasses = '';
                                  if (st === 'present') colorClasses = isActive ? 'bg-emerald-500 text-white font-bold' : 'text-emerald-500 bg-emerald-950/20 hover:bg-emerald-900/20';
                                  else if (st === 'absent') colorClasses = isActive ? 'bg-red-500 text-white font-bold' : 'text-red-500 bg-red-950/20 hover:bg-red-900/20';
                                  else if (st === 'od') colorClasses = isActive ? 'bg-amber-500 text-white font-bold' : 'text-amber-500 bg-amber-950/20 hover:bg-amber-900/20';
                                  else if (st === 'makeup') colorClasses = isActive ? 'bg-purple-500 text-white font-bold' : 'text-purple-500 bg-purple-950/20 hover:bg-purple-900/20';

                                  return (
                                    <button
                                      key={st}
                                      onClick={() => updateMarking(student.id, st)}
                                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] cursor-pointer transition-all ${colorClasses}`}
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
                      <div className="flex items-center justify-between border-t border-slate-900 pt-4 mt-4">
                        <div className="flex gap-3 text-xs font-mono">
                          <span className="text-emerald-500 font-bold">{presentCount} P</span>
                          <span className="text-red-500 font-bold">{absentCount} A</span>
                          <span className="text-amber-500 font-bold">{odCount} O</span>
                          <span className="text-purple-500 font-bold">{makeupCount} M</span>
                        </div>

                        <button
                          onClick={handleMarkSubmit}
                          disabled={logAttendanceMut.isPending || visibleStudents.length === 0}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-5 py-2.5 text-xs font-semibold text-white cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex flex-col gap-4">
                {isSessionsLoading ? (
                  <div className="text-center py-12 text-slate-500 font-mono">
                    Loading session history...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-mono text-sm">
                    No sessions logged yet for this subject.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {sessions.map(session => {
                      const formattedDate = new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                      const slotLabel = session.timetable_slot_id 
                        ? subjectSlots.find(s => s.id === session.timetable_slot_id)?.label || 'Regular Slot'
                        : 'Unscheduled Session';

                      return (
                        <div key={session.id} className="card p-3 border border-slate-800 rounded-xl bg-slate-900/10 flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-1 min-w-0">
                            <h4 className="font-mono text-xs font-bold text-white flex items-center gap-2">
                              {formattedDate} 
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                                {session.lecture_count}x weight
                              </span>
                              {session.target_batch && (
                                <span className="rounded bg-blue-950/50 text-blue-400 px-1.5 py-0.5 text-[9px] font-bold">
                                  Batch {session.target_batch}
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              Slot: {slotLabel}
                            </p>
                            <div className="flex gap-2 text-[9px] font-mono text-slate-400 mt-1">
                              <span className="text-emerald-500">{session.present_count} P</span>
                              <span>•</span>
                              <span className="text-red-500">{session.absent_count} A</span>
                              <span>•</span>
                              <span className="text-amber-500">{session.od_count} O</span>
                              <span>•</span>
                              <span className="text-purple-500">{session.makeup_count} M</span>
                            </div>
                          </div>

                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => { setEditingSessionId(session.id); setEditOpen(true); }}
                              className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer hover:bg-slate-900"
                              title="Edit Register"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-2 border border-slate-800 rounded-lg text-red-500/80 hover:text-red-400 cursor-pointer hover:bg-slate-900"
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
            <div className="card p-4 border border-slate-800 rounded-2xl bg-slate-900/10 mt-2">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5 mb-4">
                <BookOpen size={16} className="text-blue-500" />
                Assignment Submissions Tracker
              </h3>

              {isAssignmentsLoading ? (
                <div className="text-center py-6 text-slate-500 font-mono">
                  Loading assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-mono text-xs">
                  No assignments created by you in this section.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {assignments.map(ass => {
                    const submissionsCount = ass.submissions?.length || 0;
                    const totalStudents = students.length;
                    const percent = totalStudents > 0 ? Math.round((submissionsCount / totalStudents) * 100) : 0;

                    return (
                      <button
                        key={ass.id}
                        onClick={() => { setActiveAssignmentId(ass.id); setSubmissionsOpen(true); }}
                        className="w-full text-left card border border-slate-850 p-3.5 rounded-xl bg-slate-900/5 hover:border-slate-800 transition-all cursor-pointer flex flex-col gap-2.5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-mono text-xs font-bold text-white leading-tight">
                              {ass.title}
                            </h4>
                            <p className="font-mono text-[9px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock size={10} /> Due: {new Date(ass.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className="font-mono text-xs font-bold text-blue-500 flex-shrink-0">
                            {submissionsCount}/{totalStudents} ({percent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${percent}%` }}
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
          <div className="flex items-center gap-2">
            <Edit3 size={15} className="text-blue-500" />
            <span className="font-display text-sm font-bold text-white">Edit Historical Register</span>
          </div>
        }
      >
        {isEditSessionLoading ? (
          <div className="text-center py-12 text-slate-500 font-mono">
            Loading registers...
          </div>
        ) : editSessionMarkings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            No students records to load.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 max-h-[300px] overflow-y-auto p-1 border border-slate-900/50 rounded-xl bg-slate-950/20">
              {editSessionMarkings.map(student => {
                const status = localEditMarkings[student.student_id] || 'present';
                const avatar = student.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}`;
                
                let cardBorder = 'border-slate-800';
                let avatarBorder = 'border-slate-800';
                if (status === 'present') {
                  cardBorder = 'border-emerald-500/20 bg-emerald-950/5';
                  avatarBorder = 'border-emerald-500';
                } else if (status === 'absent') {
                  cardBorder = 'border-red-500/25 bg-red-950/5';
                  avatarBorder = 'border-red-500';
                } else if (status === 'od') {
                  cardBorder = 'border-amber-500/20 bg-amber-950/5';
                  avatarBorder = 'border-amber-500';
                } else if (status === 'makeup') {
                  cardBorder = 'border-purple-500/20 bg-purple-950/5';
                  avatarBorder = 'border-purple-500';
                }

                return (
                  <div 
                    key={student.student_id} 
                    className={`flex flex-col items-center p-3 border rounded-xl relative transition-all ${cardBorder}`}
                  >
                    <img 
                      src={avatar} 
                      alt={student.name}
                      className={`w-10 h-10 rounded-full border-2 object-cover mb-2 ${avatarBorder}`}
                    />
                    <p className="font-mono text-xs font-bold text-white text-center line-clamp-1 w-full px-1">
                      {student.name.split(' ')[0]}
                    </p>
                    <p className="font-mono text-[9px] text-slate-500 mt-0.5">
                      Roll: {student.section_roll || '—'}
                    </p>

                    {/* Direct Select Badges */}
                    <div className="flex gap-1.5 mt-2">
                      {(['present', 'absent', 'od', 'makeup'] as const).map(st => {
                        const isActive = status === st;
                        let colorClasses = '';
                        if (st === 'present') colorClasses = isActive ? 'bg-emerald-500 text-white font-bold' : 'text-emerald-500 bg-emerald-950/20 hover:bg-emerald-900/20';
                        else if (st === 'absent') colorClasses = isActive ? 'bg-red-500 text-white font-bold' : 'text-red-500 bg-red-950/20 hover:bg-red-900/20';
                        else if (st === 'od') colorClasses = isActive ? 'bg-amber-500 text-white font-bold' : 'text-amber-500 bg-amber-950/20 hover:bg-amber-900/20';
                        else if (st === 'makeup') colorClasses = isActive ? 'bg-purple-500 text-white font-bold' : 'text-purple-500 bg-purple-950/20 hover:bg-purple-900/20';

                        return (
                          <button
                            key={st}
                            onClick={() => setLocalEditMarkings(prev => ({ ...prev, [student.student_id]: st }))}
                            className={`w-5.5 h-5.5 rounded-md flex items-center justify-center text-[9px] cursor-pointer transition-all ${colorClasses}`}
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
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 py-3 text-xs font-semibold text-white cursor-pointer hover:bg-blue-600 disabled:opacity-50"
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
          <div className="flex items-center justify-between w-full pr-8">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-blue-500" />
              <span className="font-display text-sm font-bold text-white truncate max-w-[180px]">
                {selectedAssignment?.title}
              </span>
            </div>
            <button
              onClick={handleNudgeAllPending}
              className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-[10px] font-bold text-amber-500 cursor-pointer hover:bg-amber-500/20"
            >
              <Bell size={10} /> Nudge Pending
            </button>
          </div>
        }
      >
        {selectedAssignment ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {students.map(student => {
                const sub = (selectedAssignment.submissions || []).find(s => s.student_id === student.id);
                const hasSubmitted = sub && sub.status === 'submitted';

                return (
                  <div key={student.id} className="flex items-center justify-between border border-slate-900 p-2.5 rounded-lg bg-slate-900/5">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-white block truncate">
                        {student.name}
                      </span>
                      <span className="font-mono text-[9px] text-slate-500">
                        Roll: {student.section_roll || '—'}
                      </span>
                    </div>

                    {hasSubmitted && sub.submission_link ? (
                      <a
                        href={sub.submission_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-blue-500/10 border border-blue-500/25 px-3 py-1.5 text-[10px] font-bold text-blue-400 no-underline hover:bg-blue-500/20"
                      >
                        Open Submission
                      </a>
                    ) : (
                      <span className="rounded bg-slate-800/40 px-3 py-1.5 text-[10px] font-bold text-slate-500 font-mono">
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
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-red-500" />
            <span className="font-display text-sm font-bold text-white">Broadcast Lecture Alert</span>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400 leading-normal">
            Broadcast a critical notice regarding cancellation or reschedule of today's slots. Students will be notified instantly via push notifications.
          </p>

          <div>
            <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
              Slot to Cancel
            </label>
            <select
              value={alertSlotId}
              onChange={e => setAlertSlotId(e.target.value)}
              className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
            >
              <option value="">Choose timetable slot...</option>
              {subjectSlots.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">
                Target Batch
              </label>
              <select
                value={alertBatch}
                onChange={e => setAlertBatch(e.target.value as any)}
                className="w-full rounded-lg border border-slate-850 bg-slate-900 p-2 text-sm text-white focus:outline-none"
              >
                <option value="All">All Section</option>
                <option value="1">Batch 1</option>
                <option value="2">Batch 2</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleBroadcastCancellation}
                disabled={cancelClassMut.isPending || !alertSlotId}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-500 py-2.5 text-xs font-semibold text-white cursor-pointer hover:bg-red-600 disabled:opacity-50"
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
