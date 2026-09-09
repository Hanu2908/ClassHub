import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wand2, Trash2, Loader2 } from 'lucide-react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useAppStore } from '../../../store/appStore';
import type { AssignmentSet } from '../../../store/appStore';
import { toast } from 'sonner';
import { useCreateAssignment } from '../../../hooks/useAssignments';
import { useSubjects, useEnsureSubjects } from '../../../hooks/useSubjects';
import { FileUploader } from '../../../components/FileUploader';
import { uploadAttachments } from '../../../lib/utils/uploadAttachment';
import { deleteShare, getShare, retainFailedShareFiles, updateShare } from '../../../lib/shareInbox';
import { parseSharedText } from '../../../lib/utils/smartTextParser';
import { autoGenerate } from './assignmentUtils';

export function CreateAssignmentSheet({ open, onClose, shareInboxId }: { open: boolean; onClose: () => void; shareInboxId?: string }) {
  const navigate = useNavigate();
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>('all');

  const detectBatch = (text: string): 'all' | '1' | '2' => {
    const lower = text.toLowerCase();
    if (lower.includes('batch 1') || lower.includes('b1') || lower.includes('batch-1')) return '1';
    if (lower.includes('batch 2') || lower.includes('b2') || lower.includes('batch-2')) return '2';
    return 'all';
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const parsed = detectBatch(val + ' ' + description);
    if (parsed !== 'all') setTargetBatch(parsed);
  };

  const handleDescChange = (val: string) => {
    setDescription(val);
    const parsed = detectBatch(title + ' ' + val);
    if (parsed !== 'all') setTargetBatch(parsed);
  };

  // Step 2 fields
  const [totalStudents, setTotalStudents] = useState('60');
  const [numSets, setNumSets] = useState('');
  const [excludeFirstPage, setExcludeFirstPage] = useState(false);
  const [sets, setSets] = useState<AssignmentSet[]>([]);

  useEffect(() => {
    if (!open || !shareInboxId) return;
    getShare(shareInboxId).then((entry) => {
      if (!entry) return;
      setFiles(entry.files);

      const parsed = parseSharedText(entry.caption, subjectsList);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.subjectId) setSubjectId(parsed.subjectId);
      if (parsed.dueDate) setDueDate(parsed.dueDate.slice(0, 10));
      setDescription(parsed.body || entry.caption);
      // Consume the share item from the inbox as soon as it is populated in the composer
      deleteShare(shareInboxId).catch(err => {
        console.warn('[AssignmentsPage] Error deleting consumed share:', err);
      });
    }).catch(() => toast.error('Failed to restore shared files'));
  }, [open, shareInboxId, subjectsList]);

  const draftLoadedRef = useRef(false);

  // Load draft from localStorage on mount (when sheet opens)
  useEffect(() => {
    if (open) {
      if (draftLoadedRef.current) return;
      draftLoadedRef.current = true;
      const saved = localStorage.getItem('classhub-draft-assignment');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          const hasDraftContent = !!(
            draft.title?.trim() ||
            draft.subjectId ||
            draft.customSubjectName?.trim() ||
            draft.dueDate ||
            draft.description?.trim() ||
            draft.hasSets
          );

          const isStateEmpty = !title && !subjectId && !customSubjectName && !dueDate && !description && !hasSets;

          if (draft.title) setTitle(draft.title);
          if (draft.subjectId) setSubjectId(draft.subjectId);
          if (draft.customSubjectName) setCustomSubjectName(draft.customSubjectName);
          if (draft.dueDate) setDueDate(draft.dueDate);
          if (draft.description) setDescription(draft.description);
          if (draft.hasSets !== undefined) setHasSets(draft.hasSets);

          if (hasDraftContent && isStateEmpty) {
            toast.success('Draft recovered! ✓');
          }
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    } else {
      draftLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Save draft to localStorage on fields change
  useEffect(() => {
    if (open) {
      const draft = { title, subjectId, customSubjectName, dueDate, description, hasSets };
      if (title.trim() || subjectId || customSubjectName.trim() || dueDate || description.trim() || hasSets) {
        localStorage.setItem('classhub-draft-assignment', JSON.stringify(draft));
      } else {
        localStorage.removeItem('classhub-draft-assignment');
      }
    }
  }, [title, subjectId, customSubjectName, dueDate, description, hasSets, open]);

  const reset = () => {
    setStep(1); setTitle(''); setSubjectId(''); setCustomSubjectName('');
    setDueDate(''); setDescription(''); setFiles([]); setHasSets(false);
    setTotalStudents('60'); setNumSets(''); setExcludeFirstPage(false); setSets([]); setUploadProgress(0);
    setTargetBatch('all');
  };

  const handleClose = () => { reset(); onClose(); };

  // Auto-detect PDF pages
  useEffect(() => {
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        file.arrayBuffer().then(async (ab) => {
          try {
            const { PDFDocument } = await import('pdf-lib');
            const pdfDoc = await PDFDocument.load(ab);
            const pageCount = pdfDoc.getPageCount();
            const setsCount = excludeFirstPage ? Math.max(1, pageCount - 1) : pageCount;
            setNumSets(String(setsCount));
          } catch (err) {
            console.error('Failed to parse PDF', err);
          }
        });
      }
    }
  }, [files, excludeFirstPage]);

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

  const handlePublish = async () => {
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
        targetBatch: targetBatch === 'all' ? null : targetBatch,
      });

      if (parentId && files.length > 0) {
        if (!sectionId || !userId) throw new Error('Missing section context or user context');
        
        const uploadResult = await uploadAttachments(files, {
          sectionId,
          parentType: 'assignment',
          parentId,
          userId,
          onProgress: () => setUploadProgress(prev => prev + 1),
        });

        if (uploadResult.failed.length > 0) {
          toast.warning(`${uploadResult.failed.length} file(s) failed to upload`);
          if (shareInboxId) {
            const entry = await getShare(shareInboxId);
            if (entry) {
              await updateShare({
                ...entry,
                files: retainFailedShareFiles(files, uploadResult.failed),
                state: 'attachment-retry',
                destination: 'assignment',
                parentId,
              });
              navigate(`/share-intake?id=${encodeURIComponent(shareInboxId)}`, { replace: true });
              return;
            }
          }
        } else if (shareInboxId) {
          await deleteShare(shareInboxId);
        }
      } else if (shareInboxId) {
        await deleteShare(shareInboxId);
      }

      toast.success('Assignment published! ✓');
      localStorage.removeItem('classhub-draft-assignment');
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
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
            <input style={inputStyle} placeholder="e.g. DBMS Unit 3 Assignment" value={title} onChange={e => handleTitleChange(e.target.value)} />
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
            <label style={labelStyle}>Target Batch</label>
            <select style={inputStyle} value={targetBatch} onChange={e => setTargetBatch(e.target.value as any)}>
              <option value="all">Full Section (All)</option>
              <option value="1">Batch 1 Only</option>
              <option value="2">Batch 2 Only</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date & Time <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input style={inputStyle} type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="Instructions for students…" value={description} onChange={e => handleDescChange(e.target.value)} />
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
              ? <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (!title.trim() || !subjectId || !dueDate || (subjectId === 'other' && !customSubjectName.trim())) { toast.error('Fill required fields first'); return; } setStep(2); }}>Next →</button>
              : <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handlePublish} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  {pending 
                    ? (uploadProgress > 0 && files.length > 0
                      ? `Uploading (${uploadProgress}/${files.length})…`
                      : 'Publishing…')
                    : 'Publish'}
                </button>
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
                id="exclude-first-page"
                checked={excludeFirstPage}
                onChange={e => setExcludeFirstPage(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="exclude-first-page" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, userSelect: 'none' }}>
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
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)} disabled={pending}>← Back</button>
            <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handlePublish} disabled={pending}>
              {pending && <Loader2 className="animate-spin" size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {pending 
                ? (uploadProgress > 0 && files.length > 0
                  ? `Uploading (${uploadProgress}/${files.length})…`
                  : 'Publishing…')
                : 'Publish Assignment'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
