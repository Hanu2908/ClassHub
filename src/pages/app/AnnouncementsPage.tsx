import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Check, CheckCircle2, AlertTriangle, Inbox, Trash2, Loader, Search, X, ArrowUpDown, Users, Award, Coffee, Calendar, Megaphone, LayoutList, CalendarDays, ChevronDown, ChevronUp, Clock, BarChart2, Filter as FilterIcon, Image } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { EmptyState, timeAgo, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement, type Attachment } from '../../store/appStore';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import Skeleton from 'react-loading-skeleton';
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, useAcknowledge } from '../../hooks/useAnnouncements';
import { useSubjects, type SubjectInfo } from '../../hooks/useSubjects';
import { useSectionMembers, useSection } from '../../hooks/useSectionMembers';
import { AnnouncementQAFooter, AnnouncementCommentsDrawer } from '../../components/AnnouncementQA';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentCard } from '../../components/AttachmentCard';
import { ImageCarousel } from '../../components/ImageCarousel';
import { AnimatePresence } from 'motion/react';
const ImageZoomModal = lazy(() => import('../../components/ImageZoomModal'));
import { supabase } from '../../lib/supabase';
import { uploadAttachments } from '../../lib/utils/uploadAttachment';
import { deleteShare, getShare, retainFailedShareFiles, updateShare } from '../../lib/shareInbox';
import RichTextBody from '../../components/RichTextBody';
import { matchSubject, getSubjectAbbreviation } from '../../lib/utils/announcements';
import { HighlightText } from '../../components/HighlightText';
import { logEvent } from '../../lib/analytics';

import { OffscreenSharePortal } from '../../components/announcement-qa/OffscreenSharePortal';
import { shareAnnouncementCard } from '../../lib/utils/shareCard';
import { isPreviewableImage, signedUrlCache } from '../../lib/utils/attachments';
import { getThumbPath } from '../../lib/utils/imageResize';

const DeleteConfirmationModal = lazy(() => import('../../components/DeleteConfirmationModal'));
const AcksTrackingSheet = lazy(() => import('../../components/AcksTrackingSheet'));

type Filter = 'all' | 'critical' | 'general';
type ChannelTab = 'active' | 'exams' | 'schedule' | 'campus';

function CreateAnnouncementSheet({ open, onClose, shareInboxId }: { open: boolean; onClose: () => void; shareInboxId?: string }) {
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

  // Smart Parsing: regex check if title/body mentions a batch number
  const detectBatch = (text: string): 'all' | '1' | '2' => {
    const lower = text.toLowerCase();
    if (lower.includes('batch 1') || lower.includes('b1') || lower.includes('batch-1')) return '1';
    if (lower.includes('batch 2') || lower.includes('b2') || lower.includes('batch-2')) return '2';
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

  useEffect(() => {
    if (!shareInboxId) return;
    getShare(shareInboxId).then((entry) => {
      if (!entry) return;
      setFiles(entry.files);
      setBody(entry.caption);
    }).catch(() => toast.error('Failed to restore shared files'));
  }, [shareInboxId]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handlePost = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    
    setIsPosting(true);
    try {
      const finalBody = selectedSubjectId
        ? `${body.trim()}\n<!-- subject_id:${selectedSubjectId} -->`
        : body.trim();

      const parentId = await createAnn.mutateAsync({
        title: title.trim(),
        message: finalBody,
        priority,
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
      });

      if (parentId && files.length > 0) {
        if (!sectionId || !userId) throw new Error('Missing section context or user context');
        
        const uploadResult = await uploadAttachments(files, {
          sectionId,
          parentType: 'announcement',
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
                destination: 'announcement',
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

      toast.success('Announcement posted');
      setTitle('');
      setBody('');
      setTargetBatch('all');
      setSelectedSubjectId('');
      setHasDeadline(false);
      setDeadlineDate('');
      setFiles([]);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setIsPosting(false);
      setUploadProgress(0);
    }
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
                            fontSize: '9px',
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
                            fontSize: '8px',
                            fontWeight: 700,
                          }}>
                            CR
                          </span>
                        )}

                      </div>
                      {member.classRoll && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
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
            <label htmlFor="composer-target-batch" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Target Batch</label>
            <select
              id="composer-target-batch"
              style={inputStyle}
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={targetBatch}
              onChange={e => setTargetBatch(e.target.value as any)}
            >
              <option value="all">Full Section (All)</option>
              <option value="1">Batch 1 Only</option>
              <option value="2">Batch 2 Only</option>
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



interface CategoryInfo {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

function getAnnouncementCategory(title: string, priority: 'critical' | 'general'): CategoryInfo {
  const t = (title || '').toLowerCase();
  
  if (priority === 'critical' || t.includes('urgent') || t.includes('attention') || t.includes('alert') || t.includes('important')) {
    return {
      name: 'Immediate Alert',
      icon: <AlertTriangle size={14} color="#f87171" />,
      color: '#f87171',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    };
  }
  
  if (t.includes('exam') || t.includes('test') || t.includes('quiz') || t.includes('midterm') || t.includes('practical') || t.includes('mst') || t.includes('assessment') || t.includes('viva')) {
    return {
      name: 'Academic Exam',
      icon: <Award size={14} color="#a78bfa" />,
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.08)',
      borderColor: 'rgba(167, 139, 250, 0.2)',
    };
  }
  
  if (t.includes('schedule') || t.includes('class') || t.includes('timing') || t.includes('timetable') || t.includes('slot') || t.includes('rescheduled') || t.includes('postponed')) {
    return {
      name: 'Schedule Change',
      icon: <Calendar size={14} color="#34d399" />,
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.08)',
      borderColor: 'rgba(52, 211, 153, 0.2)',
    };
  }
  
  if (t.includes('holiday') || t.includes('leave') || t.includes('cancel') || t.includes('closed') || t.includes('break') || t.includes('vacation')) {
    return {
      name: 'Campus Holiday',
      icon: <Coffee size={14} color="#fbbf24" />,
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: 'rgba(251, 191, 36, 0.2)',
    };
  }
  
  return {
    name: 'General Announcement',
    icon: <Megaphone size={14} color="#60a5fa" />,
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.15)',
  };
}

type AnnouncementWithAck = Announcement & { isAcknowledged: boolean };

interface GroupedAnnouncements {
  thisWeek: AnnouncementWithAck[];
  lastWeek: AnnouncementWithAck[];
  older: AnnouncementWithAck[];
}

function groupByTimeline(items: AnnouncementWithAck[], nowTimestamp: number): GroupedAnnouncements {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const FOURTEEN_DAYS = 14 * ONE_DAY;

  const thisWeek: AnnouncementWithAck[] = [];
  const lastWeek: AnnouncementWithAck[] = [];
  const older: AnnouncementWithAck[] = [];

  items.forEach(item => {
    const itemTime = new Date(item.postedAt).getTime();
    const diff = nowTimestamp - itemTime;

    if (diff < SEVEN_DAYS) {
      thisWeek.push(item);
    } else if (diff < FOURTEEN_DAYS) {
      lastWeek.push(item);
    } else {
      older.push(item);
    }
  });

  return { thisWeek, lastWeek, older };
}

function TimelineSection({ title, count }: { title: string; count: number }) {
  return (
    <div style={{
      position: 'sticky',
      top: '150px',
      zIndex: 10,
      background: 'rgba(13, 15, 20, 0.95)',
      backdropFilter: 'blur(12px)',
      padding: '10px 16px',
      margin: '0 -16px 8px -16px',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span className="t-label" style={{ 
        color: 'var(--text-primary)', 
        fontWeight: 600, 
        letterSpacing: '0.05em',
        fontSize: '11px',
        textTransform: 'uppercase'
      }}>
        {title}
      </span>
      <span className="t-mono-sm" style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: 500,
      }}>
        {count} {count === 1 ? 'announcement' : 'announcements'}
      </span>
    </div>
  );
}

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        onExpire();
        return;
      }
      const h = Math.floor(diff / (3600 * 1000));
      const m = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const s = Math.floor((diff % (60 * 1000)) / 1000);

      if (h > 0) {
        setTimeLeft(`${h}h ${m}m ${s}s left`);
      } else if (m > 0) {
        setTimeLeft(`${m}m ${s}s left`);
      } else {
        setTimeLeft(`${s}s left`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 'var(--radius-pill)',
      background: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#ef4444',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '10px',
      fontWeight: 600,
    }}>
      <Clock size={11} className="animate-pulse" style={{ animation: 'pulse 1.5s infinite' }} />
      <span>{timeLeft}</span>
    </div>
  );
}

interface AnnouncementCardComponentProps {
  ann: Announcement & { isAcknowledged: boolean; matchedSubject?: SubjectInfo | null };
  isHighlighted: boolean;
  highlightRef: React.RefObject<HTMLDivElement | null> | null;
  role: string;
  totalStudentsCount: number;
  ackCountsMap: Record<string, number>;
  handleAcknowledge: (id: string) => void;
  setPendingDeleteId: (id: string | null) => void;
  setTrackingAnnouncement: (ann: Announcement | null) => void;
  setOpenCommentsAnnId: (id: string | null) => void;
  onShare: (ann: Announcement) => void;
  searchQuery: string;
}

export function AnnouncementCardComponent({
  ann,
  isHighlighted,
  highlightRef,
  role,
  totalStudentsCount,
  ackCountsMap,
  handleAcknowledge,
  setPendingDeleteId,
  setTrackingAnnouncement,
  setOpenCommentsAnnId,
  onShare,
  searchQuery
}: AnnouncementCardComponentProps) {
  const authUser = useAppStore(s => s.authUser);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [zoomModalData, setZoomModalData] = useState<{
    images: Array<{ thumbUrl: string; fullUrl: string }>;
    initialIndex: number;
  } | null>(null);

  const images = ann.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];
  const otherFiles = ann.attachments?.filter(att => !isPreviewableImage(att.fileType, att.filename)) || [];

  const handleImageClick = (index: number) => {
    const modalImages = images.map(img => {
      const cached = signedUrlCache.get(img.storagePath);
      return {
        thumbUrl: cached?.thumbUrl || '',
        fullUrl: cached?.fullUrl || ''
      };
    });
    setZoomModalData({
      images: modalImages,
      initialIndex: index
    });
  };

  const isCritical = ann.priority === 'critical';
  const isAcked = ann.isAcknowledged;
  const isExpiredAlert = ann.expiresAt && new Date(ann.expiresAt) < new Date();
  const bdg = deadlineBadgeClass(ann.deadline);
  const lbl = deadlineLabel(ann.deadline);
  const category = getAnnouncementCategory(ann.title, ann.priority);

  const isLongText = ann.body ? (ann.body.length > 200 || ann.body.split('\n').length > 3) : false;

  const glowingOutlineStyle: React.CSSProperties = {
    position: 'relative',
    border: hovered ? `1px solid ${category.color}` : `1px solid ${category.borderColor}`,
    boxShadow: hovered 
      ? `0 12px 30px rgba(0, 0, 0, 0.25), 0 0 15px ${category.bgColor}`
      : '0 4px 20px rgba(0, 0, 0, 0.15)',
    transform: hovered ? 'scale(1.012)' : 'scale(1)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'fadeSlideUp 0.35s ease both',
    padding: '18px',
    borderRadius: 'var(--radius-lg)',
    background: isCritical ? 'var(--status-critical-bg)' : 'linear-gradient(145deg, #121522 0%, #0A0C14 100%)',
    outline: isHighlighted ? '2px solid var(--accent-primary)' : undefined,
    outlineOffset: isHighlighted ? '2px' : undefined,
    opacity: isExpiredAlert ? 0.65 : 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  return (
    <article
      ref={isHighlighted ? (highlightRef as any) : null}
      className="card announcement-feed-card"
      style={glowingOutlineStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 1. Header Metadata Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 5,
            padding: '2px 8px',
            borderRadius: '12px',
            background: category.bgColor,
            border: `1px solid ${category.borderColor}`,
          }}>
            {category.icon}
            <span className="t-mono-sm" style={{ color: category.color, fontWeight: 600, fontSize: '10px' }}>
              {category.name}
            </span>
          </div>
          {ann.deadline && <span className={`badge ${bdg}`}>{lbl}</span>}
          {ann.expiresAt && (
            <span className="badge" style={{
              background: isExpiredAlert ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.15)',
              color: isExpiredAlert ? 'var(--text-muted)' : '#ef4444',
              border: isExpiredAlert ? '1px solid var(--border-default)' : '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
            }}>
              {isExpiredAlert ? 'Expired' : 'Flash Post'}
            </span>
          )}
        </div>

        {/* CR and Teacher (if author) Tools (Delete, Receipt Tracking) */}
        {(role === 'cr' || (role === 'teacher' && ann.authorId === authUser?.id)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="tracker-pill"
              onClick={() => setTrackingAnnouncement(ann)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 500,
                outline: 'none',
              }}
              aria-label={`View read receipts: ${ackCountsMap[ann.id] || 0} of ${totalStudentsCount} acknowledged`}
              title="View read receipts"
            >
              <Users size={11} />
              <span>{ackCountsMap[ann.id] || 0}/{totalStudentsCount} ✓</span>
            </button>

            <button
              id={`del-ann-${ann.id}`}
              onClick={() => setPendingDeleteId(ann.id)}
              className="btn-del-ann"
              style={{
                background: 'rgba(255,68,68,0.08)', 
                border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: 8, 
                padding: '6px', 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                outline: 'none',
              }}
              aria-label="Delete announcement"
              title="Delete announcement"
            >
              <Trash2 size={13} color="var(--status-critical)" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Full-Width Typography Title */}
      <h2 className="t-card-title" style={{ 
        color: 'var(--text-primary)', 
        lineHeight: 1.3,
        fontSize: '16px',
        fontWeight: 700,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        {ann.matchedSubject && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: `${ann.matchedSubject.accent}15`,
            color: ann.matchedSubject.accent,
            border: `1px solid ${ann.matchedSubject.accent}30`,
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {getSubjectAbbreviation(ann.matchedSubject)}
          </span>
        )}
        <span>
          <HighlightText text={ann.title} search={searchQuery} />
        </span>
      </h2>

      {/* 3. In-Place Option A Expand with Soft Glass Fade */}
      {ann.body && ann.body.trim() && (
        <div style={{ position: 'relative', width: '100%' }}>
          <div className="t-body" style={{ 
            color: 'var(--text-primary)', 
            lineHeight: 1.625, 
            fontSize: '14.5px',
            margin: 0,
            display: isExpanded ? 'block' : '-webkit-box',
            WebkitLineClamp: isExpanded ? undefined : 3,
            WebkitBoxOrient: isExpanded ? undefined : 'vertical',
            overflow: isExpanded ? 'visible' : 'hidden',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <RichTextBody text={ann.body} search={searchQuery} />
          </div>
          {!isExpanded && isLongText && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '24px',
              background: 'linear-gradient(to bottom, transparent, var(--bg-elevated, #0a0b12))',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      {/* Caret Toggle Button */}
      {isLongText && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(prev => !prev);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-accent)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            transition: 'all var(--transition-fast)',
            outline: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'var(--accent-primary-muted)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <span>{isExpanded ? 'Show Less' : 'Read More'}</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {/* 4. Attachments Block */}
      {ann.attachments && ann.attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {images.length > 0 && (
            <ImageCarousel images={images} onImageClick={handleImageClick} />
          )}
          {otherFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherFiles.map((att: Attachment) => (
                <AttachmentCard key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Time Ago Indicator */}
      <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>
        {timeAgo(ann.postedAt)}
      </span>

      {/* 6. Footer Block: Reactions (left), Comments (middle), Acknowledge (right) */}
      <div style={{
        marginTop: '8px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        width: '100%',
      }} onClick={e => e.stopPropagation()}>
        <AnnouncementQAFooter 
          announcementId={ann.id} 
          onOpenComments={() => setOpenCommentsAnnId(ann.id)} 
          onShare={() => onShare(ann)}
        />

        <div>
          {isExpiredAlert ? (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 6, 
              height: '38px',
              padding: '0 16px', 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border-default)', 
              borderRadius: '8px', 
              boxSizing: 'border-box'
            }}>
              <Clock size={16} color="var(--text-muted)" />
              <span className="t-label" style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Expired</span>
            </div>
          ) : !isAcked ? (
            <button
              id={`ack-btn-${ann.id}`}
              onClick={() => handleAcknowledge(ann.id)}
              className="btn-ack-btn"
              aria-label="Acknowledge announcement"
              style={{
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 6, 
                height: '38px',
                padding: '0 16px',
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-default)',
                borderRadius: '8px', 
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                outline: 'none',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'var(--accent-primary-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border-default)';
              }}
            >
              <CheckCircle2 size={16} /> Acknowledge
            </button>
          ) : (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 6, 
              height: '38px',
              padding: '0 16px', 
              background: 'var(--status-safe-bg)', 
              border: '1px solid rgba(52,201,123,0.25)', 
              borderRadius: '8px', 
              boxSizing: 'border-box'
            }}>
              <CheckCircle2 size={16} color="var(--status-safe)" />
              <span className="t-label" style={{ color: 'var(--status-safe)', fontSize: '11px', fontWeight: 600 }}>Acked</span>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {zoomModalData && (
          <Suspense fallback={
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
              <Loader className="animate-spin" color="#fff" size={32} />
            </div>
          }>
            <ImageZoomModal
              images={zoomModalData.images}
              initialIndex={zoomModalData.initialIndex}
              onClose={() => setZoomModalData(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </article>
  );
}

function AnnouncementsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={90} height={16} borderRadius="var(--radius-pill)" />
            <Skeleton width={60} height={12} />
          </div>
          <Skeleton width="75%" height={18} style={{ margin: '4px 0 6px' }} />
          <Skeleton width="95%" height={13} style={{ marginBottom: 4 }} />
          <Skeleton width="80%" height={13} />
        </div>
      ))}
    </div>
  );
}

interface ShareOptionsContentProps {
  ann: Announcement;
  onShareNotice: () => void;
  onSharePhotos: () => void;
  isSharingPhotos: boolean;
  selectedPhotos: string[];
  setSelectedPhotos: React.Dispatch<React.SetStateAction<string[]>>;
}

function ShareOptionsContent({
  ann,
  onShareNotice,
  onSharePhotos,
  isSharingPhotos,
  selectedPhotos,
  setSelectedPhotos,
}: ShareOptionsContentProps) {
  const shareImages = ann.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button 
        onClick={onShareNotice}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          color: '#fff',
          outline: 'none'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary)',
          flexShrink: 0
        }}>
          <Image size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ font: '600 14px var(--font-display)', margin: '0 0 2px', color: 'var(--text-primary)' }}>Share Notice Card</p>
          <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>Generates a premium image combining notice text and images.</p>
        </div>
      </button>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderTop: '1px solid var(--border-default)',
        paddingTop: '20px',
        textAlign: 'left'
      }}>
        <p style={{ font: '600 14px var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>Share Photos Directly</p>
        <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Select which attachment photos to share directly to WhatsApp.</p>
        
        {/* Grid of thumbnails */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '8px'
        }}>
          {shareImages.map(img => {
            const isSelected = selectedPhotos.includes(img.id);
            const cached = signedUrlCache.get(img.storagePath);
            const url = cached?.thumbUrl || cached?.fullUrl || '';
            
            return (
              <div 
                key={img.id}
                onClick={() => {
                  setSelectedPhotos(prev => 
                    prev.includes(img.id) 
                      ? prev.filter(id => id !== img.id) 
                      : [...prev, img.id]
                  );
                }}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: 'rgba(255,255,255,0.03)',
                  boxSizing: 'border-box'
                }}
              >
                {url ? (
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222' }}>
                    <Image size={16} color="var(--text-muted)" />
                  </div>
                )}
                
                {/* Checkbox overlay */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: '1.5px solid #fff',
                  background: isSelected ? 'var(--accent-primary)' : 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {isSelected && '✓'}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onSharePhotos}
          disabled={isSharingPhotos || selectedPhotos.length === 0}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: selectedPhotos.length === 0 ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none',
            color: selectedPhotos.length === 0 ? 'var(--text-muted)' : '#fff',
            cursor: selectedPhotos.length === 0 ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: selectedPhotos.length === 0 ? 'none' : '0 4px 14px rgba(74, 158, 255, 0.3)',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          {isSharingPhotos ? 'Preparing Photos...' : `Share Selected Photos (${selectedPhotos.length})`}
        </button>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const globalSelectedSectionId = useAppStore(s => s.selectedSectionId);
  const globalSelectedSubjectId = useAppStore(s => s.selectedSubjectId);

  const [filter, setFilter] = useState<Filter>('all');
  const [activeTab, setActiveTab] = useState<ChannelTab>('active');
  const [layoutMode, setLayoutMode] = useState<'timeline' | 'feed'>(() => {
    try {
      return (localStorage.getItem('classhub_announcements_layout_mode') as 'timeline' | 'feed') || 'timeline';
    } catch {
      return 'timeline';
    }
  });

  const [justAckedIds, setJustAckedIds] = useState<Set<string>>(() => new Set());

  // Clear justAckedIds when the tab changes to let the feed refresh
  useEffect(() => {
    setJustAckedIds(new Set());
  }, [activeTab]);

  const toggleLayoutMode = () => {
    const next = layoutMode === 'timeline' ? 'feed' : 'timeline';
    setLayoutMode(next);
    try {
      localStorage.setItem('classhub_announcements_layout_mode', next);
    } catch (e) {
      console.error(e);
    }
  };

  const [showCreate, setShowCreate] = useState(location.state?.openCreate || false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: subjects = [] } = useSubjects({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState(() => {
    return role === 'teacher' ? (globalSelectedSubjectId || 'all') : 'all';
  });

  useEffect(() => {
    if (role === 'teacher' && globalSelectedSubjectId) {
      setSelectedSubjectFilter(globalSelectedSubjectId);
    }
  }, [role, globalSelectedSubjectId]);
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);
  const [filterUnacknowledgedOnly, setFilterUnacknowledgedOnly] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('classhub_announcements_recent_searches') || '[]');
    } catch {
      return [];
    }
  });

  const saveSearchQuery = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecentSearches(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 5);
      localStorage.setItem('classhub_announcements_recent_searches', JSON.stringify(next));
      return next;
    });
  };

  const [sortBy, setSortBy] = useState<'newest' | 'priority' | 'deadline'>('newest');
  const [trackingAnnouncement, setTrackingAnnouncement] = useState<Announcement | null>(null);
  const [prevTrackingAnnouncement, setPrevTrackingAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (trackingAnnouncement) {
      setPrevTrackingAnnouncement(trackingAnnouncement);
    }
  }, [trackingAnnouncement]);
  // Pending delete target state for confirmation dialog
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [highlightId] = useState<string | null>(() => new URLSearchParams(location.search).get('highlight'));
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Q&A Comments Drawer States
  const [openCommentsAnnId, setOpenCommentsAnnId] = useState<string | null>(null);
  const [prevOpenCommentsAnnId, setPrevOpenCommentsAnnId] = useState<string | null>(null);
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (openCommentsAnnId) {
      setPrevOpenCommentsAnnId(openCommentsAnnId);
    }
  }, [openCommentsAnnId]);

  // Announcement Card Share states
  const sharePortalRef = useRef<HTMLDivElement>(null);
  const [activeShareAnn, setActiveShareAnn] = useState<Announcement | null>(null);

  useSection();
  const [shareOptionsAnn, setShareOptionsAnn] = useState<Announcement | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isSharingPhotos, setIsSharingPhotos] = useState(false);

  useEffect(() => {
    if (shareOptionsAnn) {
      const imgs = shareOptionsAnn.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];
      setSelectedPhotos(imgs.map(img => img.id));
    } else {
      setSelectedPhotos([]);
    }
  }, [shareOptionsAnn]);

  const handleShareClick = (announcement: Announcement) => {
    const imgs = announcement.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];
    if (imgs.length === 0) {
      handleShareAnnouncement(announcement);
    } else {
      setShareOptionsAnn(announcement);
    }
  };

  const handleSharePhotos = async () => {
    if (!shareOptionsAnn) return;
    setIsSharingPhotos(true);
    try {
      const selectedAtts = (shareOptionsAnn.attachments || []).filter(att => 
        selectedPhotos.includes(att.id)
      );
      
      const enrichedAtts = await Promise.all(
        selectedAtts.map(async (att) => {
          try {
            const { data } = await supabase.storage
              .from('attachments')
              .createSignedUrl(att.storagePath, 60);
            return { ...att, signedUrl: data?.signedUrl || null };
          } catch (e) {
            console.error('[Share] Failed to get signed URL for original:', att.filename, e);
            return att;
          }
        })
      );

      const validUrls = enrichedAtts.filter(att => att.signedUrl);
      if (validUrls.length === 0) {
        toast.error('Failed to retrieve photo URLs');
        setIsSharingPhotos(false);
        return;
      }

      const files: File[] = [];
      await Promise.all(
        validUrls.map(async (att) => {
          try {
            const response = await fetch(att.signedUrl!);
            const blob = await response.blob();
            const file = new File([blob], att.filename, { type: blob.type || 'image/png' });
            files.push(file);
          } catch (e) {
            console.error('[Share] Blob fetch failed:', att.filename, e);
          }
        })
      );

      if (files.length === 0) {
        toast.error('Failed to prepare photo files');
        setIsSharingPhotos(false);
        return;
      }

      if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
        try {
          await navigator.share({
            files,
            title: shareOptionsAnn.title,
          });
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            triggerBatchDownload(files);
          }
        }
      } else {
        triggerBatchDownload(files);
      }
      setShareOptionsAnn(null);
    } catch (err) {
      console.error('[Share] Failed to share photos:', err);
      toast.error('Failed to share photos');
    } finally {
      setIsSharingPhotos(false);
    }
  };

  const triggerBatchDownload = (files: File[]) => {
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
    toast.success('Photos downloaded successfully ✓');
  };

  // Parse deep-linking Q&A parameters on mount/location change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const expandQA = params.get('expand_qa') === 'true';
    const commentId = params.get('focus_comment');

    if (id && expandQA) {
      setOpenCommentsAnnId(id);
      if (commentId) {
        setFocusCommentId(commentId);
      }
    }
  }, [location.search]);

  // Clear highlight param from URL without navigation, then scroll to card
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Clear the param from URL bar without re-render
      window.history.replaceState({}, '', location.pathname);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const handleShareAnnouncement = async (announcement: Announcement) => {
    try {
      // 1. Fetch signed URLs for all image attachments
      const attachmentsWithUrls = announcement.attachments
        ? await Promise.all(
            announcement.attachments.map(async (att) => {
              const isImage = isPreviewableImage(att.fileType, att.filename);
              if (!isImage) return att;
              try {
                const thumbPath = getThumbPath(att.storagePath);
                // Try thumbnail first
                const { data: thumbData } = await supabase.storage
                  .from('attachments')
                  .createSignedUrl(thumbPath, 60);

                if (thumbData?.signedUrl) {
                  return { ...att, signedUrl: thumbData.signedUrl };
                }

                // Fallback to original
                const { data: origData } = await supabase.storage
                  .from('attachments')
                  .createSignedUrl(att.storagePath, 60);

                return { ...att, signedUrl: origData?.signedUrl || null };
              } catch (e) {
                console.error('[Share] Failed to get signed URL for attachment:', att.filename, e);
                return att;
              }
            })
          )
        : [];

      const enrichedAnnouncement = {
        ...announcement,
        attachments: attachmentsWithUrls,
      };

      setActiveShareAnn(enrichedAnnouncement);

      // 2. Wait a tick for render and wait for all images to fully load
      setTimeout(async () => {
        if (sharePortalRef.current) {
          const imgs = sharePortalRef.current.querySelectorAll('img');
          if (imgs.length > 0) {
            await Promise.all(
              Array.from(imgs).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                });
              })
            );
          }
        }

        await shareAnnouncementCard(
          enrichedAnnouncement,
          sharePortalRef,
          () => {},
          () => {
            setActiveShareAnn(null);
          }
        );
      }, 100);
    } catch (err) {
      console.error('[Share] Failed to share announcement:', err);
      toast.error('Failed to share announcement notice');
    }
  };

  const sectionId = role === 'teacher' ? (globalSelectedSectionId || authUser?.sectionId) : authUser?.sectionId;

  const { data: teacherMappings = [] } = useQuery({
    queryKey: ['teacher-mappings-announcements', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from('section_teachers')
        .select('subject_id')
        .eq('teacher_id', authUser.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id && role === 'teacher',
  });

  const { data: rawAnnouncements = [], isLoading } = useAnnouncements({
    sectionId: role === 'teacher' ? (globalSelectedSectionId || undefined) : undefined
  });

  // Filter rawAnnouncements if the user is a teacher
  const announcements = useMemo(() => {
    if (role !== 'teacher') return rawAnnouncements;
    const teacherSubjectIds = new Set(teacherMappings.map(m => m.subject_id).filter(Boolean));
    const cleanTeacherName = authUser?.name ? authUser.name.replace(/\s+/g, '').toLowerCase() : '';

    return rawAnnouncements.filter(a => {
      const isAuthor = a.authorId === authUser?.id;
      const matched = matchSubject(a.title, a.body, subjects);
      const teachesSubject = matched && teacherSubjectIds.has(matched.id);
      
      const isTagged = cleanTeacherName && (
        (a.title || '').toLowerCase().includes('@' + cleanTeacherName) ||
        (a.body || '').toLowerCase().includes('@' + cleanTeacherName)
      );
      return isAuthor || teachesSubject || isTagged;
    });
  }, [role, rawAnnouncements, teacherMappings, authUser?.id, authUser?.name, subjects]);

  const deleteAnn = useDeleteAnnouncement();
  const ackMutation = useAcknowledge();
  const queryClient = useQueryClient();



  // Fetch section members to compute stats & nudge lists
  const { data: members = [] } = useSectionMembers();

  // Fetch section-wide acknowledgments for counts and tracking list
  const { data: sectionAcks = [] } = useQuery({
    queryKey: ['section_acknowledgments', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acknowledgments')
        .select('announcement_id, user_id, acknowledged_at');
      if (error) throw error;
      return data ?? [];
    }
  });



  // Filter out CRs to count students
  const totalStudents = members.filter(m => m.role === 'student');
  const totalStudentsCount = totalStudents.length;

  // Acknowledgment counts map
  const ackCountsMap = sectionAcks.reduce((acc, curr) => {
    acc[curr.announcement_id] = (acc[curr.announcement_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Auto-expiry: hide items past deadline + 2 days and include Flash Posts (which always stay in timeline history)
  const visible = useMemo(() => {
    return announcements.filter(a => {
      if (!a.expiresAt) {
        return !isExpired(a.deadline);
      }
      return true; // Expired or active Flash Posts always stay in history
    });
  }, [announcements]);

  const activeFlashPosts = useMemo(() => {
    return announcements.filter(
      (a) => a.priority === 'critical' && 
             a.expiresAt && 
             new Date(a.expiresAt) > new Date() &&
             !a.isAcknowledged
    );
  }, [announcements]);

  const criticalCounts = useMemo(() => {
    const counts = { active: 0, exams: 0, schedule: 0, campus: 0 };
    visible.forEach(a => {
      const isExpiredAlert = a.expiresAt && new Date(a.expiresAt) < new Date();
      if (a.priority === 'critical' && !a.isAcknowledged && !isExpiredAlert) {
        counts.active++;
        
        const categoryInfo = getAnnouncementCategory(a.title, a.priority);
        const categoryName = categoryInfo.name;
        const lowerTitle = (a.title || '').toLowerCase();
        
        // Check exams
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        if (categoryName === 'Academic Exam' || (categoryName === 'Immediate Alert' && hasExamKeywords)) {
          counts.exams++;
        }
        
        // Check schedule
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        if (categoryName === 'Schedule Change' || (categoryName === 'Immediate Alert' && hasScheduleKeywords)) {
          counts.schedule++;
        }
        
        // Check campus
        const isGeneralOrHoliday = categoryName === 'Campus Holiday' || categoryName === 'General Announcement';
        const isCriticalGeneral = categoryName === 'Immediate Alert' && !hasExamKeywords && !hasScheduleKeywords;
        if (isGeneralOrHoliday || isCriticalGeneral) {
          counts.campus++;
        }
      }
    });
    return counts;
  }, [visible]);

  // Pure rendering date timestamp initialized once on mount to keep rendering pure
  const [now] = useState(() => Date.now());

  const visibleWithSubjects = useMemo(() => {
    return visible.map(a => ({
      ...a,
      matchedSubject: matchSubject(a.title, a.body, subjects)
    }));
  }, [visible, subjects]);

  const filtered = useMemo(() => {
    return visibleWithSubjects.filter(a => {
      // 1. Tab-based channel filter:
      const categoryInfo = getAnnouncementCategory(a.title, a.priority);
      const categoryName = categoryInfo.name;
      const lowerTitle = (a.title || '').toLowerCase();
      
      let matchesTab = false;
      if (activeTab === 'active') {
        matchesTab = !a.isAcknowledged || justAckedIds.has(a.id);
      } else if (activeTab === 'exams') {
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        matchesTab = categoryName === 'Academic Exam' || (categoryName === 'Immediate Alert' && hasExamKeywords);
      } else if (activeTab === 'schedule') {
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        matchesTab = categoryName === 'Schedule Change' || (categoryName === 'Immediate Alert' && hasScheduleKeywords);
      } else if (activeTab === 'campus') {
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        const isGeneralOrHoliday = categoryName === 'Campus Holiday' || categoryName === 'General Announcement';
        const isCriticalGeneral = categoryName === 'Immediate Alert' && !hasExamKeywords && !hasScheduleKeywords;
        matchesTab = isGeneralOrHoliday || isCriticalGeneral;
      }

      // 2. Urgency nested sub-filter:
      const matchesFilter = filter === 'all' ? true : a.priority === filter;

      // 3. Search query:
      const matchesSearch = searchQuery.trim() === '' || 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.body.toLowerCase().includes(searchQuery.toLowerCase());

      // 4. Subject filter:
      const matchesSubject = selectedSubjectFilter === 'all' || 
        (a.matchedSubject && a.matchedSubject.id === selectedSubjectFilter);

      // 5. Has Attachment filter:
      const matchesAttachment = !filterHasAttachment || 
        (a.attachments && a.attachments.length > 0);

      // 6. Unacknowledged filter:
      const matchesUnacknowledged = !filterUnacknowledgedOnly || 
        (!a.isAcknowledged);

      return matchesTab && matchesFilter && matchesSearch && matchesSubject && matchesAttachment && matchesUnacknowledged;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (b.priority === 'critical' && a.priority !== 'critical') return 1;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      } else if (sortBy === 'deadline') {
        const getDeadlineScore = (deadline: string | null) => {
          if (!deadline) return Infinity;
          const time = new Date(deadline).getTime();
          if (time < now) return Infinity - 1; // Expired close to last
          return time; // Future closest deadline first
        };
        const scoreA = getDeadlineScore(a.deadline);
        const scoreB = getDeadlineScore(b.deadline);
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      } else {
        // Default: 'newest'
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      }
    });
  }, [visibleWithSubjects, activeTab, filter, searchQuery, selectedSubjectFilter, filterHasAttachment, filterUnacknowledgedOnly, sortBy, now, justAckedIds]);

  const groupedAnnouncements = useMemo(() => {
    return groupByTimeline(filtered, now);
  }, [filtered, now]);

  // Virtualization setup
  const flatItems = useMemo(() => {
    if (layoutMode === 'feed') {
      return filtered.map(ann => ({ type: 'card' as const, key: ann.id, data: ann }));
    }

    const { thisWeek, lastWeek, older } = groupedAnnouncements;
    const items: Array<
      | { type: 'header'; key: string; title: string; count: number }
      | { type: 'card'; key: string; data: AnnouncementWithAck }
    > = [];

    if (thisWeek.length > 0) {
      items.push({ type: 'header', key: 'header-thisWeek', title: 'This Week', count: thisWeek.length });
      thisWeek.forEach(ann => {
        items.push({ type: 'card', key: ann.id, data: ann });
      });
    }
    if (lastWeek.length > 0) {
      items.push({ type: 'header', key: 'header-lastWeek', title: 'Last Week', count: lastWeek.length });
      lastWeek.forEach(ann => {
        items.push({ type: 'card', key: ann.id, data: ann });
      });
    }
    if (older.length > 0) {
      items.push({ type: 'header', key: 'header-older', title: 'Older', count: older.length });
      older.forEach(ann => {
        items.push({ type: 'card', key: ann.id, data: ann });
      });
    }
    return items;
  }, [layoutMode, filtered, groupedAnnouncements]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 350,
    getItemKey: (index) => flatItems[index]?.key || index,
    overscan: 5,
  });

  // Force re-measure when layout mode changes or announcements load to avoid stale height cache
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, announcements.length]);



  const handleDelete = async (id: string) => {
    try {
      await deleteAnn.mutateAsync(id);
      toast.info('Announcement deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await ackMutation.mutateAsync(id);
      if (authUser?.id && sectionId) {
        logEvent('announcement_acknowledged', authUser.id, sectionId, { announcementId: id });
      }
      toast.success('Acknowledged ✓');
      setJustAckedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch { toast.error('Failed to acknowledge'); }
  };

  return (
    <div className="page-shell" style={{ height: '100dvh', overflow: 'hidden' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px',
      }}>
        {/* Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="ann-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <Megaphone size={18} color="var(--accent-primary)" />
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Announcements</h1>
          </div>
          <button
            onClick={() => navigate('/app/polls')}
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              color: 'var(--accent-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BarChart2 size={13} />
            <span>Polls</span>
          </button>
        </div>

        {/* Consolidated Header Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          {/* Category Dropdown Selector (Left side) */}
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
                }}
              >
                {activeTab === 'exams' && <Award size={14} />}
                {activeTab === 'schedule' && <Calendar size={14} />}
                {activeTab === 'campus' && <Coffee size={14} />}
                {activeTab === 'active' && <Megaphone size={14} />}
                <span style={{ textTransform: 'capitalize' }}>
                  {activeTab === 'active' ? 'Active Feed' : activeTab}
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
                {(['active', 'exams', 'schedule', 'campus'] as ChannelTab[]).map(t => {
                  let label: string;
                  let icon: React.ReactNode;
                  if (t === 'exams') { label = 'Exams'; icon = <Award size={14} />; }
                  else if (t === 'schedule') { label = 'Schedule'; icon = <Calendar size={14} />; }
                  else if (t === 'campus') { label = 'Campus'; icon = <Coffee size={14} />; }
                  else { label = 'Active Feed'; icon = <Megaphone size={14} />; }

                  const criticalCount = criticalCounts[t];
                  const isSelected = activeTab === t;

                  return (
                    <DropdownMenu.Item
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="dropdown-item"
                      style={{
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                        fontWeight: isSelected ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {icon}
                        <span>{label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {criticalCount > 0 && (
                          <span style={{ 
                            background: 'var(--status-critical)', 
                            color: '#fff', 
                            fontSize: '9px', 
                            fontWeight: 700, 
                            padding: '1px 5px', 
                            borderRadius: '8px',
                            boxShadow: '0 0 6px var(--status-critical)',
                          }}>
                            {criticalCount}
                          </span>
                        )}
                        {isSelected && <Check size={14} />}
                      </div>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Action Icons (Right side - Spacious gaps) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* Search Toggle Button */}
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery('');
                  setSelectedSubjectFilter('all');
                  setFilterHasAttachment(false);
                  setFilterUnacknowledgedOnly(false);
                }
              }}
              className={`header-action-btn${(showSearch || searchQuery) ? ' active' : ''}`}
              style={{
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Toggle Search"
              title="Search Announcements"
            >
              <Search size={18} />
            </button>

            {/* Sorting Dropdown Trigger */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={`header-action-btn${sortBy !== 'newest' ? ' active' : ''}`}
                  style={{
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Sort Options"
                  title="Sort Announcements"
                >
                  <ArrowUpDown size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="dropdown-content animate-slide-up"
                  style={{ zIndex: 10000 }}
                >
                  {(['newest', 'priority', 'deadline'] as const).map(option => {
                    let label = '';
                    if (option === 'newest') label = 'Newest First';
                    else if (option === 'priority') label = 'Priority First';
                    else if (option === 'deadline') label = 'Closest Deadline';

                    const isSelected = sortBy === option;

                    return (
                      <DropdownMenu.Item
                        key={option}
                        onClick={() => setSortBy(option)}
                        className="dropdown-item"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          fontWeight: isSelected ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <span>{label}</span>
                        {isSelected && <Check size={14} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Priority Filtering Dropdown Trigger */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={`header-action-btn${filter !== 'all' ? ' active' : ''}`}
                  style={{
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Filter Priority"
                  title="Filter Priority"
                >
                  <FilterIcon size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="dropdown-content animate-slide-up"
                  style={{ zIndex: 10000 }}
                >
                  {(['all', 'critical', 'general'] as Filter[]).map(f => {
                    const isSelected = filter === f;
                    let label = '';
                    if (f === 'all') label = 'All Priorities';
                    else if (f === 'critical') label = 'Immediate Alerts';
                    else if (f === 'general') label = 'General Notices';

                    return (
                      <DropdownMenu.Item
                        key={f}
                        onClick={() => setFilter(f)}
                        className="dropdown-item"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          fontWeight: isSelected ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {f === 'critical' && (
                            <span style={{ 
                              width: 6, height: 6, borderRadius: '50%', 
                              background: 'var(--status-critical)',
                              boxShadow: '0 0 6px var(--status-critical)'
                            }} />
                          )}
                          <span>{label}</span>
                        </div>
                        {isSelected && <Check size={14} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Layout Mode Toggle */}
            <button
              onClick={toggleLayoutMode}
              className={`header-action-btn${layoutMode === 'feed' ? ' active' : ''}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
                width: '38px', height: '38px',
              }}
              aria-label={`Switch to ${layoutMode === 'timeline' ? 'Feed' : 'Timeline'} Mode`}
              title={`Switch to ${layoutMode === 'timeline' ? 'Feed' : 'Timeline'} Mode`}
            >
              {layoutMode === 'timeline' ? <LayoutList size={18} /> : <CalendarDays size={18} />}
            </button>
          </div>
        </div>

        {/* Collapsible Search Bar Container */}
        <div className={`search-bar-container${showSearch || searchQuery ? ' open' : ''}`} style={{ marginTop: 8 }}>
          <div className="search-input-wrapper">
            <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              id="announcements-search"
              name="announcements-search"
              type="text"
              className="search-input-field"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  saveSearchQuery(searchQuery);
                }
              }}
              onBlur={() => {
                saveSearchQuery(searchQuery);
              }}
              aria-label="Search announcements"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSubjectFilter('all');
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', padding: 4,
                  alignItems: 'center', justifyContent: 'center'
                }}
                aria-label="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Expanded Search Filters Sub-panel */}
          {(showSearch || searchQuery) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '12px 4px 4px',
              borderTop: '1px solid var(--border-default)',
              marginTop: 10,
            }}>
              {/* 1. Recent Searches Row */}
              {recentSearches.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Recent:
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSearchQuery(term)}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {term}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem('classhub_announcements_recent_searches');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--status-critical)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: '2px 4px',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Filters Row — Subject dropdown + toggle chips in one line */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Subject Filter Dropdown */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      id="subject-filter-trigger"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: selectedSubjectFilter === 'all' ? 'rgba(255, 255, 255, 0.03)' : `${subjects.find(s => s.id === selectedSubjectFilter)?.accent ?? 'var(--accent-primary)'}15`,
                        border: selectedSubjectFilter === 'all' ? '1px solid var(--border-default)' : `1px solid ${subjects.find(s => s.id === selectedSubjectFilter)?.accent ?? 'var(--accent-primary)'}50`,
                        borderRadius: 'var(--radius-pill)',
                        padding: '0 12px',
                        color: selectedSubjectFilter === 'all' ? 'var(--text-secondary)' : subjects.find(s => s.id === selectedSubjectFilter)?.accent ?? 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        height: '30px',
                        maxWidth: '180px',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {selectedSubjectFilter !== 'all' && (() => {
                        const sel = subjects.find(s => s.id === selectedSubjectFilter);
                        return sel ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: sel.accent, flexShrink: 0 }} /> : null;
                      })()}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedSubjectFilter === 'all'
                          ? 'All Subjects'
                          : subjects.find(s => s.id === selectedSubjectFilter)?.name ?? 'All Subjects'}
                      </span>
                      <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="start"
                      sideOffset={6}
                      className="dropdown-content animate-slide-up"
                      style={{ zIndex: 10000, minWidth: '200px', maxHeight: '240px', overflowY: 'auto' }}
                    >
                      <DropdownMenu.Item
                        onClick={() => setSelectedSubjectFilter('all')}
                        className="dropdown-item"
                        style={{
                          color: selectedSubjectFilter === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: selectedSubjectFilter === 'all' ? 'rgba(99, 102, 241, 0.08)' : undefined,
                          fontWeight: selectedSubjectFilter === 'all' ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span>All Subjects</span>
                        {selectedSubjectFilter === 'all' && <Check size={14} />}
                      </DropdownMenu.Item>
                      {subjects.map(s => {
                        const isSelected = selectedSubjectFilter === s.id;
                        return (
                          <DropdownMenu.Item
                            key={s.id}
                            onClick={() => setSelectedSubjectFilter(isSelected ? 'all' : s.id)}
                            className="dropdown-item"
                            style={{
                              color: isSelected ? s.accent : 'var(--text-secondary)',
                              background: isSelected ? `${s.accent}12` : undefined,
                              fontWeight: isSelected ? 600 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: s.accent, flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                            </div>
                            {isSelected && <Check size={14} />}
                          </DropdownMenu.Item>
                        );
                      })}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Has Attachment toggle */}
                <button
                  type="button"
                  onClick={() => setFilterHasAttachment(!filterHasAttachment)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: filterHasAttachment ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                    border: filterHasAttachment ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0 12px',
                    height: '30px',
                    fontSize: '11px',
                    color: filterHasAttachment ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: filterHasAttachment ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  📎 Attachment
                </button>

                {/* Unacknowledged toggle */}
                <button
                  type="button"
                  onClick={() => setFilterUnacknowledgedOnly(!filterUnacknowledgedOnly)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: filterUnacknowledgedOnly ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255,255,255,0.02)',
                    border: filterUnacknowledgedOnly ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0 12px',
                    height: '30px',
                    fontSize: '11px',
                    color: filterUnacknowledgedOnly ? '#fbbf24' : 'var(--text-secondary)',
                    fontWeight: filterUnacknowledgedOnly ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  ⚡ Unacknowledged
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main ref={parentRef} className="page-content" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {activeFlashPosts.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="t-mono" style={{ color: 'var(--status-critical)', margin: '0 0 4px', letterSpacing: '0.04em', fontSize: '11px', fontWeight: 700 }}>
              URGENT ALERTS
            </p>
            {activeFlashPosts.map(fp => (
              <div 
                key={fp.id} 
                style={{
                  position: 'relative',
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 17, 26, 0.95) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 12px rgba(239, 68, 68, 0.05)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <AlertTriangle size={14} color="var(--status-critical)" />
                  </div>
                  <h3 className="truncate" style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                    {fp.title}
                  </h3>
                  
                  {/* Countdown Timer */}
                  {fp.expiresAt && (
                    <CountdownTimer 
                      expiresAt={fp.expiresAt} 
                      onExpire={() => {
                        queryClient.invalidateQueries({ queryKey: ['announcements'] });
                      }} 
                    />
                  )}
                </div>

                <div style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', opacity: 0.95 }}>
                  <RichTextBody text={fp.body} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => handleAcknowledge(fp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      background: 'rgba(52, 201, 123, 0.15)',
                      border: '1px solid rgba(52, 201, 123, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      color: 'var(--status-safe)',
                      fontSize: '11px',
                      fontWeight: 700,
                      outline: 'none',
                    }}
                    className="btn-ack-banner"
                    aria-label="Acknowledge alert"
                  >
                    <CheckCircle2 size={12} />
                    <span>Got it</span>
                  </button>

                  {(role === 'cr' || (role === 'teacher' && fp.authorId === authUser?.id)) && (
                    <button 
                      onClick={() => setPendingDeleteId(fp.id)} 
                      style={{
                        background: 'rgba(255, 68, 68, 0.12)', 
                        border: '1px solid rgba(255, 68, 68, 0.2)',
                        padding: '6px 12px', 
                        borderRadius: 'var(--radius-md)', 
                        color: 'var(--status-critical)', 
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                      aria-label="Remove alert"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {(() => {
          if (isLoading) {
            return <AnnouncementsSkeleton />;
          }
          if (filtered.length === 0) {
            if (activeTab === 'active' && searchQuery.trim() === '') {
              return (
                <EmptyState 
                  icon={<CheckCircle2 size={36} color="var(--status-safe)" style={{ filter: 'drop-shadow(0 0 8px rgba(52,201,123,0.35))' }} />} 
                  title="All Caught Up! ⚡" 
                  subtitle="You've acknowledged all active announcements in your hub." 
                />
              );
            }
            return <EmptyState icon={<Inbox size={36} color="var(--text-muted)" />} title="Nothing here" subtitle="No announcements found" />;
          }

          return (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem: any) => {
                const item = flatItems[virtualItem.index];
                if (!item) return null;

                return (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                      paddingBottom: '16px',
                    }}
                  >
                    {item.type === 'header' ? (
                      <TimelineSection title={item.title} count={item.count} />
                    ) : (
                      <AnnouncementCardComponent
                        ann={item.data}
                        isHighlighted={highlightId === item.data.id}
                        highlightRef={highlightRef}
                        role={role}
                        totalStudentsCount={totalStudentsCount}
                        ackCountsMap={ackCountsMap}
                        handleAcknowledge={handleAcknowledge}
                        setPendingDeleteId={setPendingDeleteId}
                        setTrackingAnnouncement={setTrackingAnnouncement}
                        setOpenCommentsAnnId={setOpenCommentsAnnId}
                        onShare={handleShareClick}
                        searchQuery={searchQuery}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* Bottom spacer — small extra clearance for FAB button overlap */}
        <div style={{ height: '80px', flexShrink: 0 }} aria-hidden="true" />
      </main>

      {(role === 'cr' || role === 'teacher') && (
        <button id="post-ann-fab" onClick={() => setShowCreate(true)} className="fab" aria-label="Post announcement">
          <Plus size={22} />
        </button>
      )}

      <CreateAnnouncementSheet 
        open={showCreate}
        shareInboxId={location.state?.shareInboxId}
        onClose={() => {
          setShowCreate(false);
          setActiveTab('active');
        }} 
      />
      
      <Suspense fallback={null}>
        <AcksTrackingSheet 
          open={Boolean(trackingAnnouncement)}
          announcement={prevTrackingAnnouncement || ({} as any)} 
          onClose={() => setTrackingAnnouncement(null)}
          sectionAcks={sectionAcks}
          members={members}
        />

        {/* Adaptive confirmation dialog / bottom-sheet for CR deletions */}
        <DeleteConfirmationModal
          open={Boolean(pendingDeleteId)}
          onClose={() => setPendingDeleteId(null)}
          onConfirm={async () => {
            if (pendingDeleteId) {
              await handleDelete(pendingDeleteId);
              setPendingDeleteId(null);
            }
          }}
        />
      </Suspense>

      <AnnouncementCommentsDrawer
        open={Boolean(openCommentsAnnId)}
        announcementId={prevOpenCommentsAnnId || ''}
        focusCommentId={focusCommentId}
        onClose={() => {
          setOpenCommentsAnnId(null);
          setFocusCommentId(null);
          // Clear URL search params without page reload
          const params = new URLSearchParams(window.location.search);
          params.delete('id');
          params.delete('expand_qa');
          params.delete('focus_comment');
          const newSearch = params.toString();
          const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, '', newPath);
        }}
      />

      <OffscreenSharePortal announcement={activeShareAnn} domRef={sharePortalRef} />

      {/* Share Options Sheet */}
      <BottomSheet 
        open={Boolean(shareOptionsAnn)} 
        onClose={() => setShareOptionsAnn(null)} 
        title="Share Notice"
      >
        {shareOptionsAnn && (
          <ShareOptionsContent
            ann={shareOptionsAnn}
            onShareNotice={() => {
              handleShareAnnouncement(shareOptionsAnn);
              setShareOptionsAnn(null);
            }}
            onSharePhotos={handleSharePhotos}
            isSharingPhotos={isSharingPhotos}
            selectedPhotos={selectedPhotos}
            setSelectedPhotos={setSelectedPhotos}
          />
        )}
      </BottomSheet>

      <NavBar />
    </div>
  );
}
