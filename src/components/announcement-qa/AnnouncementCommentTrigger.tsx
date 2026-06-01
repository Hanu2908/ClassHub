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

  return (
    <button
      onClick={onOpenComments}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 500,
        transition: 'all var(--transition-fast)',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary-muted)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      <MessageSquare size={14} />
      <span>{count > 0 ? `${count} ${count === 1 ? 'Comment' : 'Comments'}` : 'Ask / Reply'}</span>
      {verifiedCount > 0 && (
        <span
          style={{
            background: 'var(--status-safe-bg)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: 'var(--status-safe)',
            fontSize: '9px',
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
