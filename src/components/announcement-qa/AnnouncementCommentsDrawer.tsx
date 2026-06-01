import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, BellOff, Check, Trash2, CornerDownRight, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../Toast';
import { BottomSheet } from '../BottomSheet';
import { timeAgo } from '../Shared';
import {
  useAnnouncementComments,
  useAnnouncementMuteStatus,
  useAddComment,
  useDeleteComment,
  useEditComment,
  useToggleVerifyComment,
  useToggleThreadMute,
  useAnnouncementQARealtime
} from '../../hooks/useAnnouncementsQA';
import { useSectionMembers } from '../../hooks/useSectionMembers';

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
  const editComment = useEditComment(announcementId);
  const toggleVerify = useToggleVerifyComment(announcementId);
  const toggleMute = useToggleThreadMute(announcementId);
  useAnnouncementQARealtime(announcementId);

  const [inputVal, setInputVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  // Edit comment states
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editInputVal, setEditInputVal] = useState('');
  const [now] = useState(() => Date.now());

  const listRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autocomplete Mentions states
  const { data: sectionMembers = [] } = useSectionMembers();
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionFilterText, setMentionFilterText] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputVal(val);

    const selectionEnd = e.target.selectionEnd;
    const textBeforeCursor = val.slice(0, selectionEnd);
    
    // Look for the last "@" character before the cursor
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
      const hasWhitespace = /\s/.test(textAfterAt);
      const isPrecededBySpace = lastAtIdx === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIdx - 1));

      if (!hasWhitespace && isPrecededBySpace) {
        setShowMentionSuggestions(true);
        setMentionFilterText(textAfterAt);
        setMentionTriggerIndex(lastAtIdx);
        return;
      }
    }

    setShowMentionSuggestions(false);
    setMentionFilterText('');
    setMentionTriggerIndex(-1);
  };

  const handleSelectMention = (memberName: string) => {
    if (mentionTriggerIndex === -1 || !textareaRef.current) return;
    
    const val = inputVal;
    const selectionEnd = textareaRef.current.selectionEnd;
    
    const prefix = val.slice(0, mentionTriggerIndex);
    const suffix = val.slice(selectionEnd);
    
    const cleanName = memberName.replace(/\s+/g, '');
    const mentionString = `@${cleanName} `;
    
    const newVal = prefix + mentionString + suffix;
    setInputVal(newVal);
    
    setShowMentionSuggestions(false);
    setMentionFilterText('');
    setMentionTriggerIndex(-1);
    
    const newCursorPos = mentionTriggerIndex + mentionString.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  // Filter section members for mention suggestions
  const filteredMembers = useMemo(() => {
    if (!showMentionSuggestions) return [];
    const query = mentionFilterText.toLowerCase();
    return sectionMembers
      .filter(m => m.name.toLowerCase().includes(query) && m.id !== currentUserId)
      .slice(0, 5); // Limit suggestions to 5
  }, [showMentionSuggestions, mentionFilterText, sectionMembers, currentUserId]);

  // Scroll to focused comment or bottom on load
  useEffect(() => {
    if (!isLoading && comments.length > 0) {
      if (focusCommentId && commentRefs.current[focusCommentId]) {
        setTimeout(() => {
          commentRefs.current[focusCommentId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash effect
          const el = commentRefs.current[focusCommentId];
          if (el) {
            el.style.background = 'rgba(139, 92, 246, 0.15)';
            el.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            setTimeout(() => {
              el.style.background = 'var(--bg-elevated)';
              el.style.borderColor = 'var(--border-default)';
            }, 2000);
          }
        }, 300);
      } else {
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        }, 100);
      }
    }
  }, [isLoading, comments.length, focusCommentId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isSubmitting) return;

    // Rate-limiting: Max 1 comment per 3 seconds
    const now = Date.now();
    if (now - lastSubmitTime < 3000) {
      showToast('Please wait a moment before posting again.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment.mutateAsync(inputVal);
      setInputVal('');
      setLastSubmitTime(now);
      showToast('Comment posted ✓', 'success');
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    } catch {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      await toggleMute.mutateAsync();
      showToast(isMuted ? 'Thread unmuted.' : 'Thread muted.', 'info');
    } catch {
      // Error handled in hook
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteComment.mutateAsync(id);
      } catch {
        // Error handled in hook
      }
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editInputVal.trim() || editInputVal.length > 500 || editComment.isPending) return;

    try {
      await editComment.mutateAsync({ commentId, content: editInputVal });
      setEditingCommentId(null);
    } catch {
      // Error handled in hook
    }
  };

  const handleToggleVerify = async (commentId: string, currentStatus: boolean) => {
    try {
      await toggleVerify.mutateAsync({ commentId, isVerified: !currentStatus });
    } catch {
      // Error handled in hook
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Notice Q&A Thread">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '70vh', maxBlockSize: '650px', paddingBottom: 16 }}>
        
        {/* HEADER TOOLBAR: MUTE CONTROLS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Discuss or answer questions regarding this notice
          </span>
          
          <button
            onClick={handleToggleMute}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isMuted ? 'var(--status-critical)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '11px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {isMuted ? (
              <>
                <BellOff size={12} />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Bell size={12} />
                <span>Mute Thread</span>
              </>
            )}
          </button>
        </div>

        {/* 2. DISCUSSION LIST */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingRight: 4,
            scrollbarWidth: 'thin',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-muted)' }}>
              <span className="spin" style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 8 }} />
              <span className="t-mono-sm">Loading Q&A Thread...</span>
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p className="t-body-medium">No questions or comments yet.</p>
              <p className="t-caption" style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                Be the first to ask or clarify something!
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const isSelf = comment.authorId === currentUserId;
              const isAuthorCR = comment.authorRole === 'cr';
              const isCommentVerified = comment.isVerified;
              const canEdit = isSelf && !isCommentVerified && (now - new Date(comment.createdAt).getTime() <= 15 * 60 * 1000);
              
              return (
                <div
                  key={comment.id}
                  ref={el => { commentRefs.current[comment.id] = el; }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '12px 14px',
                    background: isCommentVerified ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-elevated)',
                    border: isCommentVerified 
                      ? '1px solid rgba(52, 211, 153, 0.25)' 
                      : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Replied UI Indicator */}
                  {isCommentVerified && (
                    <CornerDownRight 
                      size={14} 
                      color="var(--status-safe)" 
                      style={{ marginTop: 4, flexShrink: 0 }} 
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {timeAgo(comment.createdAt)}
                        </span>
                        {comment.editedAt && (
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10px', fontStyle: 'italic' }}>
                            • (Edited)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comment Content or Editor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editingCommentId === comment.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                          <textarea
                            autoFocus
                            rows={2}
                            value={editInputVal}
                            onChange={(e) => setEditInputVal(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              padding: '8px 10px',
                              fontSize: '13px',
                              lineHeight: 1.5,
                              outline: 'none',
                              resize: 'none',
                              fontFamily: 'var(--font-body)',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary-muted)')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              className="t-mono-sm"
                              style={{
                                fontSize: '9px',
                                color: editInputVal.length > 500 ? 'var(--status-critical)' : 'var(--text-muted)',
                                fontWeight: 600,
                              }}
                            >
                              {editInputVal.length}/500
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="t-button-secondary"
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '11px',
                                  height: 'auto',
                                  lineHeight: 'normal',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={editComment.isPending || !editInputVal.trim() || editInputVal.length > 500}
                                className="t-button"
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '11px',
                                  height: 'auto',
                                  lineHeight: 'normal',
                                  background: editComment.isPending || !editInputVal.trim() || editInputVal.length > 500 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'var(--accent-primary)',
                                  color: editComment.isPending || !editInputVal.trim() || editInputVal.length > 500 
                                    ? 'var(--text-muted)' 
                                    : '#000',
                                  cursor: editComment.isPending || !editInputVal.trim() || editInputVal.length > 500 ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {editComment.isPending ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="t-body" style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {comment.content.split(/(\s+)/).map((word, idx) => {
                            // Colorize @mentions beautifully
                            if (word.startsWith('@')) {
                              return <span key={idx} style={{ color: 'var(--text-accent)', fontWeight: 500 }}>{word}</span>;
                            }
                            return word;
                          })}
                        </p>
                      )}

                      {/* Controls Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        {/* CR Verify action */}
                        {userRole === 'cr' ? (
                          <button
                            onClick={() => handleToggleVerify(comment.id, isCommentVerified)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: isCommentVerified ? 'var(--text-muted)' : 'var(--status-safe)',
                              fontSize: '10px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              outline: 'none',
                              padding: 0
                            }}
                          >
                            <Check size={10} strokeWidth={3} />
                            <span>{isCommentVerified ? 'Unverify Answer' : 'Verify Answer'}</span>
                          </button>
                        ) : <div />}

                        {/* Right side actions (Edit and Delete) */}
                        {editingCommentId !== comment.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditInputVal(comment.content);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  transition: 'all var(--transition-fast)',
                                  outline: 'none',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--accent-primary)';
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                  e.currentTarget.style.background = 'none';
                                }}
                                title="Edit comment"
                              >
                                <Pencil size={12} />
                              </button>
                            )}

                            {/* Delete action (CR or Self) */}
                            {(userRole === 'cr' || isSelf) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'rgba(255, 68, 68, 0.6)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
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
                        )}
                      </div>
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
            position: 'relative',
            borderTop: '1px solid var(--border-default)',
            paddingTop: 12,
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {showMentionSuggestions && filteredMembers.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '8px',
                maxHeight: '180px',
                overflowY: 'auto',
                background: 'rgba(10, 11, 18, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-elevated)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                scrollbarWidth: 'thin',
              }}
            >
              {filteredMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectMention(member.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background var(--transition-fast)',
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {member.avatarUrl ? (
                      <img 
                        src={member.avatarUrl} 
                        alt={member.name} 
                        style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 600
                      }}>
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <span style={{ fontWeight: 500 }}>{member.name}</span>
                    {member.role === 'cr' && (
                      <span style={{
                        background: 'rgba(167, 139, 250, 0.15)',
                        color: 'var(--status-announcement)',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        fontSize: '8px',
                        fontWeight: 700,
                      }}>
                        CR
                      </span>
                    )}
                  </div>
                  {member.classRoll && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {member.classRoll}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', width: '100%' }}>
            <textarea
              ref={textareaRef}
              rows={2}
              placeholder="Ask a question or provide an answer..."
              value={inputVal}
              onChange={handleTextareaChange}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
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
