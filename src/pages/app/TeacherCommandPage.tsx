import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { NavBar } from '../../components/NavBar';
import { 
  Megaphone, ClipboardList, BookOpen, AlertCircle, Check, 
  Trash2, Loader2, Link
} from 'lucide-react';
import { toast } from 'sonner';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface TeacherMapping {
  id: string;
  section_id: string;
  subject_id: string | null;
  is_counsellor_for_batch: '1' | '2' | null;
  subjects: Subject | null;
}

export default function TeacherCommandPage() {
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  
  const [activeSubTab, setActiveSubTab] = useState<'announcements' | 'assignments' | 'subjects'>('announcements');

  // Query linked subjects & sections
  const { data: mappings = [] } = useQuery<TeacherMapping[]>({
    queryKey: ['teacher-mappings-command', authUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          id, section_id, subject_id, is_counsellor_for_batch,
          subjects:subject_id (id, name, code)
        `)
        .eq('teacher_id', authUser?.id || '');
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!authUser?.id,
  });

  const sectionId = authUser?.sectionId || '';

  // Get subjects in section that are NOT linked to this teacher, so they can link them
  const { data: allSectionSubjects = [] } = useQuery<Subject[]>({
    queryKey: ['section-subjects-all', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('section_id', sectionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId,
  });

  const unlinkedSubjects = useMemo(() => {
    const linkedIds = new Set(mappings.map(m => m.subject_id));
    return allSectionSubjects.filter(s => !linkedIds.has(s.id));
  }, [allSectionSubjects, mappings]);

  // Announcement State
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPriority, setAnnPriority] = useState<'general' | 'critical'>('general');
  const [annBatch, setAnnBatch] = useState<'all' | '1' | '2'>('all');
  const [annDeadline, setAnnDeadline] = useState('');

  // Assignment State
  const [assTitle, setAssTitle] = useState('');
  const [assDesc, setAssDesc] = useState('');
  const [assSubjectId, setAssSubjectId] = useState('');
  const [assDueDate, setAssDueDate] = useState('');
  const [assBatch, setAssBatch] = useState<'all' | '1' | '2'>('all');

  // Smart Parsing: regex check if title/description mentions a batch number
  const detectBatch = (text: string): 'all' | '1' | '2' => {
    const lower = text.toLowerCase();
    if (lower.includes('batch 1') || lower.includes('b1') || lower.includes('batch-1')) return '1';
    if (lower.includes('batch 2') || lower.includes('b2') || lower.includes('batch-2')) return '2';
    return 'all';
  };

  const handleAnnTitleChange = (val: string) => {
    setAnnTitle(val);
    const parsed = detectBatch(val + ' ' + annBody);
    if (parsed !== 'all') setAnnBatch(parsed);
  };

  const handleAnnBodyChange = (val: string) => {
    setAnnBody(val);
    const parsed = detectBatch(annTitle + ' ' + val);
    if (parsed !== 'all') setAnnBatch(parsed);
  };

  const handleAssTitleChange = (val: string) => {
    setAssTitle(val);
    const parsed = detectBatch(val + ' ' + assDesc);
    if (parsed !== 'all') setAssBatch(parsed);
  };

  const handleAssDescChange = (val: string) => {
    setAssDesc(val);
    const parsed = detectBatch(assTitle + ' ' + val);
    if (parsed !== 'all') setAssBatch(parsed);
  };

  // Mutations
  const createAnnouncement = useMutation({
    mutationFn: async () => {
      if (!sectionId) throw new Error('No active section joined');
      if (!annTitle.trim()) throw new Error('Title is required');
      
      const { error } = await supabase
        .from('announcements')
        .insert({
          section_id: sectionId,
          author_id: authUser?.id,
          title: annTitle.trim(),
          message_content: annBody.trim(),
          priority: annPriority,
          target_batch: annBatch === 'all' ? null : annBatch,
          deadline_at: annDeadline ? new Date(annDeadline).toISOString() : null,
          expires_at: annDeadline ? new Date(new Date(annDeadline).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notice published to section feed! 📣');
      setAnnTitle('');
      setAnnBody('');
      setAnnPriority('general');
      setAnnBatch('all');
      setAnnDeadline('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create announcement');
    }
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      if (!sectionId) throw new Error('No active section joined');
      if (!assTitle.trim()) throw new Error('Title is required');
      if (!assSubjectId) throw new Error('Subject is required');
      if (!assDueDate) throw new Error('Due date is required');

      const { error } = await supabase
        .from('assignments')
        .insert({
          section_id: sectionId,
          created_by: authUser?.id,
          title: assTitle.trim(),
          description: assDesc.trim(),
          subject_id: assSubjectId,
          due_date: new Date(assDueDate).toISOString(),
          target_batch: assBatch === 'all' ? null : assBatch,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment published to students! 📝');
      setAssTitle('');
      setAssDesc('');
      setAssSubjectId('');
      setAssDueDate('');
      setAssBatch('all');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create assignment');
    }
  });

  const linkSubject = useMutation({
    mutationFn: async (subjId: string) => {
      const { error } = await supabase
        .from('section_teachers')
        .insert({
          section_id: sectionId,
          teacher_id: authUser?.id || '',
          subject_id: subjId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subject linked to your console! 🔗');
      qc.invalidateQueries({ queryKey: ['teacher-mappings-command', authUser?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to link subject');
    }
  });

  const unlinkSubject = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('section_teachers')
        .delete()
        .eq('id', mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subject unlinked.');
      qc.invalidateQueries({ queryKey: ['teacher-mappings-command', authUser?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to unlink subject');
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
          <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, fontSize: 11 }}>
            Teacher Command Center
          </p>
          <h1 className="t-feature" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: 4 }}>
            Manage Section Feed
          </h1>
        </div>
      </header>

      {/* Sub Tabs */}
      <div style={{
        display: 'flex', padding: '12px 16px 0', borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-base)', gap: 12
      }}>
        <button
          onClick={() => setActiveSubTab('announcements')}
          className={`t-mono-sm sub-tab-btn${activeSubTab === 'announcements' ? ' active' : ''}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 12px 12px', borderBottom: activeSubTab === 'announcements' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeSubTab === 'announcements' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'announcements' ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Megaphone size={14} /> Notices
        </button>
        <button
          onClick={() => setActiveSubTab('assignments')}
          className={`t-mono-sm sub-tab-btn${activeSubTab === 'assignments' ? ' active' : ''}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 12px 12px', borderBottom: activeSubTab === 'assignments' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeSubTab === 'assignments' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'assignments' ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <ClipboardList size={14} /> Assignments
        </button>
        <button
          onClick={() => setActiveSubTab('subjects')}
          className={`t-mono-sm sub-tab-btn${activeSubTab === 'subjects' ? ' active' : ''}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 12px 12px', borderBottom: activeSubTab === 'subjects' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeSubTab === 'subjects' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'subjects' ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <BookOpen size={14} /> Linked Courses
        </button>
      </div>

      <main className="page-content" style={{ paddingBottom: 100, padding: 16 }}>
        {!sectionId ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Active Section Joined</h3>
            <p className="t-caption" style={{ color: 'var(--text-muted)' }}>
              Join a section using a Teacher Invite Code to start creating assignments and notices.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Notices Tab */}
            {activeSubTab === 'announcements' && (
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 className="t-card-title" style={{ color: 'var(--text-primary)' }}>Compose Notice</h3>
                  <p className="t-caption" style={{ color: 'var(--text-muted)' }}>Publish urgent notices or general updates.</p>
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Notice title..."
                    value={annTitle}
                    onChange={e => handleAnnTitleChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Body Message</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Notice details..."
                    value={annBody}
                    onChange={e => handleAnnBodyChange(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Target Batch</label>
                    <select
                      className="input"
                      value={annBatch}
                      onChange={e => setAnnBatch(e.target.value as any)}
                    >
                      <option value="all">Full Section (All)</option>
                      <option value="1">Batch 1 Only</option>
                      <option value="2">Batch 2 Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Priority</label>
                    <select
                      className="input"
                      value={annPriority}
                      onChange={e => setAnnPriority(e.target.value as any)}
                    >
                      <option value="general">General Notice</option>
                      <option value="critical">Critical / Urgent 🚨</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Expiry / Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={annDeadline}
                    onChange={e => setAnnDeadline(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => createAnnouncement.mutate()}
                  disabled={createAnnouncement.isPending}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, marginTop: 8 }}
                >
                  {createAnnouncement.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Publish Notice
                </button>
              </div>
            )}

            {/* Assignments Tab */}
            {activeSubTab === 'assignments' && (
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 className="t-card-title" style={{ color: 'var(--text-primary)' }}>Create Assignment</h3>
                  <p className="t-caption" style={{ color: 'var(--text-muted)' }}>Publish assignments for submission tracking.</p>
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Assignment title..."
                    value={assTitle}
                    onChange={e => handleAssTitleChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Course Subject</label>
                  <select
                    className="input"
                    value={assSubjectId}
                    onChange={e => setAssSubjectId(e.target.value)}
                  >
                    <option value="">-- Select Subject --</option>
                    {mappings.filter(m => m.subjects).map(m => (
                      <option key={m.subject_id} value={m.subject_id!}>{m.subjects?.name} ({m.subjects?.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Instructions / Description</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Assignment description, syllabus units, or reference page numbers..."
                    value={assDesc}
                    onChange={e => handleAssDescChange(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Target Batch</label>
                    <select
                      className="input"
                      value={assBatch}
                      onChange={e => setAssBatch(e.target.value as any)}
                    >
                      <option value="all">Full Section (All)</option>
                      <option value="1">Batch 1 Only</option>
                      <option value="2">Batch 2 Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Due Date</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={assDueDate}
                      onChange={e => setAssDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  onClick={() => createAssignment.mutate()}
                  disabled={createAssignment.isPending}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, marginTop: 8 }}
                >
                  {createAssignment.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Create Assignment
                </button>
              </div>
            )}

            {/* Subjects Tab */}
            {activeSubTab === 'subjects' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Linked Subjects */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Your Linked Courses</h3>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Subjects currently assigned to you in this section.</p>

                  {mappings.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', fontSize: 13 }}>
                      You haven't linked any subjects yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {mappings.map(m => (
                        <div key={m.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px', border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)'
                        }}>
                          <div>
                            <span className="t-card-title" style={{ fontSize: 14, fontWeight: 700 }}>
                              {m.subjects?.name || 'Unnamed Subject'}
                            </span>
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                              {m.subjects?.code || '—'}
                            </span>
                            {m.is_counsellor_for_batch && (
                              <span className="t-mono-sm" style={{
                                background: 'rgba(99, 102, 241, 0.1)', color: 'rgb(99, 102, 241)',
                                padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 8, fontWeight: 700
                              }}>
                                Counsellor-Batch {m.is_counsellor_for_batch}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to unlink ${m.subjects?.name}?`)) {
                                unlinkSubject.mutate(m.id);
                              }
                            }}
                            className="btn-secondary"
                            style={{ padding: '6px 10px', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={13} color="var(--status-critical)" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Link Subject Panel */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Link Subject</h3>
                  <p className="t-caption" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Select and link section courses to your console.</p>

                  {unlinkedSubjects.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', fontSize: 13 }}>
                      All section subjects are already linked to your profile.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {unlinkedSubjects.map(s => (
                        <div key={s.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px', border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)'
                        }}>
                          <div>
                            <span className="t-card-title" style={{ fontSize: 14, fontWeight: 700 }}>
                              {s.name}
                            </span>
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                              {s.code}
                            </span>
                          </div>
                          <button
                            onClick={() => linkSubject.mutate(s.id)}
                            className="btn-primary"
                            style={{ padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
                          >
                            <Link size={12} /> Link
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <NavBar />
    </div>
  );
}
