import { Clock } from 'lucide-react';
import { tagTimeRemaining } from '../hooks/useUserTags';

interface TagPillProps {
  tagText: string;
  expiresAt?: string | null;
  /** sm = compact (comments), md = normal (profile/members) */
  size?: 'sm' | 'md';
  /** Tap handler for navigation (tap-to-filter) */
  onTap?: () => void;
  /** Remove handler — renders × button when provided */
  onRemove?: () => void;
  /** Show remaining time for expiring tags */
  showExpiry?: boolean;
}

export function TagPill({
  tagText,
  expiresAt,
  size = 'md',
  onTap,
  onRemove,
  showExpiry = false,
}: TagPillProps) {
  const isSm = size === 'sm';
  const hasExpiry = showExpiry && expiresAt;
  const remaining = hasExpiry ? tagTimeRemaining(expiresAt) : null;
  const isExpiringSoon = remaining === 'expiring soon';

  return (
    <span
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } } : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 3 : 5,
        padding: isSm ? '1px 7px' : '3px 10px',
        fontSize: isSm ? '10px' : '11px',
        fontWeight: 500,
        lineHeight: 1.4,
        color: 'var(--text-primary)',
        background: 'rgba(74, 158, 255, 0.08)',
        border: '1px solid rgba(74, 158, 255, 0.18)',
        borderRadius: 'var(--radius-pill)',
        cursor: onTap ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
        whiteSpace: 'nowrap',
        maxWidth: isSm ? '120px' : '160px',
        userSelect: 'none',
      }}
      onMouseEnter={onTap ? (e) => {
        e.currentTarget.style.background = 'rgba(74, 158, 255, 0.15)';
        e.currentTarget.style.borderColor = 'rgba(74, 158, 255, 0.3)';
      } : undefined}
      onMouseLeave={onTap ? (e) => {
        e.currentTarget.style.background = 'rgba(74, 158, 255, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(74, 158, 255, 0.18)';
      } : undefined}
    >
      {/* Tag text — truncate if too long */}
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {tagText}
      </span>

      {/* Expiry indicator */}
      {hasExpiry && remaining && remaining !== 'expired' && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          fontSize: isSm ? '8px' : '9px',
          color: isExpiringSoon ? 'var(--status-warning)' : 'var(--text-muted)',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          <Clock size={isSm ? 8 : 9} />
          {remaining}
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isSm ? 12 : 14,
            height: isSm ? 12 : 14,
            padding: 0,
            border: 'none',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: isSm ? '9px' : '10px',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'all var(--transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 68, 68, 0.15)';
            e.currentTarget.style.color = 'var(--status-critical)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label={`Remove tag ${tagText}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** Overflow indicator for when there are more tags than can be displayed */
export function TagOverflow({ count, size = 'md' }: { count: number; size?: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: isSm ? '1px 5px' : '3px 7px',
      fontSize: isSm ? '9px' : '10px',
      fontWeight: 600,
      color: 'var(--text-muted)',
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 'var(--radius-pill)',
    }}>
      +{count}
    </span>
  );
}
