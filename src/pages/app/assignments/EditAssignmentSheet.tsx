import { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../../components/BottomSheet';
import type { AssignmentSet, Assignment } from '../../../store/appStore';
import { toast } from 'sonner';
import { useUpdateAssignment } from '../../../hooks/useAssignments';
import { useSubjects, useEnsureSubjects } from '../../../hooks/useSubjects';
import { autoGenerate } from './assignmentUtils';

export function EditAssignmentSheet({ open, onClose, assignment }: { open: boolean; onClose: () => void; assignment: Assignment }) {
  const updateAssignment = useUpdateAssignment();
  const ensureSubjects = useEnsureSubjects();
  const { data: subjectsList = [] } = useSubjects();

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title, setTitle] = useState(assignment.title);
  const [subjectId, setSubjectId] = useState(() => {
    if (assignment.subjectId) return assignment.subjectId;
    const match = subjectsList.find(s => s.code === assignment.subjectCode || s.name === assignment.subject);
    return match?.id || '';
  });
  const [customSubjectName, setCustomSubjectName] = useState('');

  useEffect(() => {
    if (!subjectId && subjectsList.length > 0) {
      const match = subjectsList.find(s => s.code === assignment.subjectCode || s.name === assignment.subject);
      if (match) setSubjectId(match.id);
    }
  }, [subjectsList, assignment, subjectId]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date(assignment.dueDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [description, setDescription] = useState(assignment.description || '');
  const [hasSets, setHasSets] = useState(assignment.hasSets || false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notifyClass, setNotifyClass] = useState(false);

  // Step 2 fields
  const [totalStudents, setTotalStudents] = useState('60');
  const [numSets, setNumSets] = useState('');
  const [excludeFirstPage, setExcludeFirstPage] = useState(false);
  const [sets, setSets] = useState<AssignmentSet[]>(assignment.sets || []);

  const handleGenerate = () => {
    const t = parseInt(totalStudents), s = parseInt(numSets);
    if (!t || !s || t < 1 || s < 1) { toast.error('Enter valid numbers'); return; }
    setSets(autoGenerate(t, s, excludeFirstPage));
    toast.info(`Generated ${autoGenerate(t, s, excludeFirstPage).length} sets`);
  };

  const updateSet = (idx: number, field: keyof AssignmentSet, value: string) => {
    setSets(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const isNumeric = field === 'rollStart' || field === 'rollEnd';
      const updated = {
        ...s,
        [field]: isNumeric ? (parseInt(value) || 0) : value,
      };
      if (field === 'pageNumbers') {
        updated.description = `Complete Pages ${value} of the attached PDF.`;
      }
      return updated;
    }));
  };

  const deleteSet = (idx: number) => setSets(prev => prev.filter((_, i) => i !== idx));

  const addRow = () => {
    const last = sets[sets.length - 1];
    const nextRoll = last ? last.rollEnd + 1 : 1;
    setSets(prev => [...prev, {
      id: `set-custom-${Date.now()}`,
      label: `Set ${prev.length + 1}`,
      rollStart: nextRoll, rollEnd: nextRoll,
      pageNumbers: '', description: '', pdfUrl: null,
    }]);
  };

  const handleSave = async () => {
    if (!title.trim() || !subjectId || !dueDate) {
      toast.error('Fill in all required fields'); return;
    }
    if (subjectId === 'other' && !customSubjectName.trim()) {
      toast.error('Enter a custom subject name'); return;
    }
    if (hasSets && sets.length === 0) {
      toast.error('Generate or add at least one set'); return;
    }

    setIsPublishing(true);
    try {
      let finalSubjectId = subjectId;
      if (subjectId === 'other') {
        const mapping = await ensureSubjects.mutateAsync([{ code: customSubjectName.trim().substring(0, 8).toUpperCase(), name: customSubjectName.trim() }]);
        finalSubjectId = Object.values(mapping)[0];
      }

      await updateAssignment.mutateAsync({
        id: assignment.id,
        title: title.trim(),
        subjectId: finalSubjectId,
        dueDate: new Date(dueDate).toISOString(),
        description: description.trim() || undefined,
        sets: hasSets ? sets.map(s => ({
          id: s.id?.startsWith('set-custom-') || s.id?.startsWith('set-') ? undefined : s.id,
          label: s.label, description: s.description,
          rollStart: s.rollStart, rollEnd: s.rollEnd,
          pdfUrl: s.pdfUrl,
          pageNumbers: s.pageNumbers,
        })) : undefined,
        notifyClass,
      });

      toast.success('Assignment updated successfully! ✓');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update assignment');
    } finally {
      setIsPublishing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    display: 'block', marginBottom: 6,
  };

  const pending = updateAssignment.isPending || ensureSubjects.isPending || isPublishing;

  return (
    <BottomSheet open={open} onClose={onClose} title={step === 1 ? 'Edit Assignment' : 'Configure Sets'}>
      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input style={inputStyle} placeholder="e.g. DBMS Unit 3 Assignment" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Subject <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <select style={inputStyle} value={subjectId} onChange={e => { setSubjectId(e.target.value); if (e.target.value !== 'other') setCustomSubjectName(''); }}>
              <option value="">Select subject…</option>
              {subjectsList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              <option value="other">Other (Custom Subject)</option>
            </select>
            {subjectId === 'other' && (
              <input 
                style={{ ...inputStyle, marginTop: 8 }} 
                placeholder="Enter custom subject name..." 
                value={customSubjectName} 
                onChange={e => setCustomSubjectName(e.target.value)} 
              />
            )}
          </div>
          <div>
            <label style={labelStyle}>Due Date & Time <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input style={inputStyle} type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="Instructions for students…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Toggle Roll Splitting */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: `1px solid ${hasSets ? 'rgba(74,158,255,0.35)' : 'var(--border-default)'}` }}>
            <div style={{ flex: 1 }}>
              <p className="t-button" style={{ color: 'var(--text-primary)' }}>Split by Roll Numbers</p>
              <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>Assign different pages to different roll ranges</p>
            </div>
            <button
              onClick={() => setHasSets(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: hasSets ? 'var(--accent-primary)' : 'var(--border-default)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: hasSets ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>

          {/* Notification Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            <input
              type="checkbox"
              id="notify-class-update-checkbox"
              checked={notifyClass}
              onChange={e => setNotifyClass(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="notify-class-update-checkbox" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, userSelect: 'none' }}>
              Notify class about updates
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            {hasSets
              ? <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (!title.trim() || !subjectId || !dueDate || (subjectId === 'other' && !customSubjectName.trim())) { toast.error('Fill required fields first'); return; } setStep(2); }}>Next →</button>
              : <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={pending}>{pending ? 'Saving…' : 'Save Changes'}</button>
            }
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Auto-generate controls */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>AUTO-GENERATE</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Total Students</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 68" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Total Sets</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 6" value={numSets} onChange={e => setNumSets(e.target.value)} />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="exclude-first-page-edit"
                checked={excludeFirstPage}
                onChange={e => setExcludeFirstPage(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="exclude-first-page-edit" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, userSelect: 'none' }}>
                Exclude 1st page of PDF (e.g. for Index/Cover)
              </label>
            </div>
            <button
              onClick={handleGenerate} className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', color: 'var(--accent-primary)', cursor: 'pointer' }}
            >
              <Wand2 size={13} /> Auto-Generate
            </button>
          </div>

          {/* Sets table */}
          {sets.length > 0 && (
            <div>
              <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>SETS — ALL FIELDS EDITABLE</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, padding: '0 4px' }}>
                  {['Label', 'Roll From', 'Roll To', 'Pages', ''].map(h => (
                    <p key={h} className="t-badge t-mono" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{h}</p>
                  ))}
                </div>
                {sets.map((s, idx) => {
                  const cellInput: React.CSSProperties = { ...inputStyle, padding: '5px 7px', minWidth: 0 };
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, alignItems: 'center', padding: '6px 4px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      <input
                        value={s.label}
                        onChange={e => updateSet(idx, 'label', e.target.value)}
                        placeholder="Set 1"
                        style={{ ...cellInput, color: 'var(--accent-primary)', fontWeight: 600 }}
                      />
                      <input
                        type="number"
                        min="1"
                        value={s.rollStart}
                        onChange={e => updateSet(idx, 'rollStart', e.target.value)}
                        placeholder="1"
                        style={cellInput}
                      />
                      <input
                        type="number"
                        min="1"
                        value={s.rollEnd}
                        onChange={e => updateSet(idx, 'rollEnd', e.target.value)}
                        placeholder="10"
                        style={cellInput}
                      />
                      <input
                        value={s.pageNumbers}
                        onChange={e => updateSet(idx, 'pageNumbers', e.target.value)}
                        placeholder="e.g. 1-3"
                        style={cellInput}
                      />
                      <button onClick={() => deleteSet(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={addRow} className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: '1px dashed var(--border-active)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Plus size={13} /> Add Row Manually
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={pending}>{pending ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
