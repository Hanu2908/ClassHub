import React from 'react';
import { useAnnouncementQARealtime } from '../../hooks/useAnnouncementsQA';
import { AnnouncementReactions } from './AnnouncementReactions';
import { AnnouncementCommentTrigger } from './AnnouncementCommentTrigger';

interface AnnouncementQAFooterProps {
  announcementId: string;
  onOpenComments: () => void;
  style?: React.CSSProperties;
}

export function AnnouncementQAFooter({ announcementId, onOpenComments, style }: AnnouncementQAFooterProps) {
  // Single real-time channel mount point for the card/component.
  // Both Reaction and Comment trigger subcomponents can read from the shared queries/states
  // while this hook maintains the background reference-counted pool connection active.
  useAnnouncementQARealtime(announcementId);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', ...style }}>
      <AnnouncementReactions announcementId={announcementId} />
      <AnnouncementCommentTrigger announcementId={announcementId} onOpenComments={onOpenComments} />
    </div>
  );
}
