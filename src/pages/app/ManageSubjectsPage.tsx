import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, BookOpen, Trash2, Edit3, Check, AlertTriangle, RefreshCw, ExternalLink 
} from 'lucide-react';
import { useSubjects, useMutateSubjects, useEnsureSubjects } from '../../hooks/useSubjects';
import { BottomSheet } from '../../components/BottomSheet';
import Skeleton from 'react-loading-skeleton';
import { toast } from 'sonner';
import { generateGradient } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { parseERPSubjects, type ParsedERPSubject } from '../../lib/utils/attendance';

function getSubjectAcronym(name: string) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.slice(0, 2).toUpperCase();
  }
  return words
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SubjectFormState = { id?: string; code: string; name: string; semester: string };

// ── Page Component ────────────────────────────────────────────────────────────
function ManageSubjectsSkeleton() {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 80px 24px', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
        <Skeleton width={30} height={10} />
        <Skeleton width={120} height={10} />
        <Skeleton width={20} height={10} />
        <Skeleton width={50} height={10} />
        <div />
      </div>
      {/* Table grid rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 80px 24px', gap: 10, alignItems: 'center', padding: '8px 0' }}>
          <Skeleton width={50} height={32} borderRadius={6} />
          <Skeleton width="90%" height={32} borderRadius={6} />
          <Skeleton width={30} height={32} borderRadius={6} />
          <Skeleton width={70} height={32} borderRadius={6} />
          <div />
        </div>
      ))}
    </div>
  );
}

export default function ManageSubjectsPage() {
  const navigate = useNavigate();
  const { data: subjects = [], isLoading } = useSubjects();
  const mutateSubjects = useMutateSubjects();
  const ensureSubjects = useEnsureSubjects();

  // User Role Guard check
  const authUser = useAppStore(s => s.authUser);
  const isCR = authUser?.role === 'cr';
  const sectionId = authUser?.sectionId;

  // Single Subject Form State
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SubjectFormState>({ code: '', name: '', semester: '' });
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  
  // Deletion Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ERP Bulk Import State
  const [importOpen, setImportOpen] = useState(false);
  const [erpText, setErpText] = useState('');
  const [parsed, setParsed] = useState<ParsedERPSubject[] | null>(null);
  const [selectedImportSemester, setSelectedImportSemester] = useState<number | ''>(1);

  // Fetch all teachers in the system (only for CRs)
  const { data: allTeachers = [] } = useQuery({
    queryKey: ['all-teachers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'teacher')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isCR
  });

  // Fetch mappings of teachers assigned to subjects in this section
  const { data: sectionTeachers = [] } = useQuery({
    queryKey: ['section-teachers-list', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select('id, teacher_id, subject_id, users(name)')
        .eq('section_id', sectionId || '');
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId
  });

  const subjectTeacherMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    sectionTeachers.forEach((st: any) => {
      if (st.subject_id && st.users) {
        map[st.subject_id] = {
          id: st.teacher_id,
          name: st.users.name || 'Unnamed Teacher'
        };
      }
    });
    return map;
  }, [sectionTeachers]);

  // Auto-detect max semester
  const maxSemester = useMemo(() => {
    if (subjects.length === 0) return 1;
    return Math.max(...subjects.map(s => s.semester));
  }, [subjects]);

  // Sync import semester with detected max semester
  useEffect(() => {
    if (maxSemester) {
      setSelectedImportSemester(maxSemester);
    }
  }, [maxSemester]);

  // Auto-fill ERP Text from Clipboard when sheet opens
  useEffect(() => {
    if (importOpen && !erpText) {
      navigator.clipboard.readText()
        .then(text => {
          if (text && text.trim()) {
            const lower = text.toLowerCase();
            const looksLikeErp = lower.includes('subject') || lower.includes('attendance') || lower.includes('\t') || lower.includes('%');
            if (looksLikeErp) {
              setErpText(text);
              toast.success('Auto-filled from clipboard! ✓');
            }
          }
        })
        .catch(err => {
          console.log('Clipboard access blocked or unsupported:', err);
        });
    }
  }, [importOpen, erpText]);

  const openForm = (subject?: typeof subjects[0]) => {
    if (!isCR) return;
    if (subject) {
      setEditingId(subject.id);
      setFormData({ 
        code: subject.code, 
        name: subject.name, 
        semester: subject.semester.toString() 
      });
      setSelectedTeacherId(subjectTeacherMap[subject.id]?.id || '');
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', semester: maxSemester.toString() });
      setSelectedTeacherId('');
    }
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!isCR) return;
    if (!formData.code.trim() || !formData.name.trim() || !formData.semester.trim()) {
      toast.error('Please fill all fields');
      return;
    }
    const sem = parseInt(formData.semester, 10);
    if (isNaN(sem) || sem < 1) {
      toast.error('Semester must be a valid number');
      return;
    }

    const payload = {
      code: formData.code.toUpperCase(),
      name: formData.name,
      semester: sem,
    };

    if (editingId) {
      mutateSubjects.mutate({ action: 'update', subject: { ...payload, id: editingId }, teacherId: selectedTeacherId || null }, {
        onSuccess: () => {
          toast.success('Subject updated');
          setFormOpen(false);
        },
        onError: (error: Error) => {
          console.error("Update subject error:", error);
          toast.error(error.message || 'Failed to update subject');
        }
      });
    } else {
      mutateSubjects.mutate({ action: 'create', subject: payload, teacherId: selectedTeacherId || null }, {
        onSuccess: () => {
          toast.success('Subject created');
          setFormOpen(false);
        },
        onError: (error: Error) => {
          console.error("Create subject error:", error);
          toast.error(error.message || 'Failed to create subject');
        }
      });
    }
  };

  const handleDelete = () => {
    if (!isCR || !deleteConfirmId) return;
    mutateSubjects.mutate({ action: 'delete', subject: { id: deleteConfirmId } }, {
      onSuccess: () => {
        toast.success('Subject deleted');
        setDeleteConfirmId(null);
      }
    });
  };

  const handleParse = () => {
    const result = parseERPSubjects(erpText);
    if (result.length === 0) {
      toast.error('Could not parse subjects. Check the format.');
      return;
    }
    setParsed(result);
    toast.info(`Parsed ${result.length} subjects. Review and confirm.`);
  };

  const handleConfirmImport = () => {
    if (!parsed || parsed.length === 0) return;
    
    const importItems = parsed.map(p => ({
      code: p.code,
      name: p.name,
      semester: p.semester || selectedImportSemester || 1
    }));

    ensureSubjects.mutate({ items: importItems, syncDelete: true }, {
      onSuccess: (data: any) => {
        if (data && data._hasFailedDeletions) {
          toast.success(`Curriculum updated! Note: Some obsolete subjects were kept because they have attendance records or assignments.`);
        } else {
          toast.success(`Successfully imported ${importItems.length} subjects!`);
        }
        setImportOpen(false);
        setParsed(null);
        setErpText('');
      },
      onError: (err: any) => {
        console.error('Import subjects error:', err);
        toast.error(err.message || 'Failed to import subjects');
      }
    });
  };

  return (
    <div className="page-shell" style={{ backgroundColor: '#09090b', minHeight: '100vh', paddingBottom: 40 }}>
      {/* Editorial Sticky Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ 
            background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 4 
          }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} color="var(--accent-primary)" />
              <h1 className="t-page-title" style={{ color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
                Curriculum
              </h1>
            </div>
            <p className="t-mono" style={{ color: '#71717a', margin: 0 }}>
              {subjects.length} Subjects Total
            </p>
          </div>
        </div>
        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="t-label" id="import-subjects-erp-btn" onClick={() => setImportOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', color: 'var(--accent-primary)', cursor: 'pointer' }}>
              <RefreshCw size={13} /> Import ERP
            </button>
            <button 
              onClick={() => openForm()}
              style={{
                background: '#fff', color: '#000', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255,255,255,0.1)'
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{ padding: '24px 20px' }}>
        {isLoading ? (
          <ManageSubjectsSkeleton />
        ) : subjects.length === 0 ? (
          <div style={{ 
            textAlign: 'center', padding: '60px 20px', 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 24, marginTop: 20 
          }}>
            <BookOpen size={32} color="#52525b" style={{ marginBottom: 16 }} />
            <h2 className="t-card-title" style={{ color: '#fff', marginBottom: 8 }}>No Subjects Yet</h2>
            <p className="t-body" style={{ color: '#a1a1aa', marginBottom: isCR ? 24 : 0 }}>
              {isCR 
                ? "Add your section's first subject to start tracking attendance and assignments." 
                : "No subjects set up by your CR yet. Ask your Class Representative to configure the curriculum."}
            </p>
            {isCR && (
              <button className="t-body-medium" 
                onClick={() => openForm()}
                style={{
                  background: 'var(--accent-primary)', color: '#fff', border: 'none',
                  padding: '10px 20px', borderRadius: 100, cursor: 'pointer'
                }}
              >
                Add First Subject
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map(subject => {
              const assignedTeacher = subjectTeacherMap[subject.id];
              return (
                <div key={subject.id} style={{
                  position: 'relative', overflow: 'hidden',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'transform 0.2s, background 0.2s'
                }}>
                  {/* Visual Avatar */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: generateGradient(subject.code),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                  }}>
                    <span className="t-card-title" style={{ color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                      {getSubjectAcronym(subject.name)}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="t-card-title" style={{ color: '#fff', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {subject.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="t-mono" style={{ color: '#a1a1aa' }}>{subject.code}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3f3f46' }} />
                      <span className="t-mono" style={{ color: 'var(--accent-primary)' }}>Sem {subject.semester}</span>
                      {assignedTeacher && (
                        <>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3f3f46' }} />
                          <span className="t-mono" style={{ color: '#c084fc' }}>Teacher: {assignedTeacher.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions (Only visible to CR) */}
                  {isCR && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openForm(subject)} style={{
                        background: 'rgba(255,255,255,0.05)', border: 'none', color: '#e4e4e7',
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                      }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => setDeleteConfirmId(subject.id)} style={{
                        background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444',
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Form BottomSheet */}
      {isCR && (
        <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Subject' : 'Add Subject'}>
          <div style={{ paddingBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label className="t-mono" style={{ display: 'block', color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Subject Code
              </label>
              <input className="t-card-title" 
                type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CSUL201"
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', outline: 'none'
                }}
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label className="t-mono" style={{ display: 'block', color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Subject Name
              </label>
              <input className="t-body" 
                type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Problem Solving Using OOP"
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="t-mono" style={{ display: 'block', color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Assign Teacher
              </label>
              <select 
                value={selectedTeacherId} 
                onChange={e => setSelectedTeacherId(e.target.value)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', outline: 'none', fontSize: 14
                }}
              >
                <option value="">No Teacher Assigned</option>
                {allTeachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="t-mono" style={{ display: 'block', color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Semester (Auto-detected: {maxSemester})
              </label>
              <input className="t-card-title" 
                type="number" min="1" max="10" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })}
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: 'var(--accent-primary)', outline: 'none'
                }}
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={mutateSubjects.isPending} className="t-card-title" style={{ width: '100%', padding: '16px', background: '#fff', color: '#000',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Check size={18} />
              {mutateSubjects.isPending ? 'Saving...' : 'Save Curriculum'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Import from ERP BottomSheet */}
      {isCR && (
        <BottomSheet open={importOpen} onClose={() => { setImportOpen(false); setParsed(null); setErpText(''); }} title="Import from ERP">
          <div style={{ paddingBottom: 24 }}>
            {!parsed ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                  {/* Step 1 */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1
                    }}>1</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <span className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>Open Student ERP</span>
                      <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: '1.4' }}>
                        Navigate to Student Info → Curriculum / Subject Details.
                      </span>
                      <a
                        href="https://erp.skit.ac.in/subject"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          borderRadius: 'var(--radius-sm, 6px)',
                          color: 'var(--accent-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        Go to ERP Subjects <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1
                    }}>2</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>Copy Curriculum Table</span>
                      <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: '1.4' }}>
                        Select the entire subjects/curriculum table (including codes and names) and copy it to clipboard.
                      </span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1
                    }}>3</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="t-body-medium" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>Paste & Import</span>
                      <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: '1.4' }}>
                        Choose the target semester, paste the data below, and click Parse to review.
                      </span>
                    </div>
                  </div>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label className="t-mono" style={{ display: 'block', color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Target Semester
                  </label>
                  <input className="t-card-title" 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={selectedImportSemester} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedImportSemester('');
                      } else {
                        const parsed = parseInt(val, 10);
                        setSelectedImportSemester(isNaN(parsed) ? '' : parsed);
                      }
                    }}
                    onBlur={() => {
                      if (selectedImportSemester === '' || selectedImportSemester < 1) {
                        setSelectedImportSemester(1);
                      } else if (selectedImportSemester > 10) {
                        setSelectedImportSemester(10);
                      }
                    }}
                    style={{
                      width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                      color: 'var(--accent-primary)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="t-mono" style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Paste ERP Data
                    </label>
                    <button 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text && text.trim()) {
                            setErpText(text);
                            toast.success('Pasted from clipboard! ✓');
                          } else {
                            toast.error('Clipboard is empty');
                          }
                        } catch {
                          toast.error('Permission denied or unsupported. Paste manually.');
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}
                    >
                      Paste Clipboard
                    </button>
                  </div>
                  <textarea
                    value={erpText}
                    onChange={e => setErpText(e.target.value)}
                    placeholder="Paste copied table rows from ERP here..."
                    rows={6}
                    style={{
                      width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                      color: '#fff', outline: 'none', fontFamily: 'monospace', fontSize: 12, resize: 'vertical'
                    }}
                  />
                </div>

                <button 
                  onClick={handleParse}
                  className="t-card-title"
                  style={{ width: '100%', padding: '16px', background: '#fff', color: '#000',
                    border: 'none', borderRadius: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Check size={18} />
                  Parse Subjects
                </button>
              </>
            ) : (
              <>
                <p className="t-body" style={{ color: '#a1a1aa', marginBottom: 16, fontSize: 13 }}>
                  Parsed <strong>{parsed.length}</strong> subjects. Review before importing:
                </p>
                
                <div style={{
                  maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
                  marginBottom: 24, padding: 8, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12
                }}>
                  {parsed.map((sub, idx) => (
                    <div key={idx} style={{
                      padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <span className="t-mono" style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{sub.code}</span>
                        <p className="t-body-medium" style={{ color: '#fff', margin: '2px 0 0', fontSize: 13 }}>{sub.name}</p>
                      </div>
                      <span className="t-mono" style={{ color: '#71717a', fontSize: 12 }}>Sem {sub.semester || selectedImportSemester}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => setParsed(null)}
                    style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)', color: '#fff',
                      border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleConfirmImport}
                    disabled={ensureSubjects.isPending}
                    style={{ flex: 1, padding: '14px', background: 'var(--accent-primary)', color: '#fff',
                      border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Check size={18} />
                    {ensureSubjects.isPending ? 'Importing...' : 'Confirm Import'}
                  </button>
                </div>
              </>
            )}
          </div>
        </BottomSheet>
      )}

      {/* Destructive Deletion Modal overlay */}
      {isCR && deleteConfirmId ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#18181b', border: '1px solid #ef4444', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360,
            boxShadow: '0 20px 40px rgba(239,68,68,0.15)'
          }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="t-page-title" style={{ color: '#fff', marginBottom: 8 }}>Delete Subject?</h3>
            <p className="t-body" style={{ color: '#a1a1aa', marginBottom: 24, lineHeight: 1.5 }}>
              This action is <strong style={{ color: '#ef4444' }}>irreversible</strong>. Deleting this subject will also permanently wipe all associated attendance records and assignments.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="t-body-medium" 
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={mutateSubjects.isPending} className="t-button" style={{ flex: 1, padding: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                {mutateSubjects.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
