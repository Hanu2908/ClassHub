import { useState, useRef, useEffect } from 'react';
import { Smile, Plus } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import {
  useAnnouncementReactions,
  useToggleReaction,
  type QAReaction,
  type ToggleReactionInput,
} from '../../hooks/useAnnouncementsQA';

interface AnnouncementReactionsProps {
  announcementId: string;
}

export function AnnouncementReactions({ announcementId }: AnnouncementReactionsProps) {
  const authUser = useAppStore(s => s.authUser);
  const currentUserId = authUser?.id;

  const { data: reactions = [] } = useAnnouncementReactions(announcementId);
  const toggleReaction = useToggleReaction(announcementId);

  const [showPopover, setShowPopover] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, curr) => {
    if (!acc[curr.emoji]) {
      acc[curr.emoji] = [];
    }
    acc[curr.emoji].push(curr);
    return acc;
  }, {} as Record<string, QAReaction[]>);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const handleToggleEmoji = async (emoji: string) => {
    // Capture the user's CURRENT reaction at click-time (before any optimistic update)
    // This is passed to the mutation so mutationFn never reads the stale optimistic cache
    const existingReaction = reactions.find(r => r.userId === currentUserId) ?? null;
    const input: ToggleReactionInput = { emoji, existingReaction };
    try {
      await toggleReaction.mutateAsync(input);
    } catch {
      // Toast handles error in hook
    }
  };

  const handleCustomInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.trim().length > 0) {
      const emoji = Array.from(val)[0];
      const existingReaction = reactions.find(r => r.userId === currentUserId) ?? null;
      const input: ToggleReactionInput = { emoji, existingReaction };
      try {
        await toggleReaction.mutateAsync(input);
        setShowPopover(false);
      } catch {
        // Error handled in hook
      } finally {
        if (customInputRef.current) {
          customInputRef.current.value = '';
          customInputRef.current.blur();
        }
      }
    }
  };

  const quickEmojis = ['👍', '❓', '🚀', '👀', '🎉', '👎'];
  const hasReactions = reactions.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
      {/* 0 Reactions Empty State: Desaturated smiley icon */}
      {!hasReactions ? (
        <button
          onClick={() => setShowPopover(prev => !prev)}
          className="reaction-btn-empty"
          aria-label="Add emoji reaction"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: 'none',
            borderRadius: '8px',
            width: '38px',
            height: '38px',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
            outline: 'none',
          }}
          title="Add reaction"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Smile size={16} />
        </button>
      ) : (
        /* Render active reaction pills */
        <>
          {Object.entries(groupedReactions).map(([emoji, reactors]) => {
            const hasReacted = reactors.some(r => r.userId === currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => handleToggleEmoji(emoji)}
                className={`reaction-pill ${hasReacted ? 'active' : ''}`}
                aria-label={`${reactors.length} reactions of ${emoji}. ${hasReacted ? 'You reacted.' : 'Click to react.'}`}
                style={{
                  background: hasReacted ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
                  border: hasReacted 
                    ? '1px solid rgba(96, 165, 250, 0.4)' 
                    : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0 10px',
                  height: '38px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: hasReacted ? 'var(--text-accent)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all var(--transition-fast)',
                  outline: 'none',
                  boxShadow: hasReacted ? 'var(--shadow-glow-blue)' : undefined,
                }}
                title={reactors.map(r => r.userName).join(', ')}
              >
                <span className="t-body-medium">{emoji}</span>
                <span className="t-mono-sm" style={{ fontWeight: 600 }}>{reactors.length}</span>
              </button>
            );
          })}
          
          {/* Reaction Add Pill */}
          <button
            onClick={() => setShowPopover(prev => !prev)}
            className="reaction-btn-add"
            aria-label="Add emoji reaction"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: 'none',
              borderRadius: '8px',
              width: '38px',
              height: '38px',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
              outline: 'none',
            }}
            title="Add reaction"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Plus size={16} />
          </button>
        </>
      )}

      {/* Floating Reaction Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="reaction-popover"
          style={{
            position: 'absolute',
            bottom: '125%',
            left: 0,
            zIndex: 40,
            background: 'var(--bg-overlay)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          {quickEmojis.map(emoji => {
            const reactors = groupedReactions[emoji] ?? [];
            const hasReacted = reactors.some(r => r.userId === currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => {
                  handleToggleEmoji(emoji);
                  setShowPopover(false);
                }}
                style={{
                  background: hasReacted ? 'rgba(255, 255, 255, 0.1)' : 'none',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  fontSize: '21px',
                  transition: 'transform var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {emoji}
              </button>
            );
          })}

          <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />

          {/* Circular Button for Native Emoji Keyboard Trigger */}
          <button
            onClick={() => {
              if (customInputRef.current) {
                customInputRef.current.focus();
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-default)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            aria-label="Custom emoji"
            title="Custom emoji"
          >
            <Plus size={14} />
          </button>

          {/* Hidden Input for Native Keyboard focus trigger */}
          <input
            ref={customInputRef}
            type="text"
            onChange={handleCustomInputChange}
            style={{
              position: 'absolute',
              opacity: 0,
              width: 0,
              height: 0,
              pointerEvents: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
