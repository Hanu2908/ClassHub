import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle, Inbox, Trash2, Loader, Search, X, ArrowUpDown, Users, Award, Coffee, Calendar, Megaphone, LayoutList, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { CROnly, EmptyState, timeAgo, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement, type Attachment } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAnnouncements, useSectionMembers } from '../../hooks/useSupabaseQuery';
import { useCreateAnnouncement, useDeleteAnnouncement, useAcknowledge } from '../../hooks/useSupabaseMutations';
import { AnnouncementReactions, AnnouncementCommentTrigger, AnnouncementCommentsDrawer } from '../../components/AnnouncementQA';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentCard } from '../../components/AttachmentCard';
import { supabase } from '../../lib/supabase';
import { uploadAttachments } from '../../lib/utils/uploadAttachment';
import { AnnouncementsSkeleton } from '../../components/LoadingSkeletons';

const DeleteConfirmationModal = lazy(() => import('../../components/DeleteConfirmationModal'));
const AcksTrackingSheet = lazy(() => import('../../components/AcksTrackingSheet'));

type Filter = 'all' | 'critical' | 'general';
type ChannelTab = 'active' | 'exams' | 'schedule' | 'campus';

function CreateAnnouncementSheet({ onClose }: { onClose: () => void }) {
  const createAnn = useCreateAnnouncement();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'general' | 'critical'>('general');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) { showToast('Title and body required', 'error'); return; }
    
    setIsPosting(true);
    try {
      const parentId = await createAnn.mutateAsync({
        title: title.trim(),
        message: body.trim(),
        priority,
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null,
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
          showToast(`${uploadResult.failed.length} file(s) failed to upload`, 'warning');
        }
      }

      showToast('Announcement posted', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to post', 'error');
    } finally {
      setIsPosting(false);
      setUploadProgress(0);
    }
  };

  const pending = createAnn.isPending || isPosting;

  return (
    <BottomSheet onClose={onClose} title="Post Announcement">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
        <div>
          <label htmlFor="composer-title" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input 
            id="composer-title"
            style={inputStyle} 
            className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
            placeholder="e.g. End Semester Exam Schedule" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
        </div>
        <div>
          <label htmlFor="composer-body" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea 
            id="composer-body"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} 
            className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
            placeholder="Details of the announcement…" 
            value={body} 
            onChange={e => setBody(e.target.value)} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
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
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasDeadline ? 8 : 0 }}>
            <input type="checkbox" checked={hasDeadline} onChange={e => setHasDeadline(e.target.checked)} />
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
      name: 'Critical Alert',
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

interface AnnouncementCardComponentProps {
  ann: Announcement & { isAcknowledged: boolean };
  isHighlighted: boolean;
  highlightRef: React.RefObject<HTMLDivElement | null> | null;
  role: string;
  totalStudentsCount: number;
  ackCountsMap: Record<string, number>;
  handleAcknowledge: (id: string) => void;
  setPendingDeleteId: (id: string | null) => void;
  setTrackingAnnouncement: (ann: Announcement | null) => void;
  setOpenCommentsAnnId: (id: string | null) => void;
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
  setOpenCommentsAnnId
}: AnnouncementCardComponentProps) {
  const [hovered, setHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isCritical = ann.priority === 'critical';
  const isAcked = ann.isAcknowledged;
  const bdg = deadlineBadgeClass(ann.deadline);
  const lbl = deadlineLabel(ann.deadline);
  const category = getAnnouncementCategory(ann.title, ann.priority);

  const isLongText = ann.body.length > 200 || ann.body.split('\n').length > 3;

  const glowingOutlineStyle: React.CSSProperties = {
    position: 'relative',
    border: hovered ? `1px solid ${category.color}` : '1px solid var(--border-default)',
    borderLeft: `4px solid ${category.color}`,
    boxShadow: hovered 
      ? `0 12px 30px rgba(0, 0, 0, 0.25), 0 0 15px ${category.bgColor}`
      : `0 4px 20px rgba(0, 0, 0, 0.15), inset 2px 0 8px ${category.bgColor}`,
    transform: hovered ? 'scale(1.012)' : 'scale(1)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'fadeSlideUp 0.35s ease both',
    padding: '18px',
    borderRadius: 'var(--radius-lg)',
    background: isCritical ? 'var(--status-critical-bg)' : 'var(--bg-elevated)',
    outline: isHighlighted ? '2px solid var(--accent-primary)' : undefined,
    outlineOffset: isHighlighted ? '2px' : undefined,
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
        </div>

        {/* CR Tools (Delete, Receipt Tracking) */}
        {role === 'cr' && (
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
      }}>
        {ann.title}
      </h2>

      {/* 3. In-Place Option A Expand with Soft Glass Fade */}
      <div style={{ position: 'relative', width: '100%' }}>
        <p className="t-body" style={{ 
          color: 'var(--text-secondary)', 
          lineHeight: 1.6, 
          fontSize: '13.5px',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          display: isExpanded ? 'block' : '-webkit-box',
          WebkitLineClamp: isExpanded ? undefined : 3,
          WebkitBoxOrient: isExpanded ? undefined : 'vertical',
          overflow: isExpanded ? 'visible' : 'hidden',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {ann.body}
        </p>
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
          {ann.attachments.map((att: Attachment) => (
            <AttachmentCard key={att.id} attachment={att} />
          ))}
        </div>
      )}

      {/* 5. Time Ago Indicator */}
      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
        Posted {timeAgo(ann.postedAt)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <AnnouncementReactions announcementId={ann.id} />
          
          <AnnouncementCommentTrigger 
            announcementId={ann.id} 
            onOpenComments={() => setOpenCommentsAnnId(ann.id)} 
          />
        </div>

        <div>
          {!isAcked ? (
            <button
              id={`ack-btn-${ann.id}`}
              onClick={() => handleAcknowledge(ann.id)}
              className="btn-ack-btn"
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '6px 12px',
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', 
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
              <CheckCircle2 size={13} /> Acknowledge
            </button>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '6px 12px', 
              background: 'var(--status-safe-bg)', 
              border: '1px solid rgba(52,201,123,0.25)', 
              borderRadius: 'var(--radius-md)', 
              boxSizing: 'border-box'
            }}>
              <CheckCircle2 size={13} color="var(--status-safe)" />
              <span className="t-label" style={{ color: 'var(--status-safe)', fontSize: '11px', fontWeight: 600 }}>Acked</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [sortBy, setSortBy] = useState<'newest' | 'priority' | 'deadline'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [trackingAnnouncement, setTrackingAnnouncement] = useState<Announcement | null>(null);
  // Pending delete target state for confirmation dialog
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [highlightId] = useState<string | null>(() => new URLSearchParams(location.search).get('highlight'));
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Q&A Comments Drawer States
  const [openCommentsAnnId, setOpenCommentsAnnId] = useState<string | null>(null);
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);

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

  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;

  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteAnn = useDeleteAnnouncement();
  const ackMutation = useAcknowledge();

  // Sort dropdown reference for click outside dismissed behaviour
  const sortContainerRef = useRef<HTMLDivElement>(null);

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

  // Handle click outside and Escape key dismissals for sorting dropdown
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (showSortDropdown && sortContainerRef.current && !sortContainerRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSortDropdown) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    window.addEventListener('keydown', handleKeys);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKeys);
    };
  }, [showSortDropdown]);

  // Filter out CRs to count students
  const totalStudents = members.filter(m => m.role === 'student');
  const totalStudentsCount = totalStudents.length;

  // Acknowledgment counts map
  const ackCountsMap = sectionAcks.reduce((acc, curr) => {
    acc[curr.announcement_id] = (acc[curr.announcement_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Auto-expiry: hide items past deadline + 2 days
  const visible = announcements.filter(a => !isExpired(a.deadline));

  const criticalCounts = useMemo(() => {
    const counts = { active: 0, exams: 0, schedule: 0, campus: 0 };
    visible.forEach(a => {
      if (a.priority === 'critical' && !a.isAcknowledged) {
        counts.active++;
        
        const categoryInfo = getAnnouncementCategory(a.title, a.priority);
        const categoryName = categoryInfo.name;
        const lowerTitle = (a.title || '').toLowerCase();
        
        // Check exams
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        if (categoryName === 'Academic Exam' || (categoryName === 'Critical Alert' && hasExamKeywords)) {
          counts.exams++;
        }
        
        // Check schedule
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        if (categoryName === 'Schedule Change' || (categoryName === 'Critical Alert' && hasScheduleKeywords)) {
          counts.schedule++;
        }
        
        // Check campus
        const isGeneralOrHoliday = categoryName === 'Campus Holiday' || categoryName === 'General Announcement';
        const isCriticalGeneral = categoryName === 'Critical Alert' && !hasExamKeywords && !hasScheduleKeywords;
        if (isGeneralOrHoliday || isCriticalGeneral) {
          counts.campus++;
        }
      }
    });
    return counts;
  }, [visible]);

  // Pure rendering date timestamp initialized once on mount to keep rendering pure
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    return visible.filter(a => {
      // 1. Tab-based channel filter:
      const categoryInfo = getAnnouncementCategory(a.title, a.priority);
      const categoryName = categoryInfo.name;
      const lowerTitle = (a.title || '').toLowerCase();
      
      let matchesTab = false;
      if (activeTab === 'active') {
        matchesTab = !a.isAcknowledged || justAckedIds.has(a.id);
      } else if (activeTab === 'exams') {
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        matchesTab = categoryName === 'Academic Exam' || (categoryName === 'Critical Alert' && hasExamKeywords);
      } else if (activeTab === 'schedule') {
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        matchesTab = categoryName === 'Schedule Change' || (categoryName === 'Critical Alert' && hasScheduleKeywords);
      } else if (activeTab === 'campus') {
        const hasExamKeywords = lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz') || lowerTitle.includes('midterm') || lowerTitle.includes('practical') || lowerTitle.includes('mst') || lowerTitle.includes('assessment') || lowerTitle.includes('viva');
        const hasScheduleKeywords = lowerTitle.includes('schedule') || lowerTitle.includes('class') || lowerTitle.includes('timing') || lowerTitle.includes('timetable') || lowerTitle.includes('slot') || lowerTitle.includes('rescheduled') || lowerTitle.includes('postponed');
        const isGeneralOrHoliday = categoryName === 'Campus Holiday' || categoryName === 'General Announcement';
        const isCriticalGeneral = categoryName === 'Critical Alert' && !hasExamKeywords && !hasScheduleKeywords;
        matchesTab = isGeneralOrHoliday || isCriticalGeneral;
      }

      // 2. Urgency nested sub-filter:
      const matchesFilter = filter === 'all' ? true : a.priority === filter;

      // 3. Search query:
      const matchesSearch = searchQuery.trim() === '' || 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.body.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesFilter && matchesSearch;
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
  }, [visible, activeTab, filter, searchQuery, sortBy, now, justAckedIds]);

  const groupedAnnouncements = useMemo(() => {
    return groupByTimeline(filtered, now);
  }, [filtered, now]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAnn.mutateAsync(id);
      showToast('Announcement deleted', 'info');
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await ackMutation.mutateAsync(id);
      showToast('Acknowledged ✓', 'success');
      setJustAckedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch { showToast('Failed to acknowledge', 'error'); }
  };

  return (
    <div className="page-shell">
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
        </div>

        {/* Row 1: Channel Tabs (horizontal scrolling) */}
        <div className="filter-tabs" style={{ marginBottom: 12, paddingBottom: 2 }}>
          {(['active', 'exams', 'schedule', 'campus'] as ChannelTab[]).map(t => {
            let label: string;
            let icon: React.ReactNode;
            if (t === 'exams') { label = 'Exams'; icon = <Award size={13} />; }
            else if (t === 'schedule') { label = 'Schedule'; icon = <Calendar size={13} />; }
            else if (t === 'campus') { label = 'Campus'; icon = <Coffee size={13} />; }
            else { label = 'Active Feed'; icon = <Megaphone size={13} />; }

            const criticalCount = criticalCounts[t];

            return (
              <button
                key={t}
                id={`channel-tab-${t}`}
                className={`filter-tab${activeTab === t ? ' active' : ''}`}
                onClick={() => setActiveTab(t)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {icon}
                <span>{label}</span>
                {criticalCount > 0 && (
                  <span style={{ 
                    background: 'var(--status-critical)', 
                    color: '#fff', 
                    fontSize: '9px', 
                    fontWeight: 700, 
                    padding: '1px 5px', 
                    borderRadius: '8px',
                    marginLeft: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 8px var(--status-critical)',
                  }}>
                    {criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2: Sub-filters, Layout Toggle, Sorting, Search Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Sub-filters (All / Critical / General) */}
          <div className="filter-tabs" style={{ margin: 0, paddingBottom: 0 }}>
            {(['all', 'critical', 'general'] as Filter[]).map(f => (
              <button
                key={f}
                id={`ann-filter-${f}`}
                className={`filter-tab${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
                style={{ textTransform: 'capitalize', padding: '6px 12px', fontSize: '11px' }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Layout Mode Toggle */}
            <button
              onClick={toggleLayoutMode}
              className={`header-action-btn${layoutMode === 'feed' ? ' active' : ''}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)'
              }}
              aria-label={`Switch to ${layoutMode === 'timeline' ? 'Feed' : 'Timeline'} Mode`}
              title={`Switch to ${layoutMode === 'timeline' ? 'Feed' : 'Timeline'} Mode`}
            >
              {layoutMode === 'timeline' ? <LayoutList size={18} /> : <CalendarDays size={18} />}
            </button>

            {/* Sorting Dropdown Trigger */}
            <div className="sort-dropdown-container" ref={sortContainerRef}>
              <button
                onClick={() => {
                  setShowSortDropdown(!showSortDropdown);
                  setShowSearch(false);
                }}
                className={`header-action-btn${(showSortDropdown || sortBy !== 'newest') ? ' active' : ''}`}
                aria-label="Sort Options"
              >
                <ArrowUpDown size={18} />
              </button>
              {showSortDropdown && (
                <div className="sort-dropdown-menu" role="menu" aria-label="Sort Options Menu">
                  <button
                    role="menuitem"
                    className={`sort-dropdown-item${sortBy === 'newest' ? ' active' : ''}`}
                    onClick={() => { setSortBy('newest'); setShowSortDropdown(false); }}
                  >
                    <span>Newest First</span>
                  </button>
                  <button
                    role="menuitem"
                    className={`sort-dropdown-item${sortBy === 'priority' ? ' active' : ''}`}
                    onClick={() => { setSortBy('priority'); setShowSortDropdown(false); }}
                  >
                    <span>Priority First</span>
                  </button>
                  <button
                    role="menuitem"
                    className={`sort-dropdown-item${sortBy === 'deadline' ? ' active' : ''}`}
                    onClick={() => { setSortBy('deadline'); setShowSortDropdown(false); }}
                  >
                    <span>Closest Deadline</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search Toggle Button */}
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                setShowSortDropdown(false);
                if (showSearch) setSearchQuery(''); // Clear search on collapse
              }}
              className={`header-action-btn${(showSearch || searchQuery) ? ' active' : ''}`}
              aria-label="Toggle Search"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* Collapsible Search Bar Container */}
        <div className={`search-bar-container${showSearch || searchQuery ? ' open' : ''}`} style={{ marginTop: 8 }}>
          <div className="search-input-wrapper">
            <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search announcements"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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
        </div>
      </header>

      <main className="page-content">
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

          const renderCard = (ann: Announcement & { isAcknowledged: boolean }) => {
            const isHighlighted = highlightId === ann.id;
            return (
              <AnnouncementCardComponent
                key={ann.id}
                ann={ann}
                isHighlighted={isHighlighted}
                highlightRef={highlightRef}
                role={role}
                totalStudentsCount={totalStudentsCount}
                ackCountsMap={ackCountsMap}
                handleAcknowledge={handleAcknowledge}
                setPendingDeleteId={setPendingDeleteId}
                setTrackingAnnouncement={setTrackingAnnouncement}
                setOpenCommentsAnnId={setOpenCommentsAnnId}
              />
            );
          };

          if (layoutMode === 'timeline') {
            const { thisWeek, lastWeek, older } = groupedAnnouncements;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {thisWeek.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TimelineSection title="This Week" count={thisWeek.length} />
                    {thisWeek.map(renderCard)}
                  </div>
                )}
                {lastWeek.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TimelineSection title="Last Week" count={lastWeek.length} />
                    {lastWeek.map(renderCard)}
                  </div>
                )}
                {older.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TimelineSection title="Older" count={older.length} />
                    {older.map(renderCard)}
                  </div>
                )}
              </div>
            );
          }

          // Feed Mode
          return filtered.map(renderCard);
        })()}
      </main>

      <CROnly>
        <button id="post-ann-fab" onClick={() => setShowCreate(true)} className="fab" aria-label="Post announcement">
          <Plus size={22} />
        </button>
      </CROnly>

      {showCreate && (
        <CreateAnnouncementSheet 
          onClose={() => {
            setShowCreate(false);
            setActiveTab('active');
          }} 
        />
      )}
      
      <Suspense fallback={null}>
        {trackingAnnouncement && (
          <AcksTrackingSheet 
            announcement={trackingAnnouncement} 
            onClose={() => setTrackingAnnouncement(null)}
            sectionAcks={sectionAcks}
            members={members}
          />
        )}

        {/* Adaptive confirmation dialog / bottom-sheet for CR deletions */}
        {pendingDeleteId && (
          <DeleteConfirmationModal
            onClose={() => setPendingDeleteId(null)}
            onConfirm={async () => {
              if (pendingDeleteId) {
                await handleDelete(pendingDeleteId);
                setPendingDeleteId(null);
              }
            }}
          />
        )}
      </Suspense>

      {openCommentsAnnId && (
        <AnnouncementCommentsDrawer
          announcementId={openCommentsAnnId}
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
      )}

      <NavBar />
    </div>
  );
}
