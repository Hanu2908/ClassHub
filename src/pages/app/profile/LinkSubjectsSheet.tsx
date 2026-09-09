import { useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';
import {
  useSectionSubjectsForLinking,
  useToggleTeacherSubjectLink,
  type LinkedSubjectItem,
} from '../../../hooks/useProfileQueries';
import { toast } from 'sonner';

interface LinkSubjectsSheetProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  sectionId: string;
  linkedSubjects: LinkedSubjectItem[];
  refetchLinked: () => void;
}

export function LinkSubjectsSheet({
  open,
  onClose,
  teacherId,
  sectionId,
  linkedSubjects,
  refetchLinked,
}: LinkSubjectsSheetProps) {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [globalChecked, setGlobalChecked] = useState<Record<string, boolean>>({});

  const { data: sectionSubjects = [] } = useSectionSubjectsForLinking(sectionId, open);
  const toggleSubjectMutation = useToggleTeacherSubjectLink(teacherId, sectionId);

  const handleToggleSubject = async (subjectId: string, subjectCode: string, currentLinked: boolean) => {
    setLoadingMap(prev => ({ ...prev, [subjectId]: true }));
    try {
      const applyAll = !!globalChecked[subjectId];
      await toggleSubjectMutation.mutateAsync({
        subjectId,
        subjectCode,
        currentLinked,
        applyAll,
      });
      toast.success(currentLinked ? 'Subject unlinked ✓' : 'Subject linked ✓');
      refetchLinked();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle subject';
      toast.error(msg);
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
              const isLoading = !!loadingMap[subject.id] || toggleSubjectMutation.isPending;
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
                          color: subject.accent, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)'
                        }}>{subject.code}</span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sem {subject.semester}</span>
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
                        <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Apply globally to all my sections</span>
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
