import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'motion/react';

import { BottomSheet } from '../../../components/BottomSheet';
import { FileUploader } from '../../../components/FileUploader';
import { useCreateAnnouncement } from '../../../hooks/useAnnouncements';
import { useSubjects } from '../../../hooks/useSubjects';
import { useSectionMembers } from '../../../hooks/useSectionMembers';
import { useAppStore } from '../../../store/appStore';
import { uploadAttachments } from '../../../lib/utils/uploadAttachment';
import { deleteShare, getShare, retainFailedShareFiles, updateShare } from '../../../lib/shareInbox';
import { parseSharedText } from '../../../lib/utils/smartTextParser';

interface CreateAnnouncementSheetProps {
  open: boolean;
  onClose: () => void;
  shareInboxId?: string;
}

export function CreateAnnouncementSheet({ open, onClose, shareInboxId }: CreateAnnouncementSheetProps) {
  const navigate = useNavigate();
  const createAnn = useCreateAnnouncement();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;

  const { data: subjects = [] } = useSubjects();
  const globalSelectedSubjectId = useAppStore(s => s.selectedSubjectId);
  const role = useAppStore(s => s.role);
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => {
    return role === 'teacher' ? (globalSelectedSubjectId || '') : '';
  });

  useEffect(() => {
    if (open && role === 'teacher' && globalSelectedSubjectId) {
      setSelectedSubjectId(globalSelectedSubjectId);
    }
  }, [open, role, globalSelectedSubjectId]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>('all');
  const [priority, setPriority] = useState<'general' | 'critical'>('general');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Autocomplete Mentions
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: sectionMembers = [] } = useSectionMembers();
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionFilterText, setMentionFilterText] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  const filteredMembers = useMemo(() => {
    if (!showMentionSuggestions) return [];
    const query = mentionFilterText.toLowerCase();
    return sectionMembers
      .filter(m => m.name.toLowerCase().includes(query) && m.id !== userId)
      .slice(0, 5);
  }, [showMentionSuggestions, mentionFilterText, sectionMembers, userId]);

  // Smart Parsing: regex check if title/body mentions a group/batch number
  const detectBatch = (text: string): 'all' | '1' | '2' => {
    const lower = text.toLowerCase();
    if (
      lower.includes('batch 1') || lower.includes('b1') || lower.includes('batch-1') ||
      lower.includes('group 1') || lower.includes('g1') || lower.includes('group-1')
    ) return '1';
    if (
      lower.includes('batch 2') || lower.includes('b2') || lower.includes('batch-2') ||
      lower.includes('group 2') || lower.includes('g2') || lower.includes('group-2')
    ) return '2';
    return 'all';
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const parsed = detectBatch(val + ' ' + body);
    if (parsed !== 'all') setTargetBatch(parsed);
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    const parsed = detectBatch(title + ' ' + val);
    if (parsed !== 'all') setTargetBatch(parsed);

    // Mentions parsing
    if (!textareaRef.current) return;
    const selectionEnd = textareaRef.current.selectionEnd;
    const textBeforeCursor = val.slice(0, selectionEnd);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
      const hasWhitespace = /\s/.test(textAfterAt);
      const isPrecededBySpace = lastAtIdx === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIdx - 1));

      if (!hasWhitespace && isPrecededBySpace) {
        setShowMentionSuggestions(true);
        setMentionFilterText(textAfterAt);
        setMentionTriggerIndex(lastAtIdx);
        return;
      }
    }
    setShowMentionSuggestions(false);
    setMentionFilterText('');
    setMentionTriggerIndex(-1);
  };

  const handleSelectMention = (memberName: string) => {
    if (mentionTriggerIndex === -1 || !textareaRef.current) return;
    const val = body;
    const selectionEnd = textareaRef.current.selectionEnd;
    const prefix = val.slice(0, mentionTriggerIndex);
    const suffix = val.slice(selectionEnd);
    const cleanName = memberName.replace(/\s+/g, '');
    const mentionString = `@${cleanName} `;
    const newVal = prefix + mentionString + suffix;
    setBody(newVal);
    setShowMentionSuggestions(false);
    setMentionFilterText('');
    setMentionTriggerIndex(-1);
    const newCursorPos = mentionTriggerIndex + mentionString.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const draftLoadedRef = useRef(false);

  // Load draft from localStorage on mount (when sheet opens and no shareInboxId)
  useEffect(() => {
    if (open) {
      if (draftLoadedRef.current || shareInboxId) return;
      draftLoadedRef.current = true;
      const saved = localStorage.getItem('classhub-draft-announcement');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          const hasDraftContent = !!(
            draft.title?.trim() ||
            draft.body?.trim() ||
            draft.selectedSubjectId ||
            draft.deadlineDate
          );
          if (draft.title) setTitle(draft.title);
          if (draft.body) setBody(draft.body);
          if (draft.selectedSubjectId) setSelectedSubjectId(draft.selectedSubjectId);
          if (draft.priority) setPriority(draft.priority);
          if (draft.targetBatch) setTargetBatch(draft.targetBatch);
          if (draft.hasDeadline) setHasDeadline(draft.hasDeadline);
          if (draft.deadlineDate) setDeadlineDate(draft.deadlineDate);

          if (hasDraftContent) {
            toast.success('Announcement draft restored ✓');
          }
        } catch (e) {
          console.error('[AnnouncementsPage] Failed to parse announcement draft:', e);
        }
      }
    } else {
      draftLoadedRef.current = false;
    }
  }, [open, shareInboxId]);

  // Save draft to localStorage on field changes
  useEffect(() => {
    if (open && !shareInboxId) {
      const draft = { title, body, selectedSubjectId, priority, targetBatch, hasDeadline, deadlineDate };
      if (title.trim() || body.trim() || selectedSubjectId || deadlineDate) {
        localStorage.setItem('classhub-draft-announcement', JSON.stringify(draft));
      } else {
        localStorage.removeItem('classhub-draft-announcement');
      }
    }
  }, [open, title, body, selectedSubjectId, priority, targetBatch, hasDeadline, deadlineDate, shareInboxId]);

  useEffect(() => {
    if (!shareInboxId) return;
    getShare(shareInboxId).then((entry) => {
      if (!entry) return;
      setFiles(entry.files);

      const parsed = parseSharedText(entry.caption, subjects);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.subjectId) setSelectedSubjectId(parsed.subjectId);
      if (parsed.priority === 'critical') setPriority('critical');
      if (parsed.dueDate) {
        setHasDeadline(true);
        setDeadlineDate(parsed.dueDate.slice(0, 10));
      }
      setBody(parsed.body || entry.caption);
      deleteShare(shareInboxId).catch(err => {
        console.warn('[AnnouncementsPage] Error deleting consumed share:', err);
      });
    }).catch(() => toast.error('Failed to restore shared files'));
  }, [shareInboxId, subjects]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handlePost = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    
    // Capture state snapshot for background worker
    const currentTitle = title.trim();
    const currentBody = body.trim();
    const currentSubjectId = selectedSubjectId;
    const currentPriority = priority;
    const currentDeadline = hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null;
    const currentTargetBatch = targetBatch === 'all' ? null : targetBatch;
    const currentFiles = [...files];
    const currentShareInboxId = shareInboxId;

    // Reset form & close modal instantly (0ms perceived delay)
    setTitle('');
    setBody('');
    setTargetBatch('all');
    setSelectedSubjectId('');
    setHasDeadline(false);
    setDeadlineDate('');
    setFiles([]);
    onClose();

    const toastId = toast.loading(
      currentFiles.length > 0 
        ? `Posting announcement and uploading ${currentFiles.length} file(s)...` 
        : 'Posting announcement...'
    );

    // Run creation and compressed upload asynchronously in background
    (async () => {
      try {
        const finalBody = currentSubjectId
          ? `${currentBody}\n<!-- subject_id:${currentSubjectId} -->`
          : currentBody;

        const parentId = await createAnn.mutateAsync({
          title: currentTitle,
          message: finalBody,
          priority: currentPriority,
          deadline: currentDeadline,
          targetBatch: currentTargetBatch,
        });

        if (parentId && currentFiles.length > 0) {
          if (!sectionId || !userId) throw new Error('Missing section context or user context');
          
          let completedCount = 0;
          const uploadResult = await uploadAttachments(currentFiles, {
            sectionId,
            parentType: 'announcement',
            parentId,
            userId,
            onProgress: () => {
              completedCount++;
              setUploadProgress(completedCount);
              toast.loading(`Uploading attachments (${completedCount}/${currentFiles.length})...`, { id: toastId });
            },
          });

          if (uploadResult.failed.length > 0) {
            toast.warning(`${uploadResult.failed.length} file(s) failed to upload`, { id: toastId });
            if (currentShareInboxId) {
              const entry = await getShare(currentShareInboxId);
              if (entry) {
                await updateShare({
                  ...entry,
                  files: retainFailedShareFiles(currentFiles, uploadResult.failed),
                  state: 'attachment-retry',
                  destination: 'announcement',
                  parentId,
                });
                navigate(`/share-intake?id=${encodeURIComponent(currentShareInboxId)}`, { replace: true });
                return;
              }
            }
          } else {
            if (currentShareInboxId) {
              await deleteShare(currentShareInboxId);
            }
            toast.success('Announcement and attachments posted ✓', { id: toastId });
          }
        } else {
          if (currentShareInboxId) {
            await deleteShare(currentShareInboxId);
          }
          toast.success('Announcement posted ✓', { id: toastId });
        }

        // Clear saved draft on success
        localStorage.removeItem('classhub-draft-announcement');
      } catch (err: unknown) {
        console.error('[AnnouncementsPage] Failed to post announcement:', err);
        const draft = {
          title: currentTitle,
          body: currentBody,
          selectedSubjectId: currentSubjectId,
          priority: currentPriority,
          targetBatch: currentTargetBatch,
          hasDeadline: Boolean(currentDeadline),
          deadlineDate: currentDeadline ? currentDeadline.slice(0, 10) : ''
        };
        localStorage.setItem('classhub-draft-announcement', JSON.stringify(draft));
        
        toast.error('Failed to post announcement. Draft preserved.', {
          id: toastId,
          action: {
            label: 'Reopen Draft',
            onClick: () => {
              navigate('/app/announcements', { state: { openCreate: true } });
            },
          },
        });
      } finally {
        setIsPosting(false);
        setUploadProgress(0);
      }
    })();
  };

  const pending = createAnn.isPending || isPosting;

  return (
    <BottomSheet open={open} onClose={onClose} title="Post Announcement">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
        <div>
          <label htmlFor="composer-title" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input 
            id="composer-title"
            style={inputStyle} 
            className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
            placeholder="e.g. End Semester Exam Schedule" 
            value={title} 
            onChange={e => handleTitleChange(e.target.value)} 
          />
        </div>
        <div>
          <label htmlFor="composer-body" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message (Optional)</label>
          <div style={{ position: 'relative' }}>
            <textarea 
              ref={textareaRef}
              id="composer-body"
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} 
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              placeholder="Details of the announcement…" 
              value={body} 
              onChange={e => handleBodyChange(e.target.value)} 
            />
            <AnimatePresence>
              {showMentionSuggestions && filteredMembers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    marginBottom: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'rgba(10, 11, 18, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-elevated)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {filteredMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleSelectMention(member.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'background var(--transition-fast)',
                        outline: 'none',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {member.avatarUrl ? (
                          <img 
                            src={member.avatarUrl} 
                            alt={member.name} 
                            style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <span style={{ fontWeight: 500 }}>{member.name}</span>
                        {member.role === 'cr' && (
                          <span style={{
                            background: 'rgba(167, 139, 250, 0.15)',
                            color: 'var(--status-announcement)',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}>
                            CR
                          </span>
                        )}
                      </div>
                      {member.classRoll && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {member.classRoll}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="composer-target-batch" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Target Group</label>
            <select
              id="composer-target-batch"
              style={inputStyle}
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={targetBatch}
              onChange={e => setTargetBatch(e.target.value as any)}
            >
              <option value="all">Full Section (All)</option>
              <option value="1">Group 1 (G1)</option>
              <option value="2">Group 2 (G2)</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="composer-priority" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
            <select 
              id="composer-priority"
              style={inputStyle} 
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={priority} 
              onChange={e => setPriority(e.target.value as 'general' | 'critical')}
            >
              <option value="general">General</option>
              <option value="critical">Immediate</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="composer-subject" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Link Subject</label>
            <select 
              id="composer-subject"
              style={inputStyle} 
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={selectedSubjectId} 
              onChange={e => setSelectedSubjectId(e.target.value)}
            >
              <option value="">None / General</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasDeadline ? 8 : 0 }}>
            <input type="checkbox" id="composer-has-deadline" checked={hasDeadline} onChange={e => setHasDeadline(e.target.checked)} />
            <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Set a deadline</span>
          </label>
          {hasDeadline && (
            <div>
              <label htmlFor="composer-deadline" className="sr-only">Deadline Date</label>
              <input 
                id="composer-deadline"
                type="datetime-local" 
                style={inputStyle} 
                className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
                value={deadlineDate} 
                onChange={e => setDeadlineDate(e.target.value)} 
              />
            </div>
          )}
        </div>

        <div>
          <FileUploader files={files} onChange={setFiles} />
        </div>

        <button
          onClick={handlePost}
          disabled={pending} className="t-button" style={{ width: '100%', padding: '12px', 
            background: pending ? 'var(--bg-elevated)' : (priority === 'critical' ? 'var(--status-critical)' : 'var(--status-announcement)'),
            border: 'none', borderRadius: 'var(--radius-md)', cursor: pending ? 'not-allowed' : 'pointer',
            color: pending ? 'var(--text-muted)' : '#fff', marginTop: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all var(--transition-fast)' }}
        >
          {pending && <Loader size={14} className="spin" />}
          {pending 
            ? (uploadProgress > 0 && files.length > 0
              ? `Uploading (${uploadProgress}/${files.length})…`
              : 'Posting…')
            : 'Post Announcement'}
        </button>
      </div>
    </BottomSheet>
  );
}
