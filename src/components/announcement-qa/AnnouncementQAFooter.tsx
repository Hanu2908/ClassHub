import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { useAnnouncementQARealtime } from '../../hooks/useAnnouncementsQA';
import { AnnouncementReactions } from './AnnouncementReactions';
import { AnnouncementCommentTrigger } from './AnnouncementCommentTrigger';

interface AnnouncementQAFooterProps {
  announcementId: string;
  onOpenComments: () => void;
  onShare: () => void;
  style?: React.CSSProperties;
}

export function AnnouncementQAFooter({ announcementId, onOpenComments, onShare, style }: AnnouncementQAFooterProps) {
  // Single real-time channel mount point for the card/component.
  useAnnouncementQARealtime(announcementId);

  const [showCheck, setShowCheck] = useState(false);

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare();
    setShowCheck(true);
    setTimeout(() => {
      setShowCheck(false);
    }, 2000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', ...style }}>
      <AnnouncementReactions announcementId={announcementId} />
      <AnnouncementCommentTrigger announcementId={announcementId} onOpenComments={onOpenComments} />
      
      <button
        onClick={handleShareClick}
        aria-label={showCheck ? "Announcement shared" : "Share announcement card as image"}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          padding: 0,
          background: showCheck ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          color: showCheck ? 'var(--status-safe)' : 'var(--text-secondary)',
          transition: 'all var(--transition-fast)',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!showCheck) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showCheck) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
        title="Share announcement card as image"
      >
        {showCheck ? <Check size={16} strokeWidth={3} /> : <Share2 size={16} />}
      </button>
    </div>
  );
}
