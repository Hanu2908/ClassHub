import React, { useState, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Megaphone, Award, Calendar, Coffee, Paperclip, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { deadlineBadgeClass, deadlineLabel, timeAgo } from '../../../components/Shared';
import { useAppStore, isExpired, type Announcement, type Attachment } from '../../../store/appStore';
import { useAnnouncements } from '../../../hooks/useSupabaseQuery';
import { useAcknowledge } from '../../../hooks/useSupabaseMutations';
import { showToast } from '../../../components/Toast';
import { AttachmentCard } from '../../../components/AttachmentCard';
import { AnnouncementReactions, AnnouncementCommentTrigger } from '../../../components/AnnouncementQA';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAnnouncementsData } from './prefetchHelper';
import { WidgetSkeleton } from './dashboardUtils';

// ── Secure Auto-Linkifier Engine ──
function linkify(text: string): React.ReactNode {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part) || part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

interface CategoryInfo {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

function getAnnouncementCategory(title: string, priority: 'critical' | 'general'): CategoryInfo {
  const t = (title || '').toLowerCase();
  
  if (priority === 'critical' || t.includes('urgent') || t.includes('attention') || t.includes('alert') || t.includes('important')) {
    return {
      name: 'Immediate Alert',
      icon: <AlertTriangle size={14} color="#f87171" />,
      color: '#f87171',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    };
  }
  
  if (t.includes('exam') || t.includes('test') || t.includes('quiz') || t.includes('midterm') || t.includes('practical') || t.includes('mst') || t.includes('assessment') || t.includes('viva')) {
    return {
      name: 'Academic Exam',
      icon: <Award size={14} color="#a78bfa" />,
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.08)',
      borderColor: 'rgba(167, 139, 250, 0.2)',
    };
  }
  
  if (t.includes('schedule') || t.includes('class') || t.includes('timing') || t.includes('timetable') || t.includes('slot') || t.includes('rescheduled') || t.includes('postponed')) {
    return {
      name: 'Schedule Change',
      icon: <Calendar size={14} color="#34d399" />,
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.08)',
      borderColor: 'rgba(52, 211, 153, 0.2)',
    };
  }
  
  if (t.includes('holiday') || t.includes('leave') || t.includes('cancel') || t.includes('closed') || t.includes('break') || t.includes('vacation')) {
    return {
      name: 'Campus Holiday',
      icon: <Coffee size={14} color="#fbbf24" />,
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: 'rgba(251, 191, 36, 0.2)',
    };
  }
  
  return {
    name: 'General Announcement',
    icon: <Megaphone size={14} color="#60a5fa" />,
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.15)',
  };
}

export default function AnnouncementsScroll() {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const navigate = useNavigate();
  const acknowledgeMutation = useAcknowledge();

  // Swipe mechanics states
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<(Announcement & { isAcknowledged: boolean }) | null>(null);

  const { data: announcements = [], isLoading } = useAnnouncements({ limit: 12 });
  const visible = useMemo(() => {
    return announcements
      .filter(a => !isExpired(a.deadline))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }, [announcements]);

  if (isLoading) return <WidgetSkeleton />;

  const safeActiveIndex = visible.length > 0 ? activeCardIndex % visible.length : 0;

  const handleDragStart = (clientX: number) => {
    setDragStart(clientX);
  };

  const handleDragMove = (clientX: number) => {
    if (dragStart === null) return;
    const offset = clientX - dragStart;
    setDragOffset(offset);
  };

  const handleDragEnd = () => {
    if (dragStart === null) return;
    if (dragOffset > 80) {
      setSwipeDirection('right');
      setTimeout(() => {
        setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
        setDragOffset(0);
        setSwipeDirection(null);
      }, 300);
    } else if (dragOffset < -80) {
      setSwipeDirection('left');
      setTimeout(() => {
        setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
        setDragOffset(0);
        setSwipeDirection(null);
      }, 300);
    } else {
      setDragOffset(0);
    }
    setDragStart(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
    } else if (e.key === 'ArrowRight') {
      setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
    }
  };

  const cardsToRender: { item: Announcement & { isAcknowledged: boolean }; relativeIndex: number }[] = [];
  if (visible.length > 0) {
    for (let i = 0; i < Math.min(visible.length, 3); i++) {
      const idx = (safeActiveIndex + i) % visible.length;
      cardsToRender.push({ item: visible[idx], relativeIndex: i });
    }
  }

  return (
    <section>
      <div className="section-header">
        <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Announcements
          {visible.some(ann => !ann.isAcknowledged) && <span className="pulse-unread-dot" title="New announcements waiting" />}
        </span>
        <button 
          className="section-link" 
          onClick={() => navigate('/app/announcements')}
          onMouseEnter={prefetchAnnouncements}
          onTouchStart={prefetchAnnouncements}
        >
          View all →
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={24} color="var(--text-secondary)" />
          </div>
          <div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>No news is good news</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>You're caught up on announcements.</p>
          </div>
        </div>
      ) : (
        <div style={{ overflow: 'hidden', padding: '10px 0 20px 0' }}>
          {/* Card Stack Area */}
          <div 
            className="announcement-stack-container"
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Announcement cards stack. Use left and right arrow keys to cycle."
            style={{ outline: 'none' }}
          >
            {cardsToRender.map(({ item, relativeIndex }) => {
              const ann = item;
              const isUnread = !ann.isAcknowledged;
              
              let cardStyle: CSSProperties;
              let layerClass: string;
              let dragListeners = {};

              if (relativeIndex === 0) {
                layerClass = 'announcement-layer-0';
                cardStyle = {
                  transform: `translate3d(${dragOffset}px, 0, 0) rotate(${dragOffset * 0.04}deg) scale(1)`,
                  cursor: dragStart !== null ? 'grabbing' : 'grab',
                };
                dragListeners = {
                  onTouchStart: (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX),
                  onTouchMove: (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX),
                  onTouchEnd: handleDragEnd,
                  onMouseDown: (e: React.MouseEvent) => handleDragStart(e.clientX),
                  onMouseMove: (e: React.MouseEvent) => {
                    if (dragStart !== null) handleDragMove(e.clientX);
                  },
                  onMouseUp: handleDragEnd,
                  onMouseLeave: handleDragEnd,
                };
              } else if (relativeIndex === 1) {
                layerClass = 'announcement-layer-1';
                cardStyle = {
                  transform: `translate3d(0, 8px, -12px) scale(${0.96 + Math.min(Math.abs(dragOffset) / 200, 0.04)})`,
                };
              } else {
                layerClass = 'announcement-layer-2';
                cardStyle = {
                  transform: `translate3d(0, 16px, -24px) scale(${0.92 + Math.min(Math.abs(dragOffset) / 200, 0.04)})`,
                };
              }

              return (
                <div
                  key={ann.id}
                  className={`announcement-card-layer ${layerClass} ${
                    relativeIndex === 0 && swipeDirection === 'left' ? 'announcement-swipe-left' : ''
                  } ${relativeIndex === 0 && swipeDirection === 'right' ? 'announcement-swipe-right' : ''}`}
                  style={cardStyle}
                  {...dragListeners}
                >
                  <div
                    onClick={() => {
                      if (relativeIndex === 0 && dragOffset === 0) {
                        setSelectedAnn(ann);
                      }
                    }}
                    role="button"
                    tabIndex={relativeIndex === 0 ? 0 : -1}
                    className={`card card-solid-charcoal ${ann.priority === 'critical' ? 'card-critical-solid' : 'card-general-solid'}`}
                    style={{ 
                      width: '100%', 
                      height: '148px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      padding: '16px',
                      textAlign: 'left',
                      position: 'relative',
                      borderWidth: '1px',
                      cursor: relativeIndex === 0 ? 'pointer' : 'default',
                      outline: 'none',
                    }}
                  >
                    {relativeIndex === 0 ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {(() => {
                                const category = getAnnouncementCategory(ann.title, ann.priority);
                                return (
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
                                    <span className="t-mono-sm" style={{ color: category.color, fontWeight: 600, fontSize: '10px' }}>
                                      {category.name}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {isUnread && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await acknowledgeMutation.mutateAsync(ann.id);
                                    showToast('Notice acknowledged successfully!', 'success');
                                  } catch {
                                    showToast('Failed to acknowledge notice', 'error');
                                  }
                                }}
                                style={{
                                  background: ann.priority === 'critical' 
                                    ? 'rgba(239, 68, 68, 0.12)' 
                                    : 'rgba(96, 165, 250, 0.12)',
                                  border: ann.priority === 'critical' 
                                    ? '1px solid rgba(239, 68, 68, 0.35)' 
                                    : '1px solid rgba(96, 165, 250, 0.35)',
                                  borderRadius: '50%',
                                  width: 36,
                                  height: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: ann.priority === 'critical' ? '#ef4444' : '#60a5fa',
                                  transition: 'all 0.2s',
                                  position: 'absolute',
                                  top: 10,
                                  right: 10,
                                  zIndex: 10,
                                }}
                                title="Quick Acknowledge"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            )}
                          </div>
                          <p className="t-button" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 600, lineHeight: 1.3 }}>
                            {ann.title}
                          </p>
                          {ann.body && (
                            <p className="t-body" style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                              marginTop: 4,
                              opacity: 0.85
                            }}>
                              {ann.body}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {ann.deadline ? (
                            <span className={`badge ${deadlineBadgeClass(ann.deadline)}`}>{deadlineLabel(ann.deadline)}</span>
                          ) : <span className="badge" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>No deadline</span>}

                          {ann.attachments && ann.attachments.length > 0 && (
                            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                              <Paperclip size={10} /> {ann.attachments.length}
                            </span>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chevrons and Dot Indicators */}
          {visible.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 4 }}>
              <button 
                onClick={() => {
                  setSwipeDirection('right');
                  setTimeout(() => {
                    setActiveCardIndex(prev => (prev === 0 ? visible.length - 1 : prev - 1));
                    setSwipeDirection(null);
                  }, 200);
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', outline: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                aria-label="Previous announcement"
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {visible.map((_, idx) => (
                  <span 
                    key={idx} 
                    style={{ 
                      width: idx === safeActiveIndex ? 16 : 6, 
                      height: 6, 
                      borderRadius: 3, 
                      background: idx === safeActiveIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)', 
                      transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' 
                    }} 
                  />
                ))}
              </div>

              <button 
                onClick={() => {
                  setSwipeDirection('left');
                  setTimeout(() => {
                    setActiveCardIndex(prev => (prev === visible.length - 1 ? 0 : prev + 1));
                    setSwipeDirection(null);
                  }, 200);
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', outline: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                aria-label="Next announcement"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet Drawer Overlay */}
      <div 
        className={`drawer-backdrop ${selectedAnn ? 'active' : ''}`} 
        onClick={() => setSelectedAnn(null)} 
      />
      <div className={`bottom-sheet-drawer ${selectedAnn ? 'active' : ''}`}>
        <div className="drawer-drag-handle" onClick={() => setSelectedAnn(null)} />
        
        {selectedAnn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Category and Title */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {(() => {
                  const category = getAnnouncementCategory(selectedAnn.title, selectedAnn.priority);
                  return (
                    <>
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
                        <span className="t-mono-sm" style={{ color: category.color, fontWeight: 600, fontSize: '10px' }}>
                          {category.name}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(selectedAnn.postedAt)}
                      </span>
                    </>
                  );
                })()}
              </div>
              <h2 className="t-card-title" style={{ fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.3, textAlign: 'left' }}>
                {selectedAnn.title}
              </h2>
            </div>

            {/* Rich Body Content */}
            <div className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '30vh', overflowY: 'auto', paddingRight: 4, textAlign: 'left' }}>
              {linkify(selectedAnn.body)}
            </div>

            {/* Deadline Badge */}
            {selectedAnn.deadline && (
              <div style={{ textAlign: 'left' }}>
                <span className="t-caption" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notice Deadline</span>
                <span className={`badge ${deadlineBadgeClass(selectedAnn.deadline)}`}>
                  {deadlineLabel(selectedAnn.deadline)}
                </span>
              </div>
            )}

            {/* Attachments Section */}
            {selectedAnn.attachments && selectedAnn.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                <span className="t-caption" style={{ color: 'var(--text-muted)' }}>Attachments ({selectedAnn.attachments.length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedAnn.attachments.map((att: Attachment) => (
                    <AttachmentCard key={att.id} attachment={att} />
                  ))}
                </div>
              </div>
            )}

            {/* Q&A & Emoji Reactions Footer */}
            <div style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              <AnnouncementReactions announcementId={selectedAnn.id} />
              
              <AnnouncementCommentTrigger 
                announcementId={selectedAnn.id} 
                onOpenComments={() => {
                  setSelectedAnn(null);
                  navigate(`/app/announcements?id=${selectedAnn.id}&expand_qa=true`);
                }} 
              />
            </div>

            {/* Action / Acknowledgment CTAs */}
            <div style={{ marginTop: 8 }}>
              {selectedAnn.isAcknowledged ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399' }}>
                  <CheckCircle2 size={18} />
                  <span className="t-mono-sm">Notice Acknowledged</span>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await acknowledgeMutation.mutateAsync(selectedAnn.id);
                      setSelectedAnn({ ...selectedAnn, isAcknowledged: true });
                      showToast('Notice acknowledged successfully!', 'success');
                    } catch {
                      showToast('Failed to acknowledge notice', 'error');
                    }
                  }}
                  disabled={acknowledgeMutation.isPending}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(74, 158, 255, 0.3)'
                  }}
                  className="zenith-cta-btn"
                >
                  {acknowledgeMutation.isPending ? 'Signing Off...' : 'Acknowledge Broadcast'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
