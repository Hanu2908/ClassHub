import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { NavBar } from '../../components/NavBar';
import { 
  Users, Check, X, Copy, Bell, 
  BookOpen, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

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
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);

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

  // Extract distinct sections and subjects mapping
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
  useMemo(() => {
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

  useMemo(() => {
    if (subjectsForSelectedSection.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjectsForSelectedSection[0].id);
    } else if (subjectsForSelectedSection.length > 0 && !subjectsForSelectedSection.find(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectsForSelectedSection[0].id);
    }
  }, [subjectsForSelectedSection, selectedSubjectId]);

  const selectedSubjectCode = useMemo(() => {
    return subjectsForSelectedSection.find(s => s.id === selectedSubjectId)?.code || '';
  }, [subjectsForSelectedSection, selectedSubjectId]);

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

  // 3. Fetch cumulative attendance records for this section & subject
  const { data: attendanceRecords = [], isLoading: isAttendanceLoading } = useQuery({
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

  // 4. Fetch assignments created by this teacher for submission tracking
  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments', authUser?.id, selectedSectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, subject_id, target_batch,
          submissions (id, student_id, submitted_link)
        `)
        .eq('created_by', authUser?.id || '')
        .eq('section_id', selectedSectionId)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id && !!selectedSectionId,
  });

  // Attendance Marking State (Local overrides)
  const [markedPresent, setMarkedPresent] = useState<Record<string, boolean>>({});

  // Initialize markedPresent to true (all present) for all students when selection changes
  useMemo(() => {
    const states: Record<string, boolean> = {};
    students.forEach(s => {
      states[s.id] = true;
    });
    setMarkedPresent(states);
  }, [students]);

  const toggleStudent = (studentId: string) => {
    setMarkedPresent(prev => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Submit Attendance session mutation
  const submitAttendance = useMutation({
    mutationFn: async () => {
      if (!selectedSubjectId) throw new Error('Subject not selected');
      
      const upsertRows = students.map(student => {
        const existing = attendanceRecords.find(r => r.user_id === student.id) || { present: 0, absent: 0, od: 0, makeup: 0 };
        const isPresent = markedPresent[student.id] ?? true;
        
        return {
          user_id: student.id,
          subject_id: selectedSubjectId,
          present: existing.present + (isPresent ? 1 : 0),
          absent: existing.absent + (isPresent ? 0 : 1),
          od: existing.od,
          makeup: existing.makeup,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('attendance_records')
        .upsert(upsertRows, { onConflict: 'user_id,subject_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Attendance session logged successfully! ✓');
      qc.invalidateQueries({ queryKey: ['section-attendance', selectedSectionId, selectedSubjectId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit attendance');
    }
  });

  // Nudge Absentees Mutation
  const nudgeAbsentees = useMutation({
    mutationFn: async () => {
      const absentees = students.filter(s => !markedPresent[s.id]);
      if (absentees.length === 0) {
        toast.info('No students marked absent to nudge!');
        return;
      }

      const notificationsToInsert = absentees.map(s => {
        const existing = attendanceRecords.find(r => r.user_id === s.id) || { present: 0, absent: 0, od: 0, makeup: 0 };
        // calculate tentative attendance percent after this logged session
        const nextAttended = existing.present + existing.od + existing.makeup;
        const nextTotal = existing.present + existing.od + existing.makeup + existing.absent + 1;
        const nextPercent = nextTotal > 0 ? Math.round((nextAttended / nextTotal) * 100) : 0;

        return {
          section_id: selectedSectionId,
          recipient_id: s.id,
          actor_id: authUser?.id,
          kind: 'ack_nudge' as const,
          status: 'sent' as const,
          title: 'Attendance Alert 🚨',
          body: `You were marked absent in ${selectedSubjectCode} today. Your aggregate attendance is now ${nextPercent}%.`,
          created_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('notification_events')
        .insert(notificationsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Nudge notifications dispatched to absentees! 🔔');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send nudges');
    }
  });

  // ERP Copy Formats Utilities
  const copyErpPAColumn = () => {
    // Generate a list of P or A matching the roll order
    const text = students.map(s => (markedPresent[s.id] ?? true) ? 'P' : 'A').join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied P/A column format! (Tab/Excel ready)');
  };

  const copyAbsentRollNumbers = () => {
    const absentees = students
      .filter(s => !(markedPresent[s.id] ?? true))
      .map(s => {
        const rollNum = s.section_roll || '??';
        return parseInt(rollNum, 10).toString(); // remove leading zeros if preferred, e.g. "03" -> "3"
      });
    
    if (absentees.length === 0) {
      toast.info('No students marked absent.');
      return;
    }

    const text = absentees.join(', ');
    navigator.clipboard.writeText(text);
    toast.success(`Copied absent roll list: ${text}`);
  };

  const presentCount = useMemo(() => {
    return Object.values(markedPresent).filter(Boolean).length;
  }, [markedPresent]);

  const absentCount = students.length - presentCount;

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, fontSize: 11 }}>
            Teacher Dashboard
          </p>
          <h1 className="t-feature" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: 4 }}>
            Welcome, {authUser?.name ? authUser.name.split(' ')[0] : 'Professor'} 🎓
          </h1>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: 100 }}>
        {isMappingsLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Loading teaching mapping data...
          </div>
        ) : sections.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32, margin: '24px 16px' }}>
            <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Scoped Sections Found</h3>
            <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              You haven't joined any section hubs. Get a Teacher Invite Code from a CR to register.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px' }}>
            {/* Section & Subject Selectors */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    ACTIVE SECTION
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={e => { setSelectedSectionId(e.target.value); setMarkedPresent({}); }}
                    className="input"
                    style={{ fontSize: 14, padding: '8px 12px' }}
                  >
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    COURSE SUBJECT
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    className="input"
                    style={{ fontSize: 14, padding: '8px 12px' }}
                    disabled={subjectsForSelectedSection.length === 0}
                  >
                    {subjectsForSelectedSection.map(subj => (
                      <option key={subj.id} value={subj.id}>{subj.name} ({subj.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSectionId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
                  <span className="t-caption" style={{ color: 'var(--text-muted)' }}>
                    Student Invite Code: <strong className="t-mono" style={{ color: 'var(--text-secondary)' }}>{sections.find(s => s.id === selectedSectionId)?.inviteCode || '—'}</strong>
                  </span>
                  <span className="t-caption" style={{ color: 'var(--text-muted)' }}>
                    Teacher Invite Code: <strong className="t-mono" style={{ color: 'var(--text-secondary)' }}>{sections.find(s => s.id === selectedSectionId)?.teacherInviteCode || '—'}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Attendance Marking Session */}
            {selectedSubjectId && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 className="t-card-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={18} color="var(--accent-primary)" />
                      Visual Attendance Sheet
                    </h3>
                    <p className="t-caption" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                      Defaults all present. Tap any avatar to toggle present/absent.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="t-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-safe)' }}>{presentCount} P</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>•</span>
                    <span className="t-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-critical)' }}>{absentCount} A</span>
                  </div>
                </div>

                {isStudentsLoading || isAttendanceLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    Loading student list...
                  </div>
                ) : students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    No students found in this section hub.
                  </div>
                ) : (
                  <>
                    {/* Visual Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: 12,
                      maxHeight: '400px',
                      overflowY: 'auto',
                      padding: '4px',
                      marginBottom: 20,
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.01)'
                    }}>
                      {students.map(student => {
                        const isPresent = markedPresent[student.id] ?? true;
                        const avatar = student.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}`;
                        const existing = attendanceRecords.find(r => r.user_id === student.id);
                        const aggPercent = existing && existing.percentage !== null ? Math.round(existing.percentage) : 100;

                        return (
                          <button
                            key={student.id}
                            onClick={() => toggleStudent(student.id)}
                            style={{
                              background: isPresent ? 'rgba(52, 201, 123, 0.04)' : 'rgba(239, 68, 68, 0.06)',
                              border: isPresent ? '1px solid rgba(52, 201, 123, 0.2)' : '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: 'var(--radius-md)',
                              padding: '12px 8px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none',
                            }}
                          >
                            {/* Avatar */}
                            <div style={{
                              position: 'relative',
                              width: 44,
                              height: 44,
                              marginBottom: 8,
                            }}>
                              <img
                                src={avatar}
                                alt={student.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  border: isPresent ? '2px solid var(--status-safe)' : '2px solid var(--status-critical)',
                                  objectFit: 'cover',
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: -2, right: -2,
                                width: 16, height: 16,
                                borderRadius: '50%',
                                background: isPresent ? 'var(--status-safe)' : 'var(--status-critical)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1.5px solid var(--bg-base)',
                                color: '#fff'
                              }}>
                                {isPresent ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                              </div>
                            </div>

                            {/* Name & Roll */}
                            <span className="t-mono-sm" style={{
                              fontWeight: 700, color: 'var(--text-primary)',
                              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                              overflow: 'hidden', wordBreak: 'break-all', fontSize: 11
                            }}>
                              {student.name.split(' ')[0]}
                            </span>
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
                              Roll: {student.section_roll || '—'}
                            </span>
                            {/* Aggregate attendance */}
                            <span className="t-mono-sm" style={{
                              fontSize: 9,
                              color: aggPercent < 75 ? 'var(--status-critical)' : 'var(--text-muted)',
                              marginTop: 4,
                              background: aggPercent < 75 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                              padding: '1px 4px',
                              borderRadius: 4
                            }}>
                              Agg: {aggPercent}%
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Operations Console */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                          onClick={copyErpPAColumn}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, height: 42 }}
                        >
                          <Copy size={14} /> Copy P/A Column
                        </button>
                        <button
                          onClick={copyAbsentRollNumbers}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, height: 42 }}
                        >
                          <X size={14} color="var(--status-critical)" /> Copy Absentees
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                          onClick={() => nudgeAbsentees.mutate()}
                          disabled={nudgeAbsentees.isPending || absentCount === 0}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, height: 42 }}
                        >
                          {nudgeAbsentees.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Nudge Absentees
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to log attendance? This will increment the lecture count of ${students.length} students by 1.`)) {
                              submitAttendance.mutate();
                            }
                          }}
                          disabled={submitAttendance.isPending}
                          className="btn-primary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, height: 42 }}
                        >
                          {submitAttendance.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Submit Session
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Course Submission Tracking */}
            <div className="card" style={{ padding: 20 }}>
              <h3 className="t-card-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BookOpen size={18} color="var(--accent-primary)" />
                Assignment Submissions Tracker
              </h3>

              {isAssignmentsLoading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Loading assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', fontSize: 13 }}>
                  No assignments created by you in this section.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {assignments.map(ass => {
                    const submissionsCount = ass.submissions?.length || 0;
                    const totalStudents = students.length;
                    const percent = totalStudents > 0 ? Math.round((submissionsCount / totalStudents) * 100) : 0;

                    return (
                      <div key={ass.id} style={{
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 14,
                        background: 'rgba(255,255,255,0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 className="t-card-title" style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
                              {ass.title}
                            </h4>
                            <p className="t-caption" style={{ color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={12} /> Due: {new Date(ass.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className="t-mono-sm" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                            {submissionsCount}/{totalStudents} ({percent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                          height: 4,
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 2,
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: 'var(--accent-primary)',
                            borderRadius: 2,
                            boxShadow: '0 0 8px var(--accent-primary-glow)'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <NavBar />
    </div>
  );
}
