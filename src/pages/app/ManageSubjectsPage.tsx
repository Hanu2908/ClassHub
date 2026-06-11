import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, BookOpen, Trash2, Edit3, Check, AlertTriangle 
} from 'lucide-react';
import { useSubjects, useMutateSubjects } from '../../hooks/useSubjects';
import { BottomSheet } from '../../components/BottomSheet';
import Skeleton from 'react-loading-skeleton';
import { toast } from 'sonner';
import { generateGradient } from '../../lib/utils';


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
          <Skeleton circle width={18} height={18} style={{ justifySelf: 'center' }} />
        </div>
      ))}
    </div>
  );
}

export default function ManageSubjectsPage() {
  const navigate = useNavigate();
  const { data: subjects = [], isLoading } = useSubjects();
  const mutateSubjects = useMutateSubjects();

  // State
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SubjectFormState>({ code: '', name: '', semester: '' });
  
  // Deletion Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auto-detect max semester
  const maxSemester = useMemo(() => {
    if (subjects.length === 0) return 1;
    return Math.max(...subjects.map(s => s.semester));
  }, [subjects]);

  const openForm = (subject?: typeof subjects[0]) => {
    if (subject) {
      setEditingId(subject.id);
      setFormData({ 
        code: subject.code, 
        name: subject.name, 
        semester: subject.semester.toString() 
      });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', semester: maxSemester.toString() });
    }
    setFormOpen(true);
  };

  const handleSave = () => {
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
      mutateSubjects.mutate({ action: 'update', subject: { ...payload, id: editingId } }, {
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
      mutateSubjects.mutate({ action: 'create', subject: payload }, {
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
    if (!deleteConfirmId) return;
    mutateSubjects.mutate({ action: 'delete', subject: { id: deleteConfirmId } }, {
      onSuccess: () => {
        toast.success('Subject deleted');
        setDeleteConfirmId(null);
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
            <p className="t-body" style={{ color: '#a1a1aa', marginBottom: 24 }}>
              Add your section's first subject to start tracking attendance and assignments.
            </p>
            <button className="t-body-medium" 
              onClick={() => openForm()}
              style={{
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 100, cursor: 'pointer'
              }}
            >
              Add First Subject
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map(subject => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="t-mono" style={{ color: '#a1a1aa' }}>{subject.code}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3f3f46' }} />
                    <span className="t-mono" style={{ color: 'var(--accent-primary)' }}>Sem {subject.semester}</span>
                  </div>
                </div>

                {/* Actions */}
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
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Form BottomSheet */}
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

      {/* Destructive Deletion Modal overlay */}
      {deleteConfirmId ? (
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
