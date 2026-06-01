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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', ...style }}>
      <AnnouncementReactions announcementId={announcementId} />
      <AnnouncementCommentTrigger announcementId={announcementId} onOpenComments={onOpenComments} />
      
      <button
        onClick={handleShareClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: showCheck ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          border: showCheck ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: showCheck ? 'var(--status-safe)' : 'var(--text-secondary)',
          fontSize: '12px',
          fontWeight: 500,
          transition: 'all var(--transition-fast)',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!showCheck) {
            e.currentTarget.style.borderColor = 'var(--accent-primary-muted)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showCheck) {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
        title="Share announcement card as image"
      >
        {showCheck ? <Check size={14} strokeWidth={3} /> : <Share2 size={14} />}
        <span>{showCheck ? 'Shared ✓' : 'Share'}</span>
      </button>
    </div>
  );
}
