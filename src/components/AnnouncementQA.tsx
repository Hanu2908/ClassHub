import { useState, useRef, useEffect } from 'react';
import { Smile, Plus, Bell, BellOff, MessageSquare, Check, Trash2, ArrowDown, CornerDownRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { showToast } from './Toast';
import { BottomSheet } from './BottomSheet';
import { timeAgo } from './Shared';
import {
  useAnnouncementReactions,
  useAnnouncementComments,
  useAnnouncementMuteStatus,
  useToggleReaction,
  useAddComment,
  useDeleteComment,
  useToggleVerifyComment,
  useToggleThreadMute,
  useAnnouncementQARealtime,
  type QAReaction
} from '../hooks/useAnnouncementsQA';

// ─── 1. REACTIONS COMPONENT ───────────────────────────────────────────

interface AnnouncementReactionsProps {
  announcementId: string;
}

export function AnnouncementReactions({ announcementId }: AnnouncementReactionsProps) {
  const authUser = useAppStore(s => s.authUser);
  const currentUserId = authUser?.id;

  const { data: reactions = [] } = useAnnouncementReactions(announcementId);
  const toggleReaction = useToggleReaction(announcementId);
  useAnnouncementQARealtime(announcementId);

  const [showPopover, setShowPopover] = useState(false);
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [customInputVal, setCustomInputVal] = useState('');

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
        setIsCustomEditing(false);
        setCustomInputVal('');
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  // Focus custom input when editing begins
  useEffect(() => {
    if (isCustomEditing && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isCustomEditing]);

  const handleToggleEmoji = async (emoji: string) => {
    try {
      await toggleReaction.mutateAsync(emoji);
    } catch {
      // Toast handles error in hook
    }
  };

  const handleCustomInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInputVal(val);
    
    if (val.trim().length > 0) {
      const emoji = Array.from(val)[0]; // Safe Unicode grapheme extraction
      try {
        await toggleReaction.mutateAsync(emoji);
        setCustomInputVal('');
        setIsCustomEditing(false);
        setShowPopover(false);
      } catch {
        // Error handled in hook
      }
    }
  };

  const quickEmojis = ['👍', '❓', '🚀', '👀', '🎉', '👎'];
  const hasReactions = reactions.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
      {/* 0 Reactions Empty State: Desaturated smiley icon */}
      {!hasReactions ? (
        <button
          onClick={() => setShowPopover(prev => !prev)}
          className="reaction-btn-empty"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            opacity: 0.6,
            transition: 'all var(--transition-fast)',
            outline: 'none',
          }}
          aria-label="Add reaction"
          title="Add reaction"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          <Smile size={15} />
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
                style={{
                  background: hasReacted ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
                  border: hasReacted 
                    ? '1px solid rgba(96, 165, 250, 0.4)' 
                    : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px',
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
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
              outline: 'none',
            }}
            aria-label="Add reaction"
            title="Add reaction"
          >
            <Plus size={13} />
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
                  fontSize: '18px',
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

          {/* Custom Input */}
          {!isCustomEditing ? (
            <button
              onClick={() => setIsCustomEditing(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span>➕ Custom...</span>
            </button>
          ) : (
            <input
              ref={customInputRef}
              type="text"
              placeholder="Type emoji..."
              value={customInputVal}
              onChange={handleCustomInputChange}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                width: '100px',
                outline: 'none',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── 2. COMMENTS TRIGGER BUTTON ──────────────────────────────────────

interface AnnouncementCommentTriggerProps {
  announcementId: string;
  onOpenComments: () => void;
}

export function AnnouncementCommentTrigger({ announcementId, onOpenComments }: AnnouncementCommentTriggerProps) {
  const { data: comments = [] } = useAnnouncementComments(announcementId);
  useAnnouncementQARealtime(announcementId);

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

// ─── 3. COMMENTS DRAWER (BOTTOM SHEET) ────────────────────────────────

interface AnnouncementCommentsDrawerProps {
  announcementId: string;
  focusCommentId?: string | null;
  onClose: () => void;
}

export function AnnouncementCommentsDrawer({
  announcementId,
  focusCommentId,
  onClose
}: AnnouncementCommentsDrawerProps) {
  const authUser = useAppStore(s => s.authUser);
  const currentUserId = authUser?.id;
  const userRole = authUser?.role ?? 'student';

  const { data: comments = [], isLoading } = useAnnouncementComments(announcementId);
  const { data: isMuted = false } = useAnnouncementMuteStatus(announcementId);
  
  const addComment = useAddComment(announcementId);
  const deleteComment = useDeleteComment(announcementId);
  const toggleVerify = useToggleVerifyComment(announcementId);
  const toggleMute = useToggleThreadMute(announcementId);
  useAnnouncementQARealtime(announcementId);

  const [inputVal, setInputVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const verifiedComments = comments.filter(c => c.isVerified);
  const hasVerified = verifiedComments.length > 0;
  const [currentVerifiedJumpIndex, setCurrentVerifiedJumpIndex] = useState(0);

  // Auto-scroll to focused comment if provided by deep link
  useEffect(() => {
    if (focusCommentId && comments.length > 0) {
      const timer = setTimeout(() => {
        const el = commentRefs.current[focusCommentId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a subtle glowing ring effect temporarily
          el.style.outline = '2px solid var(--accent-primary)';
          el.style.outlineOffset = '2px';
          setTimeout(() => {
            el.style.outline = 'none';
          }, 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [focusCommentId, comments]);

  // Handle jump to verified cyclic focus
  const handleJumpToVerified = () => {
    if (verifiedComments.length === 0) return;
    const nextIdx = (currentVerifiedJumpIndex) % verifiedComments.length;
    const targetId = verifiedComments[nextIdx].id;
    const el = commentRefs.current[targetId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px dashed var(--status-safe)';
      el.style.outlineOffset = '2px';
      setTimeout(() => {
        el.style.outline = 'none';
      }, 2000);
    }
    setCurrentVerifiedJumpIndex(prev => prev + 1);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputVal.trim();
    if (!content) return;

    if (content.length > 500) {
      showToast('Comment is too long (max 500 chars)', 'error');
      return;
    }

    // 3-second throttle implementation
    const now = Date.now();
    if (now - lastSubmitTime < 3000) {
      showToast('Please wait a moment before sending another message', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment.mutateAsync(content);
      setInputVal('');
      setLastSubmitTime(now);
      
      // Scroll to bottom after post
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    } catch {
      // Handled in mutation hook
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reply binding: appends @author and focuses textarea
  const handleReplyClick = (authorName: string) => {
    const mention = `@${authorName.replace(/\s+/g, '')} `;
    setInputVal(prev => {
      if (prev.includes(mention)) return prev;
      return prev + mention;
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleMuteClick = async () => {
    try {
      await toggleMute.mutateAsync();
      showToast(isMuted ? 'Notifications unmuted for this thread' : 'Notifications muted for this thread', 'info');
    } catch {
      // Handled in mutation hook
    }
  };

  const handleVerifyClick = async (commentId: string, currentVerified: boolean) => {
    try {
      await toggleVerify.mutateAsync({ commentId, isVerified: !currentVerified });
    } catch {
      // Handled in mutation hook
    }
  };

  const handleDeleteClick = async (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteComment.mutateAsync(commentId);
      } catch {
        // Handled in mutation hook
      }
    }
  };

  // Render sheet title with mute bell beside it
  const sheetTitle = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={18} color="var(--accent-primary)" />
        <span style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)' }}>Q&A Comments ({comments.length})</span>
      </div>
      <button
        onClick={handleMuteClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: isMuted ? 'var(--status-critical)' : 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          borderRadius: '50%',
          transition: 'all var(--transition-fast)',
          outline: 'none',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        aria-label={isMuted ? 'Unmute thread notifications' : 'Mute thread notifications'}
        title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
      >
        {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
      </button>
    </div>
  );

  return (
    <BottomSheet onClose={onClose} title={sheetTitle}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '65vh', maxHeight: '550px', position: 'relative' }}>
        
        {/* 1. JUMP TO VERIFIED ELEVATOR BANNER */}
        {hasVerified && (
          <button
            onClick={handleJumpToVerified}
            className="verified-jump-banner"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'var(--status-safe-bg)',
              borderBottom: '1px solid rgba(52, 211, 153, 0.2)',
              color: 'var(--status-safe)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              outline: 'none',
              animation: 'pulseGlow 2s infinite alternate',
            }}
          >
            <span>💡 Verified Answer Available</span>
            <span style={{ textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 2 }}>
              [Jump to Answer {verifiedComments.length > 1 ? `(${currentVerifiedJumpIndex % verifiedComments.length + 1}/${verifiedComments.length})` : ''}]
              <ArrowDown size={12} />
            </span>
          </button>
        )}

        {/* 2. CHRONOLOGICAL PEER LIST */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 0',
            paddingTop: hasVerified ? '48px' : '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            scrollbarWidth: 'thin',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--text-secondary)' }}>
              <span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span className="t-body-medium">Loading conversation...</span>
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
              <MessageSquare size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
              <p className="t-card-title" style={{ fontSize: '14px', marginBottom: 4 }}>No questions or comments yet</p>
              <p className="t-body-medium" style={{ fontSize: '12px' }}>Be the first to start the academic Q&A!</p>
            </div>
          ) : (
            comments.map(comment => {
              const isCommentVerified = comment.isVerified;
              const isAuthorCR = comment.authorRole === 'cr';
              const isSelf = comment.authorId === currentUserId;
              
              // Verified Lockout rule: Student authors cannot delete/edit once comment is verified.
              // CRs can delete anything.
              const canDelete = userRole === 'cr' || (isSelf && !isCommentVerified);

              return (
                <div
                  key={comment.id}
                  ref={el => { commentRefs.current[comment.id] = el; }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isCommentVerified 
                      ? 'rgba(52, 211, 153, 0.04)' 
                      : (isAuthorCR ? 'rgba(167, 139, 250, 0.03)' : 'rgba(255, 255, 255, 0.02)'),
                    border: isCommentVerified 
                      ? '1px solid rgba(52, 211, 153, 0.25)' 
                      : (isAuthorCR ? '1px solid rgba(167, 139, 250, 0.15)' : '1px solid var(--border-default)'),
                    boxShadow: isCommentVerified ? 'var(--shadow-glow-green)' : undefined,
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}
                >
                  {/* Verified header badge */}
                  {isCommentVerified && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-safe)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <Check size={11} strokeWidth={3} />
                      <span>Verified Answer</span>
                    </div>
                  )}

                  {/* Header: Author + Roll + CR tag */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="t-body-medium" style={{ fontWeight: 600, color: isAuthorCR ? 'var(--status-announcement)' : 'var(--text-primary)', fontSize: '13px' }}>
                        {comment.authorName} {isSelf && '(You)'}
                      </span>
                      {comment.authorRoll && (
                        <span className="t-mono-sm" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: 4, fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {comment.authorRoll}
                        </span>
                      )}
                      {isAuthorCR && (
                        <span className="t-mono-sm" style={{ background: 'rgba(167, 139, 250, 0.15)', color: 'var(--status-announcement)', padding: '1px 5px', borderRadius: 4, fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                          CR
                        </span>
                      )}
                    </div>
                    <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>

                  {/* Comment Content */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p className="t-body" style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {comment.content.split(/(\s+)/).map((word, idx) => {
                        // Colorize @mentions beautifully
                        if (word.startsWith('@')) {
                          return <span key={idx} style={{ color: 'var(--text-accent)', fontWeight: 500 }}>{word}</span>;
                        }
                        return word;
                      })}
                    </p>

                    {/* Actions footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Reply Button */}
                        <button
                          onClick={() => handleReplyClick(comment.authorName)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 0,
                            outline: 'none',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        >
                          <CornerDownRight size={11} />
                          <span>Reply</span>
                        </button>

                        {/* CR verify toggle button */}
                        {userRole === 'cr' && (
                          <button
                            onClick={() => handleVerifyClick(comment.id, isCommentVerified)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: isCommentVerified ? 'var(--status-critical)' : 'var(--status-safe)',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: 0,
                              outline: 'none',
                            }}
                          >
                            <span>{isCommentVerified ? '✕ Unverify' : '✓ Verify Answer'}</span>
                          </button>
                        )}
                      </div>

                      {/* Trash Delete action */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteClick(comment.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(255, 68, 68, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 4,
                            borderRadius: '4px',
                            transition: 'all var(--transition-fast)',
                            outline: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--status-critical)';
                            e.currentTarget.style.background = 'rgba(255, 68, 68, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'rgba(255, 68, 68, 0.6)';
                            e.currentTarget.style.background = 'none';
                          }}
                          title={isCommentVerified ? 'Delete verified comment (CR Only)' : 'Delete comment'}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. INPUT BOX FORM WITH CONTROLS */}
        <form
          onSubmit={handlePostComment}
          style={{
            borderTop: '1px solid var(--border-default)',
            paddingTop: 12,
            background: 'var(--bg-overlay)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <textarea
              ref={textareaRef}
              rows={2}
              placeholder="Ask a question or provide an answer..."
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                paddingRight: '60px',
                fontSize: '13px',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'none',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary-muted)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            />
            
            {/* Inline word count / max characters */}
            <span
              className="t-mono-sm"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 12,
                fontSize: '9px',
                color: inputVal.length > 500 ? 'var(--status-critical)' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {inputVal.length}/500
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              💡 Use @Name to tag section members
            </p>
            <button
              type="submit"
              disabled={isSubmitting || !inputVal.trim() || inputVal.length > 500}
              className="t-button"
              style={{
                padding: '6px 16px',
                background: isSubmitting || !inputVal.trim() || inputVal.length > 500 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : 'var(--accent-primary)',
                color: isSubmitting || !inputVal.trim() || inputVal.length > 500 
                  ? 'var(--text-muted)' 
                  : '#000',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: isSubmitting || !inputVal.trim() || inputVal.length > 500 ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isSubmitting && <span className="spin" style={{ display: 'inline-block', width: 10, height: 10, border: '2.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />}
              <span>Post Comment</span>
            </button>
          </div>
        </form>

      </div>
    </BottomSheet>
  );
}
