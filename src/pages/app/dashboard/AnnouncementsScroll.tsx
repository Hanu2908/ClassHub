import React, { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Megaphone, Award, Calendar, Coffee, Paperclip, ChevronLeft, ChevronRight, CheckCircle2, Image } from 'lucide-react';
import { deadlineBadgeClass, deadlineLabel, timeAgo } from '../../../components/Shared';
import { useAppStore, isExpired, type Announcement, type Attachment } from '../../../store/appStore';
import { useAnnouncements, useAcknowledge } from '../../../hooks/useAnnouncements';
import { useSection } from '../../../hooks/useSectionMembers';
import { useSubjects, type SubjectInfo } from '../../../hooks/useSubjects';
import { matchSubject, getSubjectAbbreviation } from '../../../lib/utils/announcements';
import { toast } from 'sonner';
import { AttachmentCard } from '../../../components/AttachmentCard';
import { ImageCarousel } from '../../../components/ImageCarousel';
import { AnimatePresence } from 'motion/react';
const ImageZoomModal = React.lazy(() => import('../../../components/ImageZoomModal'));
import { AnnouncementQAFooter } from '../../../components/AnnouncementQA';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAnnouncementsData } from './prefetchHelper';
import { WidgetSkeleton } from './dashboardUtils';
import RichTextBody from '../../../components/RichTextBody';
import { OffscreenSharePortal } from '../../../components/announcement-qa/OffscreenSharePortal';
import { shareAnnouncementCard } from '../../../lib/utils/shareCard';
import { isPreviewableImage, signedUrlCache } from '../../../lib/utils/attachments';
import { getThumbPath } from '../../../lib/utils/imageResize';
import { supabase } from '../../../lib/supabase';
import { BottomSheet } from '../../../components/BottomSheet';

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
          transition: 'border-color 0.2s, background-color 0.2s, transform 0.2s',
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
                  fontSize: '12px',
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
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: selectedPhotos.length === 0 ? 'none' : '0 4px 14px rgba(74, 158, 255, 0.3)',
            transition: 'background-color 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s',
            outline: 'none'
          }}
        >
          {isSharingPhotos ? 'Preparing Photos...' : `Share Selected Photos (${selectedPhotos.length})`}
        </button>
      </div>
    </div>
  );
}

export default function AnnouncementsScroll() {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const navigate = useNavigate();
  const acknowledgeMutation = useAcknowledge();

  // Swipe mechanics states
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<(Announcement & { isAcknowledged: boolean; matchedSubject?: SubjectInfo | null }) | null>(null);
  const [prevSelectedAnn, setPrevSelectedAnn] = useState<(Announcement & { isAcknowledged: boolean; matchedSubject?: SubjectInfo | null }) | null>(null);

  useEffect(() => {
    if (selectedAnn) {
      setPrevSelectedAnn(selectedAnn);
    }
  }, [selectedAnn]);

  // Announcement sharing states
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

  const [zoomModalData, setZoomModalData] = useState<{
    images: Array<{ thumbUrl: string; fullUrl: string }>;
    initialIndex: number;
  } | null>(null);

  const handleImageClick = (imagesList: Attachment[], index: number) => {
    const modalImages = imagesList.map(img => {
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

  const { data: subjects = [] } = useSubjects();
  const { data: announcements = [], isLoading } = useAnnouncements({ limit: 12, placeholder: true });
  const visible = useMemo(() => {
    return announcements
      .filter(a => !isExpired(a.deadline))
      .map(a => ({
        ...a,
        matchedSubject: matchSubject(a.title, a.body, subjects)
      }))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }, [announcements, subjects]);

  if (isLoading) return <WidgetSkeleton />;

  const safeActiveIndex = visible.length > 0 ? activeCardIndex % visible.length : 0;

  const handleDragStart = (clientX: number) => {
    setDragStart(clientX);
  };

  const handleDragMove = (clientX: number) => {
    if (dragStart === null) return;
    const offset = clientX - dragStart;
    setDragOffset(offset);
  };

  const handleDragEnd = () => {
    if (dragStart === null) return;
    if (dragOffset > 80) {
      setSwipeDirection('right');
      setTimeout(() => {
        setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
        setDragOffset(0);
        setSwipeDirection(null);
      }, 300);
    } else if (dragOffset < -80) {
      setSwipeDirection('left');
      setTimeout(() => {
        setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
        setDragOffset(0);
        setSwipeDirection(null);
      }, 300);
    } else {
      setDragOffset(0);
    }
    setDragStart(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
    } else if (e.key === 'ArrowRight') {
      setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
    }
  };

  const cardsToRender: { item: Announcement & { isAcknowledged: boolean; matchedSubject?: SubjectInfo | null }; relativeIndex: number }[] = [];
  if (visible.length > 0) {
    for (let i = 0; i < Math.min(visible.length, 3); i++) {
      const idx = (safeActiveIndex + i) % visible.length;
      cardsToRender.push({ item: visible[idx], relativeIndex: i });
    }
  }

  return (
    <section>
      <div className="section-header">
        <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Announcements
          {visible.some(ann => !ann.isAcknowledged) && <span className="pulse-unread-dot" title="New announcements waiting" />}
        </span>
        <button 
          className="section-link" 
          onClick={() => navigate('/app/announcements')}
          onMouseEnter={prefetchAnnouncements}
          onTouchStart={prefetchAnnouncements}
        >
          View all →
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={24} color="var(--text-secondary)" />
          </div>
          <div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>No news is good news</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>You're caught up on announcements.</p>
          </div>
        </div>
      ) : (
        <div style={{ overflow: 'hidden', padding: '10px 0 20px 0' }}>
          {/* Card Stack Area */}
          <div 
            className="announcement-stack-container"
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Announcement cards stack. Use left and right arrow keys to cycle."
            style={{ outline: 'none' }}
          >
            {cardsToRender.map(({ item, relativeIndex }) => {
              const ann = item;
              const isUnread = !ann.isAcknowledged;
              
              let cardStyle: CSSProperties;
              let layerClass: string;
              let dragListeners = {};

              if (relativeIndex === 0) {
                layerClass = 'announcement-layer-0';
                cardStyle = {
                  transform: `translate3d(${dragOffset}px, 0, 0) rotate(${dragOffset * 0.04}deg) scale(1)`,
                  cursor: dragStart !== null ? 'grabbing' : 'grab',
                };
                dragListeners = {
                  onTouchStart: (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX),
                  onTouchMove: (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX),
                  onTouchEnd: handleDragEnd,
                  onMouseDown: (e: React.MouseEvent) => handleDragStart(e.clientX),
                  onMouseMove: (e: React.MouseEvent) => {
                    if (dragStart !== null) handleDragMove(e.clientX);
                  },
                  onMouseUp: handleDragEnd,
                  onMouseLeave: handleDragEnd,
                };
              } else if (relativeIndex === 1) {
                layerClass = 'announcement-layer-1';
                cardStyle = {
                  transform: `translate3d(0, 8px, -12px) scale(${0.96 + Math.min(Math.abs(dragOffset) / 200, 0.04)})`,
                };
              } else {
                layerClass = 'announcement-layer-2';
                cardStyle = {
                  transform: `translate3d(0, 16px, -24px) scale(${0.92 + Math.min(Math.abs(dragOffset) / 200, 0.04)})`,
                };
              }

              return (
                <div
                  key={ann.id}
                  className={`announcement-card-layer ${layerClass} ${
                    relativeIndex === 0 && swipeDirection === 'left' ? 'announcement-swipe-left' : ''
                  } ${relativeIndex === 0 && swipeDirection === 'right' ? 'announcement-swipe-right' : ''}`}
                  style={cardStyle}
                  {...dragListeners}
                >
                  <div
                    onClick={() => {
                      if (relativeIndex === 0 && dragOffset === 0) {
                        setSelectedAnn(ann);
                      }
                    }}
                    role="button"
                    tabIndex={relativeIndex === 0 ? 0 : -1}
                    className={`card card-solid-charcoal ${ann.priority === 'critical' ? 'card-critical-solid' : 'card-general-solid'}`}
                    style={{ 
                      width: '100%', 
                      height: '148px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      padding: '16px',
                      textAlign: 'left',
                      position: 'relative',
                      borderWidth: '1px',
                      cursor: relativeIndex === 0 ? 'pointer' : 'default',
                      outline: 'none',
                    }}
                  >
                    {relativeIndex === 0 ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {(() => {
                                const category = getAnnouncementCategory(ann.title, ann.priority);
                                return (
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
                                    <span className="t-mono-sm ann-category-tag" style={{ color: category.color, fontWeight: 600, fontSize: '12px' }}>
                                      {category.name}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {isUnread && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await acknowledgeMutation.mutateAsync(ann.id);
                                    toast.success('Notice acknowledged successfully!');
                                  } catch {
                                    toast.error('Failed to acknowledge notice');
                                  }
                                }}
                                style={{
                                  background: ann.priority === 'critical' 
                                    ? 'rgba(239, 68, 68, 0.12)' 
                                    : 'rgba(96, 165, 250, 0.12)',
                                  border: ann.priority === 'critical' 
                                    ? '1px solid rgba(239, 68, 68, 0.35)' 
                                    : '1px solid rgba(96, 165, 250, 0.35)',
                                  borderRadius: '50%',
                                  width: 36,
                                  height: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: ann.priority === 'critical' ? '#ef4444' : '#60a5fa',
                                  transition: 'all 0.2s',
                                  position: 'absolute',
                                  top: 10,
                                  right: 10,
                                  zIndex: 10,
                                }}
                                title="Quick Acknowledge"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            )}
                          </div>
                          <p className="t-button" style={{ 
                            fontSize: '15px', 
                            color: 'var(--text-primary)', 
                            marginBottom: 2, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            fontWeight: 600, 
                            lineHeight: 1.3,
                            width: '100%',
                            overflow: 'hidden',
                          }}>
                            {ann.matchedSubject && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                backgroundColor: `${ann.matchedSubject.accent}15`,
                                color: ann.matchedSubject.accent,
                                border: `1px solid ${ann.matchedSubject.accent}30`,
                                lineHeight: 1,
                                flexShrink: 0,
                              }}>
                                {getSubjectAbbreviation(ann.matchedSubject)}
                              </span>
                            )}
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}>
                              {ann.title}
                            </span>
                          </p>
                          {ann.body && ann.body.trim() && (
                            <p className="t-body" style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                              marginTop: 4,
                              opacity: 0.85
                            }}>
                              {ann.body}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {ann.deadline ? (
                            <span className={`badge ${deadlineBadgeClass(ann.deadline)}`}>{deadlineLabel(ann.deadline)}</span>
                          ) : <span className="badge" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>No deadline</span>}

                          {ann.attachments && ann.attachments.length > 0 && (
                            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                              <Paperclip size={10} /> {ann.attachments.length}
                            </span>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chevrons and Dot Indicators */}
          {visible.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 4 }}>
              <button 
                onClick={() => {
                  setSwipeDirection('right');
                  setTimeout(() => {
                    setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
                    setSwipeDirection(null);
                  }, 200);
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', outline: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                aria-label="Previous announcement"
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {visible.map((_, idx) => (
                  <span 
                    key={idx} 
                    style={{ 
                      width: idx === safeActiveIndex ? 16 : 6, 
                      height: 6, 
                      borderRadius: 3, 
                      background: idx === safeActiveIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)', 
                      transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' 
                    }} 
                  />
                ))}
              </div>

              <button 
                onClick={() => {
                  setSwipeDirection('left');
                  setTimeout(() => {
                    setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
                    setSwipeDirection(null);
                  }, 200);
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', outline: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                aria-label="Next announcement"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      <BottomSheet open={Boolean(selectedAnn)} onClose={() => setSelectedAnn(null)} title="Announcement Details">
        {prevSelectedAnn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Category and Title */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {(() => {
                  const category = getAnnouncementCategory(prevSelectedAnn.title, prevSelectedAnn.priority);
                  return (
                    <>
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
                        <span className="t-mono-sm ann-category-tag" style={{ color: category.color, fontWeight: 600, fontSize: '12px' }}>
                          {category.name}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(prevSelectedAnn.postedAt)}
                      </span>
                    </>
                  );
                })()}
              </div>
              <h2 className="t-card-title" style={{ 
                fontSize: 21, 
                color: 'var(--text-primary)', 
                lineHeight: 1.3, 
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                {(prevSelectedAnn as any).matchedSubject && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: `${(prevSelectedAnn as any).matchedSubject.accent}15`,
                    color: (prevSelectedAnn as any).matchedSubject.accent,
                    border: `1px solid ${(prevSelectedAnn as any).matchedSubject.accent}30`,
                    lineHeight: 1,
                  }}>
                    {getSubjectAbbreviation((prevSelectedAnn as any).matchedSubject)}
                  </span>
                )}
                <span>{prevSelectedAnn.title}</span>
              </h2>
            </div>

            {/* Rich Body Content */}
            {prevSelectedAnn.body && prevSelectedAnn.body.trim() && (
              <div className="t-body" style={{ color: 'var(--text-primary)', lineHeight: 1.6, maxHeight: '30vh', overflowY: 'auto', paddingRight: 4, textAlign: 'left' }}>
                <RichTextBody text={prevSelectedAnn.body} />
              </div>
            )}

            {/* Deadline Badge */}
            {prevSelectedAnn.deadline && (
              <div style={{ textAlign: 'left' }}>
                <span className="t-caption" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notice Deadline</span>
                <span className={`badge ${deadlineBadgeClass(prevSelectedAnn.deadline)}`}>
                  {deadlineLabel(prevSelectedAnn.deadline)}
                </span>
              </div>
            )}

            {/* Attachments Section */}
            {(() => {
              const images = prevSelectedAnn.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];
              const otherFiles = prevSelectedAnn.attachments?.filter(att => !isPreviewableImage(att.fileType, att.filename)) || [];

              if (!prevSelectedAnn.attachments || prevSelectedAnn.attachments.length === 0) return null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                  <span className="t-caption" style={{ color: 'var(--text-muted)' }}>Attachments ({prevSelectedAnn.attachments.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {images.length > 0 && (
                      <ImageCarousel images={images} onImageClick={(index) => handleImageClick(images, index)} />
                    )}
                    {otherFiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {otherFiles.map((att: Attachment) => (
                          <AttachmentCard key={att.id} attachment={att} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Q&A & Emoji Reactions Footer */}
            <div style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              <AnnouncementQAFooter 
                announcementId={prevSelectedAnn.id} 
                onOpenComments={() => {
                  setSelectedAnn(null);
                  navigate(`/app/announcements?id=${prevSelectedAnn.id}&expand_qa=true`);
                }}
                onShare={() => handleShareClick(prevSelectedAnn)}
                style={{ justifyContent: 'space-between', width: '100%' }}
              />
            </div>

            {/* Action / Acknowledgment CTAs */}
            <div style={{ marginTop: 8 }}>
              {prevSelectedAnn.isAcknowledged ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399' }}>
                  <CheckCircle2 size={18} />
                  <span className="t-mono-sm">Notice Acknowledged</span>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await acknowledgeMutation.mutateAsync(prevSelectedAnn.id);
                      setSelectedAnn(prev => prev ? { ...prev, isAcknowledged: true } : null);
                      setPrevSelectedAnn(prev => prev ? { ...prev, isAcknowledged: true } : null);
                      toast.success('Notice acknowledged successfully!');
                    } catch {
                      toast.error('Failed to acknowledge notice');
                    }
                  }}
                  disabled={acknowledgeMutation.isPending}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(74, 158, 255, 0.3)'
                  }}
                  className="zenith-cta-btn"
                >
                  {acknowledgeMutation.isPending ? 'Signing Off...' : 'Acknowledge Broadcast'}
                </button>
              )}
            </div>
          </div>
        )}
        <OffscreenSharePortal announcement={activeShareAnn} domRef={sharePortalRef} />
      </BottomSheet>

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

      <AnimatePresence>
        {zoomModalData && (
          <React.Suspense fallback={
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
              <div style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Loading Viewer…</div>
            </div>
          }>
            <ImageZoomModal
              images={zoomModalData.images}
              initialIndex={zoomModalData.initialIndex}
              onClose={() => setZoomModalData(null)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
    </section>
  );
}
