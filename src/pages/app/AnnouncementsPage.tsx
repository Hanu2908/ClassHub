import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Inbox, 
  Search, 
  X, 
  ArrowUpDown, 
  Award, 
  Coffee, 
  Calendar, 
  Megaphone, 
  LayoutList, 
  CalendarDays, 
  ChevronDown, 
  BarChart2, 
  Filter as FilterIcon 
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { EmptyState } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement } from '../../store/appStore';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAnnouncements, useDeleteAnnouncement, useAcknowledge } from '../../hooks/useAnnouncements';
import { useSubjects } from '../../hooks/useSubjects';
import { useSectionMembers, useSection } from '../../hooks/useSectionMembers';
import { AnnouncementCommentsDrawer } from '../../components/AnnouncementQA';
import RichTextBody from '../../components/RichTextBody';
import { supabase } from '../../lib/supabase';
import { matchSubject } from '../../lib/utils/announcements';
import { logEvent } from '../../lib/analytics';

import { OffscreenSharePortal } from '../../components/announcement-qa/OffscreenSharePortal';
import { shareAnnouncementCard } from '../../lib/utils/shareCard';
import { isPreviewableImage } from '../../lib/utils/attachments';
import { getThumbPath } from '../../lib/utils/imageResize';

const DeleteConfirmationModal = lazy(() => import('../../components/DeleteConfirmationModal'));
const AcksTrackingSheet = lazy(() => import('../../components/AcksTrackingSheet'));

type Filter = 'all' | 'critical' | 'general';
type ChannelTab = 'active' | 'exams' | 'schedule' | 'campus';

import {
  CreateAnnouncementSheet,
  EditAnnouncementSheet,
  AnnouncementCardComponent,
  TimelineSection,
  AnnouncementsSkeleton,
  ShareOptionsContent,
  CountdownTimer,
  getAnnouncementCategory,
  groupByTimeline,
  type AnnouncementWithAck,
} from './announcements';

export { AnnouncementCardComponent } from './announcements';


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

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
    }
  }, [location.state?.openCreate]);
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
  // Editing announcement state for inline edit sheet
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
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
              .createSignedUrl(att.storagePath, 3600);
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
                  .createSignedUrl(thumbPath, 3600);

                if (thumbData?.signedUrl) {
                  return { ...att, signedUrl: thumbData.signedUrl };
                }

                // Fallback to original
                const { data: origData } = await supabase.storage
                  .from('attachments')
                  .createSignedUrl(att.storagePath, 3600);

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
      // Pinned announcements always float to top
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
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
                            fontSize: '12px', 
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
                  <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                          fontSize: '12px',
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
                        fontSize: '12px',
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
                        fontSize: '12px',
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
                    fontSize: '12px',
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
                    fontSize: '12px',
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
            <p className="t-mono" style={{ color: 'var(--status-critical)', margin: '0 0 4px', letterSpacing: '0.04em', fontSize: '12px', fontWeight: 700 }}>
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
                      fontSize: '12px',
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
                        fontSize: '12px',
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
                        onEdit={(ann) => setEditingAnnouncement(ann)}
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
          if (location.state?.openCreate || location.state?.shareInboxId) {
            navigate(location.pathname, { replace: true, state: {} });
          }
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

      {/* Edit Announcement Sheet */}
      <EditAnnouncementSheet
        open={!!editingAnnouncement}
        announcement={editingAnnouncement}
        onClose={() => setEditingAnnouncement(null)}
      />

      <NavBar />
    </div>
  );
}


