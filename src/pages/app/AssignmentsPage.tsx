import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, Wand2, Trash2, FileText, PartyPopper, ArrowUpDown, ClipboardList, Loader2, ChevronDown, Check, MoreVertical, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore, isExpired } from '../../store/appStore';
import type { AssignmentSet, Assignment } from '../../store/appStore';
import { toast } from 'sonner';
import { useAssignments, useCreateAssignment, useDeleteAssignment, useUpdateAssignment, useSubmitAssignment, useUnsubmitAssignment } from '../../hooks/useAssignments';
import { useToggleArchiveAssignment } from '../../hooks/useSectionAdmin';
import { haptics } from '../../lib/haptics';
import { useSubjects, useEnsureSubjects } from '../../hooks/useSubjects';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentCard } from '../../components/AttachmentCard';
import { supabase } from '../../lib/supabase';
import { uploadAttachments } from '../../lib/utils/uploadAttachment';
import Skeleton from 'react-loading-skeleton';
import { deleteShare, getShare, retainFailedShareFiles, updateShare } from '../../lib/shareInbox';
import { parseSharedText } from '../../lib/utils/smartTextParser';
import { generateGradient } from '../../lib/utils';
import { logEvent } from '../../lib/analytics';

import { UnitTestsTab } from './assignments/UnitTestsTab';
import { CreateUnitTestModal } from './assignments/CreateUnitTestModal';
import { useUnitTests } from '../../hooks/useUnitTests';

type Filter = 'all' | 'pending' | 'submitted' | 'overdue' | 'archived';



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

function getUserSet(classRoll: string, sets: AssignmentSet[]) {
  if (!sets || sets.length === 0) return null;
  const roll = parseInt(classRoll, 10);
  return sets.find(s => roll >= s.rollStart && roll <= s.rollEnd) ?? null;
}

function autoGenerate(totalStudents: number, numSets: number, excludeFirstPage: boolean): AssignmentSet[] {
  const sets: AssignmentSet[] = [];
  if (numSets < 1) return sets;
  const groupSize = Math.ceil(totalStudents / numSets);
  let roll = 1, setNum = 1;
  const startPage = excludeFirstPage ? 2 : 1;
  while (roll <= totalStudents) {
    const end = Math.min(roll + groupSize - 1, totalStudents);
    const pageNum = startPage + setNum - 1;
    sets.push({
      id: `set-${setNum}-${Date.now()}`,
      label: `Set ${setNum}`,
      rollStart: roll,
      rollEnd: end,
      pageNumbers: String(pageNum),
      description: `Complete Page ${pageNum} of the attached PDF.`,
      pdfUrl: null,
    });
    roll = end + 1;
    setNum++;
  }
  return sets;
}

function CreateAssignmentSheet({ open, onClose, shareInboxId }: { open: boolean; onClose: () => void; shareInboxId?: string }) {
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

function AssignmentsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 0, padding: '16px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Skeleton width={44} height={44} borderRadius={12} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Skeleton width={70} height={16} borderRadius="var(--radius-pill)" />
                <Skeleton width={100} height={16} />
              </div>
            </div>
          </div>
          <Skeleton width="95%" height={13} style={{ marginTop: 6, marginBottom: 4 }} />
          <Skeleton width="80%" height={13} style={{ marginTop: 6 }} />
          <Skeleton width="100%" height={38} borderRadius="var(--radius-md)" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const classRoll = authUser?.sectionRoll ?? '17';
  const { data: assignments = [], isLoading } = useAssignments({ limit: 100 });
  const { data: unitTests = [] } = useUnitTests();
  const deleteAssignmentMutation = useDeleteAssignment();
  const toggleArchiveMutation = useToggleArchiveAssignment();
  const submitMutation = useSubmitAssignment();
  const unsubmitMutation = useUnsubmitAssignment();

  const [courseworkTab, setCourseworkTab] = useState<'assignments' | 'unit_tests'>('assignments');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due' | 'created'>('due');

  // Unit Tests Filter State
  const [utFilter, setUtFilter] = useState<'active' | 'past' | 'all'>('active');
  const [utSubject, setUtSubject] = useState<string>('all');
  const [utSortBy, setUtSortBy] = useState<'due' | 'created'>('due');

  const utUniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    unitTests.forEach(t => set.add(t.subject));
    return Array.from(set);
  }, [unitTests]);

  const [openingSet, setOpeningSet] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(() => Boolean(location.state?.openCreate));
  const [createUnitTestOpen, setCreateUnitTestOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openCreate) {
      setCreateOpen(true);
    }
  }, [location.state?.openCreate]);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [now] = useState(() => Date.now());
  const [highlightId] = useState<string | null>(() => new URLSearchParams(location.search).get('highlight'));
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authUser?.id && authUser?.sectionId) {
      logEvent('assignment_viewed', authUser.id, authUser.sectionId);
    }
  }, [authUser]);

  // Scroll to highlighted assignment when data loads
  useEffect(() => {
    if (!highlightId || !assignments.length) return;
    const timer = setTimeout(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.history.replaceState({}, '', location.pathname);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, assignments]);

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setSelectedSubject('all');
  };

  const handleOpenPdfUrl = async (urlOrPath: string, title: string, pageRange?: string) => {
    if (authUser?.id && authUser?.sectionId) {
      logEvent('assignment_viewed', authUser.id, authUser.sectionId, { urlOrPath, title, pageRange });
    }
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
      toast.error('Failed to open PDF viewer');
    } finally {
      setOpeningSet(null);
    }
  };

  const handleMarkSubmitted = async (id: string) => {
    try {
      haptics.doublePulse();
      await submitMutation.mutateAsync({ assignmentId: id, link: 'marked-submitted' });
      if (authUser?.id && authUser?.sectionId) {
        logEvent('assignment_submitted', authUser.id, authUser.sectionId, { assignmentId: id });
      }
      toast.success('Marked as submitted', {
        duration: 4000,
        action: {
          label: 'Undo',
          onClick: () => handleUndo(id),
        },
      });
    } catch {
      toast.error('Failed to submit');
    }
  };

  const handleUndo = async (id: string) => {
    haptics.lightClick();
    try {
      await unsubmitMutation.mutateAsync({ assignmentId: id });
      toast.success('Submission undone');
    } catch {
      toast.error('Failed to undo submission');
    }
  };

  // 2-day post-deadline expiry & archive filtering
  const enriched = assignments.filter(a => {
    if (a.isArchived) return true;
    return !isExpired(a.dueDate);
  }).map(a => {
    const isSubmitted = a.status === 'submitted';
    const diff = new Date(a.dueDate).getTime() - now;
    const isOverdue = diff < 0 && !isSubmitted;
    return { ...a, isSubmitted, isOverdue };
  });

  // Calculate subject counts based on current status filter
  const subjectCounts = enriched.reduce((acc, a) => {
    let passes = true;
    if (filter === 'archived') passes = Boolean(a.isArchived);
    else if (a.isArchived) passes = false;
    else if (filter === 'submitted') passes = a.isSubmitted;
    else if (filter === 'overdue') passes = a.isOverdue;
    else if (filter === 'pending') passes = !a.isSubmitted && !a.isOverdue;

    if (passes) {
      acc[a.subject] = (acc[a.subject] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueSubjects = Object.keys(subjectCounts).sort();

  const statusFiltered = enriched.filter(a => {
    if (filter === 'archived') return Boolean(a.isArchived);
    if (a.isArchived) return false;
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
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', padding: '16px 0 10px' }}>
        {/* Top App Title & CR Create Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button id="assign-back-btn" onClick={() => navigate('/app/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }} aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="var(--accent-primary)" />
              <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Coursework</h1>
            </div>
          </div>

          {role === 'cr' && (
            <button
              onClick={() => courseworkTab === 'assignments' ? setCreateOpen(true) : setCreateUnitTestOpen(true)}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <Plus size={14} />
              <span>{courseworkTab === 'assignments' ? 'New Assignment' : 'New Unit Test'}</span>
            </button>
          )}
        </div>

        {/* Coursework Hub Segmented Switch */}
        <div style={{ padding: '0 20px 10px', display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setCourseworkTab('assignments')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              border: courseworkTab === 'assignments' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
              background: courseworkTab === 'assignments' ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
              color: courseworkTab === 'assignments' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Assignments</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({assignments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCourseworkTab('unit_tests')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              border: courseworkTab === 'unit_tests' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
              background: courseworkTab === 'unit_tests' ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
              color: courseworkTab === 'unit_tests' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Unit Tests</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({unitTests.length})</span>
          </button>
        </div>
        
        {/* Assignment Specific Filter Sub-bar */}
        {courseworkTab === 'assignments' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0', gap: 12 }}>
            {/* Status Dropdown Filter */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="filter-tab"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0 14px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    height: '38px',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>
                    {filter === 'all' ? 'All' : filter}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="dropdown-content animate-slide-up"
                  style={{ zIndex: 10000, minWidth: '180px' }}
                >
                  {(['all', 'pending', 'submitted', 'overdue', 'archived'] as Filter[]).map(f => {
                    const isSelected = filter === f;
                    return (
                      <DropdownMenu.Item
                        key={f}
                        onClick={() => handleFilterChange(f)}
                        className="dropdown-item"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                          fontWeight: isSelected ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          textTransform: 'capitalize',
                        }}
                      >
                        <span>{f === 'all' ? 'All Assignments' : f}</span>
                        {isSelected && <Check size={14} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Right Filters Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Subject Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0 14px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      height: '38px',
                      maxWidth: '160px',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSubject === 'all' ? 'All Subjects' : getSubjectAcronym(selectedSubject)}
                    </span>
                    <ChevronDown size={14} style={{ opacity: 0.6 }} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up no-scrollbar"
                    style={{ zIndex: 10000, minWidth: '220px', maxWidth: '300px', maxHeight: '300px', overflowY: 'auto' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setSelectedSubject('all')}
                      className="dropdown-item"
                      style={{
                        color: selectedSubject === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: selectedSubject === 'all' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: selectedSubject === 'all' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>All Subjects</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                          {statusFiltered.length}
                        </span>
                        {selectedSubject === 'all' && <Check size={14} />}
                      </div>
                    </DropdownMenu.Item>

                    {uniqueSubjects.map(subj => {
                      const isSelected = selectedSubject === subj;
                      const count = subjectCounts[subj];
                      return (
                        <DropdownMenu.Item
                          key={subj}
                          onClick={() => setSelectedSubject(subj)}
                          className="dropdown-item"
                          style={{
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                            fontWeight: isSelected ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                            {subj}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                              {count}
                            </span>
                            {isSelected && <Check size={14} />}
                          </div>
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Sort Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '38px',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <ArrowUpDown size={14} color="var(--accent-primary)" />
                    <span>Sort: {sortBy === 'due' ? 'Due' : 'Created'}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up"
                    style={{ zIndex: 10000, minWidth: '150px' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setSortBy('due')}
                      className="dropdown-item"
                      style={{
                        color: sortBy === 'due' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: sortBy === 'due' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: sortBy === 'due' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Due Date</span>
                      {sortBy === 'due' && <Check size={14} />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => setSortBy('created')}
                      className="dropdown-item"
                      style={{
                        color: sortBy === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: sortBy === 'created' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: sortBy === 'created' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Date Created</span>
                      {sortBy === 'created' && <Check size={14} />}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        )}

        {/* Unit Tests Specific Filter Sub-bar in Header */}
        {courseworkTab === 'unit_tests' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0', gap: 12 }}>
            {/* Status Dropdown Filter */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="filter-tab"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0 14px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    height: '38px',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>
                    {utFilter === 'active' ? 'Active' : utFilter === 'past' ? 'Past & Submitted' : 'All'}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="dropdown-content animate-slide-up"
                  style={{ zIndex: 10000, minWidth: '180px' }}
                >
                  {[
                    { key: 'active', label: 'Active Tests' },
                    { key: 'past', label: 'Past & Submitted' },
                    { key: 'all', label: 'All Tests' },
                  ].map(item => {
                    const isSelected = utFilter === item.key;
                    return (
                      <DropdownMenu.Item
                        key={item.key}
                        onClick={() => setUtFilter(item.key as any)}
                        className="dropdown-item"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                          fontWeight: isSelected ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span>{item.label}</span>
                        {isSelected && <Check size={14} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Right Filters Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Subject Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0 14px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      height: '38px',
                      maxWidth: '160px',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {utSubject === 'all' ? 'All Subjects' : getSubjectAcronym(utSubject)}
                    </span>
                    <ChevronDown size={14} style={{ opacity: 0.6 }} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up no-scrollbar"
                    style={{ zIndex: 10000, minWidth: '220px', maxWidth: '300px', maxHeight: '300px', overflowY: 'auto' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setUtSubject('all')}
                      className="dropdown-item"
                      style={{
                        color: utSubject === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSubject === 'all' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSubject === 'all' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>All Subjects</span>
                      {utSubject === 'all' && <Check size={14} />}
                    </DropdownMenu.Item>

                    {utUniqueSubjects.map((subj: string) => {
                      const isSelected = utSubject === subj;
                      return (
                        <DropdownMenu.Item
                          key={subj}
                          onClick={() => setUtSubject(subj)}
                          className="dropdown-item"
                          style={{
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                            fontWeight: isSelected ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                            {subj}
                          </span>
                          {isSelected && <Check size={14} />}
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Sort Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '38px',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <ArrowUpDown size={14} color="var(--accent-primary)" />
                    <span>Sort: {utSortBy === 'due' ? 'Due' : 'Created'}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up"
                    style={{ zIndex: 10000, minWidth: '150px' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setUtSortBy('due')}
                      className="dropdown-item"
                      style={{
                        color: utSortBy === 'due' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSortBy === 'due' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSortBy === 'due' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Due Date</span>
                      {utSortBy === 'due' && <Check size={14} />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => setUtSortBy('created')}
                      className="dropdown-item"
                      style={{
                        color: utSortBy === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSortBy === 'created' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSortBy === 'created' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Date Created</span>
                      {utSortBy === 'created' && <Check size={14} />}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        )}
      </header>

      <main className="page-content">
        {courseworkTab === 'unit_tests' ? (
          <UnitTestsTab filter={utFilter} selectedSubject={utSubject} sortBy={utSortBy} />
        ) : isLoading ? (
          <AssignmentsSkeleton />
        ) : sorted.length === 0 ? (
          <EmptyState icon={<PartyPopper size={36} color="var(--text-muted)" />} title="All clear!" subtitle="No assignments in this category" />
        ) : (
          sorted.map(a => {
            const userSet = getUserSet(classRoll, a.sets ?? []);
            const isSubmitted = a.isSubmitted;
            
            const diff = new Date(a.dueDate).getTime() - now;
            const days = diff / (1000 * 60 * 60 * 24);
            
            let bdg = 'badge-info';
            let lbl = 'Pending';
            
            if (isSubmitted) {
              if (a.crVerified) {
                bdg = 'badge-safe';
                lbl = 'Marked ✓';
              } else {
                bdg = 'badge-warning';
                lbl = 'Submitted';
              }
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

            const isHighlighted = highlightId === a.id;
            return (
              <article
                key={a.id}
                ref={isHighlighted ? highlightRef : null}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  animation: 'fadeSlideUp 0.35s ease both',
                  outline: isHighlighted ? '2px solid var(--accent-primary)' : undefined,
                  outlineOffset: isHighlighted ? '2px' : undefined,
                  boxShadow: isHighlighted ? '0 0 0 4px rgba(74,158,255,0.15)' : undefined,
                }}
              >
                {/* Decluttered Card Header: Subject, Title, Badges, CR Menu */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: generateGradient(a.subjectCode || a.subject),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                      }}
                    >
                      <span className="t-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {getSubjectAcronym(a.subject)}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h2 className="t-card-title truncate" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px' }} title={a.subject}>
                        {a.subject}
                      </h2>
                      <p className="t-body-medium truncate" style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontWeight: 500, fontSize: '13px' }}>
                        {a.title}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {a.isArchived && (
                      <span className="badge" style={{
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '11px',
                      }}>
                        <Archive size={11} />
                        Archived
                      </span>
                    )}
                    <span className={`badge ${bdg}`} style={{ fontSize: '11px' }}>{lbl}</span>
                    <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      Due • {new Date(a.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>

                    {role === 'cr' ? (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 8,
                              padding: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              outline: 'none',
                              color: 'var(--text-secondary)',
                            }}
                            aria-label="More actions"
                            title="More actions"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              minWidth: 150,
                              backgroundColor: 'var(--bg-surface-elevated, #1e293b)',
                              borderRadius: 8,
                              padding: 4,
                              boxShadow: '0px 10px 38px -10px rgba(22, 23, 24, 0.35), 0px 10px 20px -15px rgba(22, 23, 24, 0.2)',
                              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                              zIndex: 10000,
                            }}
                            sideOffset={5}
                            align="end"
                          >
                            <DropdownMenu.Item
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssignment(a);
                                setEditOpen(true);
                              }}
                              style={{
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              <Pencil size={13} color="var(--accent-primary, #6366f1)" />
                              <span>Edit</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await toggleArchiveMutation.mutateAsync({
                                    assignmentId: a.id,
                                    isArchived: !a.isArchived,
                                  });
                                  toast.success(a.isArchived ? 'Assignment restored' : 'Assignment archived');
                                } catch {
                                  toast.error('Failed to update archive status');
                                }
                              }}
                              style={{
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              {a.isArchived ? <ArchiveRestore size={13} color="var(--accent-primary)" /> : <Archive size={13} color="var(--text-secondary)" />}
                              <span>{a.isArchived ? 'Restore' : 'Archive'}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this assignment?')) {
                                  try {
                                    await deleteAssignmentMutation.mutateAsync(a.id);
                                    toast.info('Assignment deleted');
                                  } catch {
                                    toast.error('Failed to delete');
                                  }
                                }
                              }}
                              style={{
                                fontSize: '13px',
                                color: '#ef4444',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              <Trash2 size={13} color="#ef4444" />
                              <span>Delete</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    ) : null}
                  </div>
                </div>

                {a.description ? (
                  <p className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontSize: '13px' }}>{a.description}</p>
                ) : null}

                {/* Helpful Student Set Guidance Card */}
                {a.hasSets && userSet ? (
                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(74, 158, 255, 0.2)',
                    background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.08) 0%, rgba(74, 158, 255, 0.02) 100%)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Your Assigned Set: {userSet.label}
                      </span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        Roll {userSet.rollStart}–{userSet.rollEnd}
                      </span>
                    </div>
                    <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '13.5px', fontWeight: 500, lineHeight: 1.45 }}>
                      {userSet.description 
                        ? userSet.description 
                        : `Solve questions on Pages ${userSet.pageNumbers || '—'} of the attached assignment.`}
                    </p>
                  </div>
                ) : null}

                {/* Attachments list */}
                {a.attachments && a.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      minHeight: 36,
                      width: 'fit-content',
                    }}
                  >
                    <FileText size={13} />
                    {openingSet === a.pdfUrl ? 'Opening...' : 'View PDF'}
                  </button>
                ) : null}

                {isSubmitted ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: a.crVerified ? 'var(--status-safe-bg)' : 'var(--status-warning-bg)',
                      border: a.crVerified ? '1px solid rgba(52,201,123,0.35)' : '1px solid rgba(251,146,60,0.35)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <CheckCircle2 size={15} color={a.crVerified ? 'var(--status-safe)' : 'var(--status-warning)'} />
                    <p className="t-button" style={{ color: a.crVerified ? 'var(--status-safe)' : 'var(--status-warning)', margin: 0, fontSize: '13px' }}>
                      {a.crVerified ? 'Marked ✓' : 'Submitted (Pending from CR)'}
                    </p>
                  </div>
                ) : (
                  <button
                    className="t-button active:scale-[0.98] transition-transform duration-150"
                    id={`submit-btn-${a.id}`}
                    onClick={() => handleMarkSubmitted(a.id)}
                    disabled={submitMutation.isPending}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: 'var(--accent-primary-glow)',
                      border: '1px solid rgba(74,158,255,0.4)',
                      borderRadius: 'var(--radius-md)',
                      cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
                      color: 'var(--accent-primary)',
                      width: '100%',
                      fontWeight: 600,
                      fontSize: '13px',
                      opacity: submitMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {submitMutation.isPending && submitMutation.variables?.assignmentId === a.id ? (
                      <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>{submitMutation.isPending && submitMutation.variables?.assignmentId === a.id ? 'Submitting…' : 'Mark as Submitted'}</span>
                  </button>
                )}
              </article>
            );
          })
        )}
      </main>

      {/* Create assignment sheet (CR only) */}
      <CreateAssignmentSheet 
        open={createOpen} 
        shareInboxId={location.state?.shareInboxId} 
        onClose={() => {
          setCreateOpen(false);
          if (location.state?.openCreate || location.state?.shareInboxId) {
            navigate(location.pathname, { replace: true, state: {} });
          }
        }} 
      />

      {/* Create Unit Test sheet (CR only) */}
      <CreateUnitTestModal
        open={createUnitTestOpen}
        onClose={() => setCreateUnitTestOpen(false)}
      />

      {/* Edit assignment sheet (CR only) */}
      {editOpen && selectedAssignment && (
        <EditAssignmentSheet open={editOpen} onClose={() => { setEditOpen(false); setSelectedAssignment(null); }} assignment={selectedAssignment} />
      )}

      <CROnly>
        <button
          id="add-assign-fab"
          className="fab"
          aria-label={courseworkTab === 'assignments' ? 'Add assignment' : 'Add unit test'}
          onClick={() => courseworkTab === 'assignments' ? setCreateOpen(true) : setCreateUnitTestOpen(true)}
        >
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
