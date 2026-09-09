import React, { useState, Suspense, lazy } from 'react';
import { 
  Pin, 
  PinOff, 
  Users, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Clock, 
  CheckCircle2, 
  Loader 
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence } from 'motion/react';

import { useAppStore, type Announcement, type Attachment } from '../../../store/appStore';
import { useTogglePinAnnouncement } from '../../../hooks/useSectionAdmin';
import type { SubjectInfo } from '../../../hooks/useSubjects';
import { timeAgo, deadlineBadgeClass, deadlineLabel } from '../../../components/Shared';
import { getAnnouncementCategory } from './announcementHelpers';
import { isPreviewableImage, signedUrlCache } from '../../../lib/utils/attachments';
import { getSubjectAbbreviation } from '../../../lib/utils/announcements';
import { HighlightText } from '../../../components/HighlightText';
import RichTextBody from '../../../components/RichTextBody';
import { ImageCarousel } from '../../../components/ImageCarousel';
import { AttachmentCard } from '../../../components/AttachmentCard';
import { AnnouncementQAFooter } from '../../../components/AnnouncementQA';

const ImageZoomModal = lazy(() => import('../../../components/ImageZoomModal'));

export interface AnnouncementCardComponentProps {
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
  onEdit?: (ann: Announcement) => void;
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
  onEdit,
  searchQuery
}: AnnouncementCardComponentProps) {
  const authUser = useAppStore(s => s.authUser);
  const togglePin = useTogglePinAnnouncement();
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
          {ann.isPinned && (
            <span className="badge" style={{
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Pin size={11} />
              Pinned
            </span>
          )}
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
          {ann.deadline && <span className={`badge ${bdg}`}>{lbl}</span>}
          {ann.expiresAt && (
            <span className="badge" style={{
              background: isExpiredAlert ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.15)',
              color: isExpiredAlert ? 'var(--text-muted)' : '#ef4444',
              border: isExpiredAlert ? '1px solid var(--border-default)' : '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '12px',
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
                fontSize: '12px',
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

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '6px',
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
                  {role === 'cr' && (
                    <DropdownMenu.Item
                      onClick={async (e) => {
                        e.stopPropagation();
                        await togglePin.mutateAsync({
                          announcementId: ann.id,
                          isPinned: !ann.isPinned,
                        });
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
                      {ann.isPinned ? <PinOff size={13} color="#eab308" /> : <Pin size={13} color="#eab308" />}
                      <span>{ann.isPinned ? 'Unpin' : 'Pin to Top'}</span>
                    </DropdownMenu.Item>
                  )}
                  {onEdit && (
                    <DropdownMenu.Item
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(ann);
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
                  )}
                  <DropdownMenu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(ann.id);
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
          </div>
        )}
      </div>

      {/* 2. Full-Width Typography Title */}
      <h2 className="t-card-title" style={{ 
        color: 'var(--text-primary)', 
        lineHeight: 1.3,
        fontSize: '17px',
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
            fontSize: '12px',
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
          }}>
            <RichTextBody text={ann.body} search={searchQuery} collapsed={!isExpanded} />
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
            fontSize: '12px',
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
              <span className="t-label" style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Expired</span>
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
              <span className="t-label" style={{ color: 'var(--status-safe)', fontSize: '12px', fontWeight: 600 }}>Acked</span>
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
