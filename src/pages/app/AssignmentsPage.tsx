import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, Wand2, Trash2, FileText, BookOpen, Cpu, BookMarked, PartyPopper, AlertTriangle, Loader, ArrowUpDown } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import type { AssignmentSet, Assignment } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAssignments, useSubjects } from '../../hooks/useSupabaseQuery';
import { useCreateAssignment, useDeleteAssignment, useUpdateAssignment, useSubmitAssignment, useEnsureSubjects } from '../../hooks/useSupabaseMutations';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentCard } from '../../components/AttachmentCard';
import { supabase } from '../../lib/supabase';

type Filter = 'all' | 'pending' | 'submitted' | 'overdue';

function getSubjectIcon(subject: string) {
  if (subject.includes('DBMS')) return <BookOpen size={22} color="var(--accent-primary)" />;
  if (subject.includes('OS') || subject.includes('Operating')) return <Cpu size={22} color="var(--status-safe)" />;
  return <BookMarked size={22} color="var(--status-warning)" />;
}

function getUserSet(classRoll: string, sets: AssignmentSet[]) {
  if (!sets || sets.length === 0) return null;
  const roll = parseInt(classRoll, 10);
  return sets.find(s => roll >= s.rollStart && roll <= s.rollEnd) ?? null;
}

function autoGenerate(totalStudents: number, groupSize: number): AssignmentSet[] {
  const sets: AssignmentSet[] = [];
  let roll = 1, setNum = 1;
  while (roll <= totalStudents) {
    const end = Math.min(roll + groupSize - 1, totalStudents);
    sets.push({
      id: `set-${setNum}-${Date.now()}`,
      label: `Set ${setNum}`,
      rollStart: roll,
      rollEnd: end,
      pageNumbers: String(setNum),
      description: `Complete Page ${setNum} of the attached PDF.`,
      pdfUrl: null,
    });
    roll = end + 1;
    setNum++;
  }
  return sets;
}

function CreateAssignmentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createAssignment = useCreateAssignment();
  const ensureSubjects = useEnsureSubjects();
  const { data: subjectsList = [] } = useSubjects();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [hasSets, setHasSets] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 2 fields
  const [totalStudents, setTotalStudents] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [sets, setSets] = useState<AssignmentSet[]>([]);

  const reset = () => {
    setStep(1); setTitle(''); setSubjectId(''); setCustomSubjectName('');
    setDueDate(''); setDescription(''); setFiles([]); setHasSets(false);
    setTotalStudents(''); setGroupSize(''); setSets([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleGenerate = () => {
    const t = parseInt(totalStudents), g = parseInt(groupSize);
    if (!t || !g || t < 1 || g < 1) { showToast('Enter valid numbers', 'error'); return; }
    setSets(autoGenerate(t, g));
    showToast(`Generated ${autoGenerate(t, g).length} sets`, 'info');
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

  const handlePublish = async () => {
    if (!title.trim() || !subjectId || !dueDate) {
      showToast('Fill in all required fields', 'error'); return;
    }
    if (subjectId === 'other' && !customSubjectName.trim()) {
      showToast('Enter a custom subject name', 'error'); return;
    }
    if (hasSets && sets.length === 0) {
      showToast('Generate or add at least one set', 'error'); return;
    }

    setIsPublishing(true);
    try {
      let finalSubjectId = subjectId;
      if (subjectId === 'other') {
        const mapping = await ensureSubjects.mutateAsync([{ code: customSubjectName.trim().substring(0, 8).toUpperCase(), name: customSubjectName.trim() }]);
        finalSubjectId = Object.values(mapping)[0];
      }

      const parentId = await createAssignment.mutateAsync({
        title: title.trim(),
        subjectId: finalSubjectId,
        dueDate: new Date(dueDate).toISOString(),
        description: description.trim() || undefined,
        sets: hasSets ? sets.map(s => ({
          label: s.label, description: s.description,
          rollStart: s.rollStart, rollEnd: s.rollEnd,
          pdfUrl: s.pdfUrl,
          pageNumbers: s.pageNumbers,
        })) : undefined,
      });

      if (parentId && files.length > 0) {
        if (!sectionId || !userId) throw new Error('Missing section context or user context');
        for (const file of files) {
          const path = `${sectionId}/assignments/${parentId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('attachments')
            .upload(path, file, { cacheControl: '3600', upsert: true });
          if (uploadErr) throw uploadErr;

          const { error: dbErr } = await supabase
            .from('attachments')
            .insert({
              section_id: sectionId,
              assignment_id: parentId,
              storage_path: path,
              filename: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: userId,
            });
          if (dbErr) throw dbErr;
        }
      }

      showToast('Assignment published! ✓', 'success');
      handleClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
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

  const pending = createAssignment.isPending || ensureSubjects.isPending || isPublishing;

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 1 ? 'New Assignment' : 'Configure Sets'}>
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
          <div>
            <FileUploader files={files} onChange={setFiles} />
          </div>

          {/* Toggle */}
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

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
            {hasSets
              ? <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (!title.trim() || !subjectId || !dueDate || (subjectId === 'other' && !customSubjectName.trim())) { showToast('Fill required fields first', 'error'); return; } setStep(2); }}>Next →</button>
              : <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublish} disabled={pending}>{pending ? 'Publishing…' : 'Publish'}</button>
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
                <label style={labelStyle}>Group Size</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 6" value={groupSize} onChange={e => setGroupSize(e.target.value)} />
              </div>
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
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, padding: '0 4px' }}>
                  {['Label', 'Roll From', 'Roll To', 'Pages', ''].map(h => (
                    <p key={h} className="t-badge t-mono" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{h}</p>
                  ))}
                </div>
                {sets.map((s, idx) => {
                  const cellInput: React.CSSProperties = { ...inputStyle, padding: '5px 7px', minWidth: 0 };
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, alignItems: 'center', padding: '6px 4px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      {/* Label */}
                      <input
                        value={s.label}
                        onChange={e => updateSet(idx, 'label', e.target.value)}
                        placeholder="Set 1"
                        style={{ ...cellInput, color: 'var(--accent-primary)', fontWeight: 600 }}
                      />
                      {/* Roll Start */}
                      <input
                        type="number"
                        min="1"
                        value={s.rollStart}
                        onChange={e => updateSet(idx, 'rollStart', e.target.value)}
                        placeholder="1"
                        style={cellInput}
                      />
                      {/* Roll End */}
                      <input
                        type="number"
                        min="1"
                        value={s.rollEnd}
                        onChange={e => updateSet(idx, 'rollEnd', e.target.value)}
                        placeholder="10"
                        style={cellInput}
                      />
                      {/* Pages */}
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
            <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublish}>Publish Assignment</button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function EditAssignmentSheet({ open, onClose, assignment }: { open: boolean; onClose: () => void; assignment: Assignment }) {
  const updateAssignment = useUpdateAssignment();
  const ensureSubjects = useEnsureSubjects();
  const { data: subjectsList = [] } = useSubjects();

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title, setTitle] = useState(assignment.title);
  const [subjectId, setSubjectId] = useState(assignment.subjectId || '');
  const [customSubjectName, setCustomSubjectName] = useState('');
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
  const [totalStudents, setTotalStudents] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [sets, setSets] = useState<AssignmentSet[]>(assignment.sets || []);

  const handleGenerate = () => {
    const t = parseInt(totalStudents), g = parseInt(groupSize);
    if (!t || !g || t < 1 || g < 1) { showToast('Enter valid numbers', 'error'); return; }
    setSets(autoGenerate(t, g));
    showToast(`Generated ${autoGenerate(t, g).length} sets`, 'info');
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
      showToast('Fill in all required fields', 'error'); return;
    }
    if (subjectId === 'other' && !customSubjectName.trim()) {
      showToast('Enter a custom subject name', 'error'); return;
    }
    if (hasSets && sets.length === 0) {
      showToast('Generate or add at least one set', 'error'); return;
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

      showToast('Assignment updated successfully! ✓', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update assignment', 'error');
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
              ? <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (!title.trim() || !subjectId || !dueDate || (subjectId === 'other' && !customSubjectName.trim())) { showToast('Fill required fields first', 'error'); return; } setStep(2); }}>Next →</button>
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
                <label style={labelStyle}>Group Size</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 6" value={groupSize} onChange={e => setGroupSize(e.target.value)} />
              </div>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const navigate = useNavigate();
  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const classRoll = authUser?.sectionRoll ?? '17';
  const { data: assignments = [], isLoading } = useAssignments({ limit: 100 });
  const deleteAssignmentMutation = useDeleteAssignment();
  const submitMutation = useSubmitAssignment();

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due' | 'created'>('due');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [openingSet, setOpeningSet] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [now] = useState(() => Date.now());

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setSelectedSubject('all');
  };

  const handleOpenPdfUrl = async (urlOrPath: string, title: string, pageRange?: string) => {
    if (openingSet) return;
    
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      const firstPage = pageRange ? (pageRange.match(/\d+/)?.[0] || '1') : '1';
      navigate(`/app/pdf-viewer?url=${encodeURIComponent(urlOrPath)}&page=${firstPage}&range=${encodeURIComponent(pageRange || '')}&title=${encodeURIComponent(title)}`);
      return;
    }
    
    setOpeningSet(urlOrPath);
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(urlOrPath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        const firstPage = pageRange ? (pageRange.match(/\d+/)?.[0] || '1') : '1';
        navigate(`/app/pdf-viewer?url=${encodeURIComponent(data.signedUrl)}&page=${firstPage}&range=${encodeURIComponent(pageRange || '')}&title=${encodeURIComponent(title)}`);
      }
    } catch (err) {
      console.error('[AssignmentsPage] Failed to open PDF:', err);
      showToast('Failed to open PDF viewer', 'error');
    } finally {
      setOpeningSet(null);
    }
  };

  const handleMarkSubmitted = async (id: string) => {
    try {
      await submitMutation.mutateAsync({ assignmentId: id, link: 'marked-submitted' });
      showToast('Marked as submitted ✓', 'success');
    } catch { showToast('Failed to submit', 'error'); }
  };

  // 2-day post-deadline expiry
  const enriched = assignments.filter(a => !isExpired(a.dueDate)).map(a => {
    const isSubmitted = a.status === 'submitted';
    const diff = new Date(a.dueDate).getTime() - now;
    const isOverdue = diff < 0 && !isSubmitted;
    return { ...a, isSubmitted, isOverdue };
  });

  // Calculate subject counts based on current status filter
  const subjectCounts = enriched.reduce((acc, a) => {
    let passes = true;
    if (filter === 'submitted') passes = a.isSubmitted;
    else if (filter === 'overdue') passes = a.isOverdue;
    else if (filter === 'pending') passes = !a.isSubmitted && !a.isOverdue;

    if (passes) {
      acc[a.subject] = (acc[a.subject] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueSubjects = Object.keys(subjectCounts).sort();

  const statusFiltered = enriched.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'submitted') return a.isSubmitted;
    if (filter === 'overdue') return a.isOverdue;
    if (filter === 'pending') return !a.isSubmitted && !a.isOverdue;
    return true;
  });

  const filtered = statusFiltered.filter(a => {
    if (selectedSubject === 'all') return true;
    return a.subject === selectedSubject;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'due') {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <div className="page-shell">
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', padding: '16px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 20px' }}>
          <button id="assign-back-btn" onClick={() => navigate('/app/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Assignments</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 12px', gap: 12 }}>
          <div className="filter-tabs" style={{ margin: 0, paddingBottom: 0 }}>
            {(['all', 'pending', 'submitted', 'overdue'] as Filter[]).map(f => (
              <button key={f} id={`assign-filter-${f}`} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => handleFilterChange(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>

          <div className="sort-dropdown-container">
            <button
              id="sort-dropdown-trigger"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: 500,
                minHeight: 32,
                userSelect: 'none',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
              <ArrowUpDown size={11} color="var(--accent-primary)" />
              <span>Sort: {sortBy === 'due' ? 'Due' : 'Created'}</span>
            </button>
            {showSortDropdown && (
              <div className="sort-dropdown-menu" style={{ right: 0, top: 'calc(100% + 6px)', background: 'rgba(18, 22, 36, 0.98)' }}>
                <button
                  className={`sort-dropdown-item${sortBy === 'due' ? ' active' : ''}`}
                  onClick={() => { setSortBy('due'); setShowSortDropdown(false); }}
                  style={{
                    color: sortBy === 'due' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: sortBy === 'due' ? 'rgba(74, 158, 255, 0.08)' : 'transparent',
                    fontWeight: sortBy === 'due' ? 600 : 400
                  }}
                >
                  <span>Due Date</span>
                </button>
                <button
                  className={`sort-dropdown-item${sortBy === 'created' ? ' active' : ''}`}
                  onClick={() => { setSortBy('created'); setShowSortDropdown(false); }}
                  style={{
                    color: sortBy === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: sortBy === 'created' ? 'rgba(74, 158, 255, 0.08)' : 'transparent',
                    fontWeight: sortBy === 'created' ? 600 : 400
                  }}
                >
                  <span>Date Created</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Swipeable Subject Scroller */}
        <div 
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '4px 20px 12px',
            WebkitOverflowScrolling: 'touch',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <button
            onClick={() => setSelectedSubject('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: selectedSubject === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
              background: selectedSubject === 'all' ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.02)',
              color: selectedSubject === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedSubject === 'all' ? 600 : 400,
              transition: 'all 0.2s ease',
              minHeight: 32,
            }}
          >
            All Subjects
            <span 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '16px',
                height: '16px',
                borderRadius: '50%',
                fontSize: '9px',
                fontWeight: 700,
                background: selectedSubject === 'all' ? 'var(--accent-primary)' : 'var(--border-default)',
                color: selectedSubject === 'all' ? '#000' : 'var(--text-muted)',
                marginLeft: '6px',
                padding: '0 4px',
              }}
            >
              {statusFiltered.length}
            </span>
          </button>

          {uniqueSubjects.map(subj => {
            const isSelected = selectedSubject === subj;
            const count = subjectCounts[subj];
            return (
              <button
                key={subj}
                onClick={() => setSelectedSubject(subj)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: isSelected ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.2s ease',
                  minHeight: 32,
                }}
              >
                {subj}
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    fontSize: '9px',
                    fontWeight: 700,
                    background: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                    color: isSelected ? '#000' : 'var(--text-muted)',
                    marginLeft: '6px',
                    padding: '0 4px',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>


      </header>

      <main className="page-content">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}><Loader size={24} color="var(--accent-primary)" className="spin" /></div>
        ) : sorted.length === 0
          ? <EmptyState icon={<PartyPopper size={36} color="var(--text-muted)" />} title="All clear!" subtitle="No assignments in this category" />
          : sorted.map(a => {
            const userSet = getUserSet(classRoll, a.sets ?? []);
            const isSubmitted = a.isSubmitted;
            
            const diff = new Date(a.dueDate).getTime() - now;
            const days = diff / (1000 * 60 * 60 * 24);
            
            let bdg = 'badge-info';
            let lbl = 'Pending';
            
            if (isSubmitted) {
              bdg = 'badge-safe';
              lbl = 'Submitted';
            } else if (a.isOverdue) {
              bdg = 'badge-critical';
              lbl = 'Overdue';
            } else if (days < 1) {
              bdg = 'badge-critical';
              lbl = 'Urgent';
            } else if (days < 2) {
              bdg = 'badge-warning';
              lbl = 'Tomorrow';
            }

            return (
              <article key={a.id} className="card" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getSubjectIcon(a.subject)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        {/* Subject is the primary heading */}
                        <h2 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{a.subject}</h2>
                        {/* Assignment title is secondary */}
                        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>{a.title}</p>
                      </div>
                      {role === 'cr' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            id={`edit-assign-${a.id}`}
                            onClick={() => {
                              setSelectedAssignment(a);
                              setEditOpen(true);
                            }}
                            style={{
                              background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)',
                              borderRadius: 8, padding: '5px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Edit assignment"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button
                            id={`del-assign-${a.id}`}
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this assignment?')) {
                                try { await deleteAssignmentMutation.mutateAsync(a.id); showToast('Assignment deleted', 'info'); } catch { showToast('Failed to delete', 'error'); }
                              }
                            }}
                            style={{
                              background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                              borderRadius: 8, padding: '5px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Delete assignment"
                          >
                            <Trash2 size={13} color="var(--status-critical)" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p className="t-caption" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{a.subjectCode}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className={`badge ${bdg}`}>{lbl}</span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                        Due {new Date(a.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {a.description ? (
                  <p className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{a.description}</p>
                ) : null}

                {/* ── Student set banner ── */}
                {a.hasSets && userSet ? (
                  <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,171,64,0.35)', background: 'rgba(255,171,64,0.07)', padding: '14px 14px 12px', marginBottom: 12 }}>
                    <p className="t-badge" style={{ color: 'rgba(255,171,64,0.9)', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={10} color="rgba(255,171,64,0.9)" /> YOUR ASSIGNMENT
                    </p>
                    <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
                      Based on Roll #{classRoll}, you are in{' '}
                      <span style={{ color: 'var(--accent-primary)' }}>{userSet.label}</span>
                    </p>
                    <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                      Complete the questions on{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        Pages {userSet.pageNumbers || '—'}
                      </strong>{' '}
                      of the attached PDF.
                    </p>
                  </div>
                ) : null}

                {/* Attachments list */}
                {a.attachments && a.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {a.attachments.map(att => (
                      <AttachmentCard
                        key={att.id}
                        attachment={att}
                        pageNumber={a.hasSets && userSet ? userSet.pageNumbers : undefined}
                      />
                    ))}
                  </div>
                )}

                {/* Non-set PDF link */}
                {!a.hasSets && a.pdfUrl ? (
                  <button
                    onClick={() => handleOpenPdfUrl(a.pdfUrl!, a.title)}
                    className="t-label"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      marginBottom: 12,
                      minHeight: 38,
                    }}
                  >
                    <FileText size={11} />
                    {openingSet === a.pdfUrl ? 'Opening...' : 'View PDF'}
                  </button>
                ) : null}

                {/* Submit area */}
                {isSubmitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.35)', borderRadius: 'var(--radius-md)', transition: 'all 0.3s ease' }}>
                    <CheckCircle2 size={15} color="var(--status-safe)" />
                    <p className="t-button" style={{ color: 'var(--status-safe)' }}>Submitted ✓</p>
                  </div>
                ) : (
                  <button className="t-button"
                    id={`submit-btn-${a.id}`}
                    onClick={() => handleMarkSubmitted(a.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--accent-primary)', width: '100%', transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,158,255,0.18)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-primary-glow)'; }}
                  >
                    <CheckCircle2 size={15} /> Mark as Submitted
                  </button>
                )}
              </article>
            );
          })
        }
      </main>

      {/* Create assignment sheet (CR only) */}
      <CreateAssignmentSheet open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit assignment sheet (CR only) */}
      {editOpen && selectedAssignment && (
        <EditAssignmentSheet open={editOpen} onClose={() => { setEditOpen(false); setSelectedAssignment(null); }} assignment={selectedAssignment} />
      )}

      <CROnly>
        <button id="add-assign-fab" className="fab" aria-label="Add assignment" onClick={() => setCreateOpen(true)}>
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
