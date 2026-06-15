import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { NavBar } from '../../components/NavBar';
import { 
  Users, AlertTriangle, ShieldAlert, FileText, Save, 
  Search, User, Mail, Loader2, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  section_roll: string | null;
  university_roll: string | null;
  sub_batch: string | null;
}

interface AttendanceRecord {
  user_id: string;
  subject_id: string;
  present: number;
  absent: number;
  od: number;
  makeup: number;
  percentage: number;
  subjects: {
    name: string;
    code: string;
  } | null;
}

interface CounsellorNote {
  id: string;
  student_id: string;
  note_text: string;
  student_response: string | null;
  student_response_updated_at: string | null;
  counsellor_remark_updated_at: string | null;
  created_at: string;
}

export default function CounsellorConsolePage() {
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const counsellorBatch = authUser?.isCounsellorForBatch || '1'; // Default to 1

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // 1. Fetch section information
  const { data: sectionInfo } = useQuery({
    queryKey: ['section-info', authUser?.sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('name')
        .eq('id', authUser?.sectionId || '')
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.sectionId,
  });

  // 2. Fetch all students in the counsellor's batch (e.g. batch '1' or '2')
  const { data: students = [], isLoading: isStudentsLoading } = useQuery<StudentProfile[]>({
    queryKey: ['counsellor-batch-students', authUser?.sectionId, counsellorBatch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, section_roll, university_roll, sub_batch')
        .eq('section_id', authUser?.sectionId || '')
        .eq('sub_batch', counsellorBatch)
        .order('section_roll', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.sectionId,
  });

  // 3. Fetch all attendance records for these batch students
  const studentIds = useMemo(() => students.map(s => s.id), [students]);
  const { data: attendanceRecords = [], isLoading: isAttendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['batch-students-attendance', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          user_id, subject_id, present, absent, od, makeup, percentage,
          subjects:subject_id (name, code)
        `)
        .in('user_id', studentIds);
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: studentIds.length > 0,
  });

  // 4. Fetch counsellor remarks/notes
  const { data: counsellorNotes } = useQuery<CounsellorNote[]>({
    queryKey: ['counsellor-remarks', authUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('counsellor_notes')
        .select('id, student_id, note_text, student_response, student_response_updated_at, counsellor_remark_updated_at, created_at')
        .eq('counsellor_id', authUser?.id || '');
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!authUser?.id,
  });

  // Compute student-wise overall and subject-wise metrics
  const processedStudents = useMemo(() => {
    return students.map(student => {
      const records = attendanceRecords.filter(r => r.user_id === student.id);
      
      let totalPresent = 0;
      let totalHeld = 0;
      const subjectsBelow75: string[] = [];

      records.forEach(r => {
        const attended = r.present + r.od + r.makeup;
        const total = r.present + r.od + r.absent;
        totalPresent += attended;
        totalHeld += total;

        const subPct = r.percentage ?? (total > 0 ? (attended / total) * 100 : 0);
        if (total > 0 && subPct < 75) {
          subjectsBelow75.push(`${r.subjects?.code || 'Sub'}: ${Math.round(subPct)}%`);
        }
      });

      const overallPercent = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 100;
      const hasLowAggregate = totalHeld > 0 && overallPercent < 75;
      
      // Determine severity score for sorting:
      // Aggregate < 75% is high priority (score = 100 + aggregate gap)
      // Subject-wise < 75% is medium priority (score = number of low subjects)
      // Normal aggregate/subject is lowest (score = 0)
      let alertPriority = 0;
      if (hasLowAggregate) {
        alertPriority = 100 + (75 - overallPercent);
      } else if (subjectsBelow75.length > 0) {
        alertPriority = subjectsBelow75.length;
      }

      const notesList = (counsellorNotes || []) as CounsellorNote[];
      const note = notesList.find((n: CounsellorNote) => n.student_id === student.id);

      return {
        ...student,
        overallPercent: totalHeld > 0 ? Math.round(overallPercent) : null,
        totalHeld,
        subjectsBelow75,
        hasLowAggregate,
        alertPriority,
        noteText: note?.note_text || '',
        studentResponse: note?.student_response || null,
        studentResponseUpdatedAt: note?.student_response_updated_at || null,
      };
    }).sort((a, b) => b.alertPriority - a.alertPriority); // Sort by alert priority descending
  }, [students, attendanceRecords, counsellorNotes]);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    return processedStudents.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.section_roll || '').includes(searchQuery) ||
      (s.university_roll || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [processedStudents, searchQuery]);

  // Compute batch statistics
  const batchMetrics = useMemo(() => {
    let totalPctSum = 0;
    let studentCountWithAttendance = 0;
    let lowAttendanceCount = 0;

    processedStudents.forEach(s => {
      if (s.overallPercent !== null) {
        totalPctSum += s.overallPercent;
        studentCountWithAttendance++;
        if (s.overallPercent < 75) {
          lowAttendanceCount++;
        }
      }
    });

    const classAverage = studentCountWithAttendance > 0 ? Math.round(totalPctSum / studentCountWithAttendance) : 100;

    return {
      classAverage,
      lowAttendanceCount,
      totalStudents: students.length,
    };
  }, [processedStudents, students.length]);

  const selectedStudent = useMemo(() => {
    return processedStudents.find(s => s.id === selectedStudentId) || null;
  }, [processedStudents, selectedStudentId]);

  // Initialize selected note input on selection
  useEffect(() => {
    if (selectedStudent) {
      setNoteText(selectedStudent.noteText);
    } else {
      setNoteText('');
    }
  }, [selectedStudent]);

  // Mutation to save notes
  const saveRemarks = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !authUser?.id) return;
      const { error } = await supabase
        .from('counsellor_notes')
        .upsert({
          counsellor_id: authUser.id,
          student_id: selectedStudentId,
          note_text: noteText.trim(),
          created_at: new Date().toISOString()
        }, { onConflict: 'counsellor_id,student_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Counsellor remarks saved securely! ✓');
      qc.invalidateQueries({ queryKey: ['counsellor-remarks', authUser?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save remarks');
    }
  });

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, fontSize: 11 }}>
              Counsellor Console
            </p>
            <span className="t-mono-sm" style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: 'rgb(99, 102, 241)',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700
            }}>
              [Batch Counsellor-A{counsellorBatch}]
            </span>
          </div>
          <h1 className="t-feature" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: 4 }}>
            Section {sectionInfo?.name || '—'} • Batch {counsellorBatch}
          </h1>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Insightful Analytics Metric Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          padding: '0 16px',
          marginTop: 16,
        }}>
          {/* Card 1: Batch Strength */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid var(--border-default)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="rgb(99, 102, 241)" />
            </div>
            <div>
              <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Batch Size</span>
              <p className="t-feature" style={{ color: 'var(--text-primary)', margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{batchMetrics.totalStudents}</p>
            </div>
          </div>

          {/* Card 2: Batch Attendance Average */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid var(--border-default)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: batchMetrics.classAverage >= 75 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={20} color={batchMetrics.classAverage >= 75 ? 'var(--status-safe)' : 'var(--status-critical)'} />
            </div>
            <div>
              <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Class Average</span>
              <p className="t-feature" style={{ color: batchMetrics.classAverage >= 75 ? 'var(--status-safe)' : 'var(--status-critical)', margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{batchMetrics.classAverage}%</p>
            </div>
          </div>

          {/* Card 3: At Risk */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid var(--border-default)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: batchMetrics.lowAttendanceCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color={batchMetrics.lowAttendanceCount > 0 ? 'var(--status-critical)' : 'var(--status-safe)'} />
            </div>
            <div>
              <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>At Risk (&lt;75%)</span>
              <p className="t-feature" style={{ color: batchMetrics.lowAttendanceCount > 0 ? 'var(--status-critical)' : 'var(--status-safe)', margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{batchMetrics.lowAttendanceCount}</p>
            </div>
          </div>
        </div>

        <div className="counsellor-layout" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr)',
          gap: 20,
          padding: 16,
        }}>
          
          {/* Left Column: Prioritized Students List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search roll, name, or uni roll..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-primary)',
                  fontSize: 13, width: '100%', outline: 'none'
                }}
              />
            </div>

            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 className="t-card-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Users size={16} color="var(--accent-primary)" />
                Batch Students ({filteredStudents.length})
              </h3>

              {isStudentsLoading || isAttendanceLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  Loading batch list...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  No matching students in Batch {counsellorBatch}.
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: '500px',
                  overflowY: 'auto',
                  paddingRight: 4
                }}>
                  {filteredStudents.map(student => {
                    const isSelected = student.id === selectedStudentId;
                    const avatar = student.avatar_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(student.name)}`;
                    
                    let badgeColor = 'var(--text-muted)';
                    let badgeBg = 'rgba(255, 255, 255, 0.02)';
                    if (student.hasLowAggregate) {
                      badgeColor = 'var(--status-critical)';
                      badgeBg = 'rgba(239, 68, 68, 0.08)';
                    } else if (student.subjectsBelow75.length > 0) {
                      badgeColor = 'var(--status-warning)';
                      badgeBg = 'rgba(245, 158, 11, 0.08)';
                    } else if (student.overallPercent !== null) {
                      badgeColor = 'var(--status-safe)';
                      badgeBg = 'rgba(16, 185, 129, 0.08)';
                    }

                    return (
                      <button
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        style={{
                          textAlign: 'left', width: '100%',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          padding: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Avatar */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img
                            src={avatar}
                            alt={student.name}
                            style={{
                              width: 38, height: 38, borderRadius: '50%',
                              border: student.hasLowAggregate ? '1.5px solid var(--status-critical)' : '1px solid var(--border-default)',
                              objectFit: 'cover'
                            }}
                          />
                          {(student.hasLowAggregate || student.subjectsBelow75.length > 0) && (
                            <div style={{
                              position: 'absolute', top: -3, right: -3,
                              width: 14, height: 14, borderRadius: '50%',
                              background: student.hasLowAggregate ? 'var(--status-critical)' : 'var(--status-warning)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                            }}>
                              <AlertTriangle size={8} color="#fff" />
                            </div>
                          )}
                        </div>

                        {/* Name & Roll */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="t-mono-sm" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {student.name}
                            {student.studentResponse && (
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: 'var(--status-announcement)',
                                display: 'inline-block',
                                boxShadow: '0 0 6px var(--status-announcement)'
                              }} title="Student responded" />
                            )}
                          </p>
                          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Roll: {student.section_roll || '—'}</span>
                            {student.studentResponse && (
                              <span style={{ fontSize: 9, color: 'var(--status-announcement)', fontWeight: 600 }}>Responded</span>
                            )}
                          </p>
                        </div>

                        {/* Metrics Indicator */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span className="t-mono-sm" style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            color: badgeColor, background: badgeBg
                          }}>
                            {student.overallPercent !== null ? `${student.overallPercent}%` : '—'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Student Details & Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedStudent ? (
              <>
                {/* Profile Detail Card */}
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <img
                      src={selectedStudent.avatar_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(selectedStudent.name)}`}
                      alt={selectedStudent.name}
                      style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border-default)', objectFit: 'cover' }}
                    />
                    <div>
                      <h3 className="t-card-title" style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>
                        {selectedStudent.name}
                      </h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={12} /> {selectedStudent.email}
                      </p>
                    </div>
                  </div>

                  {/* Roll details grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                    padding: 12, background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)'
                  }}>
                    <div>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10 }}>CLASS ROLL</span>
                      <p className="t-mono" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                        {selectedStudent.section_roll || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10 }}>UNIVERSITY ROLL</span>
                      <p className="t-mono" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                        {selectedStudent.university_roll || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Alerts Panel */}
                  {selectedStudent.hasLowAggregate && (
                    <div style={{
                      display: 'flex', gap: 10, padding: 12,
                      background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <ShieldAlert color="var(--status-critical)" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <p className="t-card-title" style={{ color: 'var(--status-critical)', fontSize: 13, fontWeight: 700 }}>
                          CRITICAL ALERT: Aggregate attendance below 75%
                        </p>
                        <p className="t-caption" style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
                          The student has missed a significant portion of classes and requires academic counselling or warnings.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Subject-wise Attendance List */}
                  <div>
                    <h4 className="t-mono-sm" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <BarChart3 size={14} /> Course Attendance breakdown
                    </h4>
                    
                    {attendanceRecords.filter(r => r.user_id === selectedStudent.id).length === 0 ? (
                      <p className="t-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                        No course attendance records registered yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {attendanceRecords.filter(r => r.user_id === selectedStudent.id).map(r => {
                          const pct = r.percentage ?? 100;
                          const isLow = pct < 75;

                          return (
                            <div key={r.subject_id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 12px', border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)'
                            }}>
                              <div>
                                <span className="t-mono-sm" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {r.subjects?.name}
                                </span>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
                                  ({r.subjects?.code})
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="t-caption" style={{ color: 'var(--text-muted)' }}>
                                  {r.present + r.od + r.makeup}/{r.present + r.od + r.absent}
                                </span>
                                <span className="t-mono" style={{
                                  fontSize: 12, fontWeight: 700,
                                  color: isLow ? 'var(--status-critical)' : 'var(--status-safe)'
                                }}>
                                  {Math.round(pct)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Counsellor Remarks/Private Notes Card */}
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 className="t-card-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} color="var(--accent-primary)" />
                    Secure Counsellor Remarks
                  </h3>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0 }}>
                    These remarks are visible to the student. They can submit an explanation in response.
                  </p>

                  {selectedStudent.studentResponse ? (
                    <div style={{
                      padding: 12,
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      marginTop: 4
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-announcement)', letterSpacing: '0.04em' }}>STUDENT RESPONSE</span>
                        {selectedStudent.studentResponseUpdatedAt && (
                          <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            {new Date(selectedStudent.studentResponseUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="t-body" style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                        {selectedStudent.studentResponse}
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px dashed var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                      marginTop: 4
                    }}>
                      <p className="t-caption" style={{ color: 'var(--text-muted)', margin: 0, fontSize: 11 }}>
                        No response submitted by student yet.
                      </p>
                    </div>
                  )}

                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Enter academic warnings, student feedback, or counselling observations..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 13,
                      lineHeight: 1.4,
                      resize: 'none',
                      padding: 12
                    }}
                  />

                  <button
                    onClick={() => saveRemarks.mutate()}
                    disabled={saveRemarks.isPending}
                    className="btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      alignSelf: 'flex-end', padding: '8px 16px', fontSize: 13
                    }}
                  >
                    {saveRemarks.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Remarks
                  </button>
                </div>
              </>
            ) : (
              <div className="card" style={{
                textAlign: 'center', padding: '64px 32px', color: 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '260px', height: '100%'
              }}>
                <User size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>No Student Selected</h3>
                <p className="t-caption" style={{ color: 'var(--text-muted)', maxWidth: 240 }}>
                  Select a student from the batch list to view attendance analytics and manage confidential remarks.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>

      <NavBar />
    </div>
  );
}
