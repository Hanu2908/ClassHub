import { MessageSquare } from 'lucide-react';
import { useAnnouncementComments } from '../../hooks/useAnnouncementsQA';

interface AnnouncementCommentTriggerProps {
  announcementId: string;
  onOpenComments: () => void;
}

export function AnnouncementCommentTrigger({ announcementId, onOpenComments }: AnnouncementCommentTriggerProps) {
  const { data: comments = [] } = useAnnouncementComments(announcementId);

  const count = comments.length;
  const verifiedCount = comments.filter(c => c.isVerified).length;

  const hasComments = count > 0;

  return (
    <button
      onClick={onOpenComments}
      aria-label={hasComments ? `View comments (${count} comments)` : "View comments (0 comments)"}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: hasComments ? 'auto' : '38px',
        height: '38px',
        padding: hasComments ? '0 12px' : '0',
        background: 'rgba(255, 255, 255, 0.03)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 600,
        transition: 'all var(--transition-fast)',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      title={hasComments ? `${count} comments` : 'Ask a question'}
    >
      <MessageSquare size={16} />
      {hasComments && <span>{count}</span>}
      {hasComments && verifiedCount > 0 && (
        <span
          style={{
            background: 'var(--status-safe-bg)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: 'var(--status-safe)',
            fontSize: '12px',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '8px',
            marginLeft: 2,
            display: 'inline-flex',
            alignItems: 'center',
            boxShadow: '0 0 6px rgba(52, 211, 153, 0.25)',
          }}
        >
          💡 Verified
        </span>
      )}
    </button>
  );
}
