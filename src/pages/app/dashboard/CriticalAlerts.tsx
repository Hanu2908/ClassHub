import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight, X, Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type Announcement } from '../../../store/appStore';
import { isPushSupported, getPushPermission, subscribeToPush } from '../../../lib/pushNotifications';
import { showToast } from '../../../components/Toast';
import { prefetchAnnouncementsData } from './prefetchHelper';

interface CountdownTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        onExpire();
        return;
      }
      const h = Math.floor(diff / (3600 * 1000));
      const m = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const s = Math.floor((diff % (60 * 1000)) / 1000);

      if (h > 0) {
        setTimeLeft(`${h}h ${m}m ${s}s left`);
      } else if (m > 0) {
        setTimeLeft(`${m}m ${s}s left`);
      } else {
        setTimeLeft(`${s}s left`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 'var(--radius-pill)',
      background: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#ef4444',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '10px',
      fontWeight: 600,
    }}>
      <Clock size={11} className="animate-pulse" style={{ animation: 'pulse 1.5s infinite' }} />
      <span>{timeLeft}</span>
    </div>
  );
}

interface CriticalCarouselProps {
  items: Announcement[];
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
}

export function CriticalCarousel({ items, onDismiss, onAcknowledge }: CriticalCarouselProps) {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  const [prevItemsLength, setPrevItemsLength] = useState(items.length);
  if (items.length !== prevItemsLength) {
    setPrevItemsLength(items.length);
    if (activeIndex >= items.length) {
      setActiveIndex(Math.max(0, items.length - 1));
    }
  }

  if (items.length === 0) return null;

  const current = items[activeIndex];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleTimerExpire = () => {
    queryClient.invalidateQueries({ queryKey: ['announcements', sectionId, userId] });
  };

  return (
    <>
      <style>{`
        .critical-carousel-container {
          outline: none;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .critical-carousel-container:hover {
          transform: scale(1.005);
        }
        .critical-carousel-container:focus-visible {
          outline: 2px solid rgba(239, 68, 68, 0.5) !important;
          outline-offset: 2px;
        }
        .dismiss-banner-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.1);
        }
        .dismiss-banner-btn:active {
          transform: scale(0.9);
        }
        .dismiss-banner-btn:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.4) !important;
          outline-offset: 1px;
        }
        .btn-ack-banner {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-ack-banner:hover {
          background: rgba(52, 201, 123, 0.25) !important;
          border-color: rgba(52, 201, 123, 0.5) !important;
          transform: translateY(-1px);
        }
        .btn-ack-banner:active {
          transform: translateY(1px);
        }
        .btn-ack-banner:focus-visible {
          outline: 2px solid var(--status-safe) !important;
          outline-offset: 2px;
        }
        .carousel-nav-btn {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .carousel-nav-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.05);
        }
        .carousel-nav-btn:active {
          transform: scale(0.95);
        }
        .carousel-nav-btn:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.4) !important;
          outline-offset: 1px;
        }
        .carousel-dot {
          border: none;
          padding: 0;
          cursor: pointer;
          outline: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .carousel-dot:focus-visible {
          outline: 2px solid #ef4444 !important;
          outline-offset: 2px;
        }
        .push-cta-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(74, 158, 255, 0.35);
        }
        .push-cta-btn:active {
          transform: translateY(1px);
        }
      `}</style>

      <div
        className="critical-carousel-container"
        tabIndex={0}
        role="link"
        aria-label={`Urgent announcement: ${current.title}. Click to read all announcements.`}
        style={{
          position: 'relative',
          margin: '4px 8px 8px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(15, 17, 26, 0.95) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 8px rgba(239, 68, 68, 0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/app/announcements')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            navigate('/app/announcements');
          }
        }}
        onMouseEnter={prefetchAnnouncements}
        onTouchStart={prefetchAnnouncements}
      >
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: 12 }}>
          {/* Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={16} color="var(--status-critical)" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="truncate t-subtitle" style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 700, fontSize: '14.5px', letterSpacing: '-0.01em' }}>
                {current.title}
              </p>
            </div>

            {current.expiresAt && (
              <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <CountdownTimer expiresAt={current.expiresAt} onExpire={handleTimerExpire} />
              </div>
            )}
          </div>

          {/* Body content */}
          {current.body && (
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '12.5px',
              lineHeight: '1.5',
              margin: '0 0 2px',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0.9,
            }}>
              {current.body}
            </p>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge(current.id);
                }}
                onKeyDown={e => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  background: 'rgba(52, 201, 123, 0.15)',
                  border: '1px solid rgba(52, 201, 123, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--status-safe)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  outline: 'none',
                }}
                className="btn-ack-banner"
              >
                <span>Got it</span>
              </button>

              {items.length > 1 && (
                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                  {activeIndex + 1} of {items.length}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              {items.length > 1 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handlePrev}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                    }}
                    className="carousel-nav-btn"
                    aria-label="Previous Flash Post"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                    }}
                    className="carousel-nav-btn"
                    aria-label="Next Flash Post"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(current.id);
                }}
                style={{
                  background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', outline: 'none',
                  transition: 'all 0.2s',
                }}
                title="Dismiss for this session"
                aria-label="Dismiss this flash post"
                className="dismiss-banner-btn"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {items.length > 1 && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className="carousel-dot"
                  aria-label={`Go to slide ${idx + 1}`}
                  style={{
                    width: activeIndex === idx ? 12 : 5,
                    height: 5,
                    borderRadius: 'var(--radius-pill)',
                    background: activeIndex === idx ? '#ef4444' : 'rgba(255, 255, 255, 0.25)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface PushPermissionCTAProps {
  onDismiss: () => void;
}

export function PushPermissionCTA({ onDismiss }: PushPermissionCTAProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return isPushSupported() ? getPushPermission() : 'denied';
  });

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        setPermission('granted');
        showToast('Push notifications successfully enabled!', 'success');
        onDismiss();
      } else {
        showToast('Failed to enable push notifications', 'error');
        setPermission(isPushSupported() ? getPushPermission() : 'denied');
      }
    } catch (err) {
      console.error('[Push] CTA subscribe failed:', err);
      showToast('An error occurred while enabling push notifications', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div style={{
      margin: '12px 16px 4px',
      padding: '16px 20px',
      borderRadius: 'var(--radius-md)',
      background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.08) 0%, rgba(13, 15, 20, 0.75) 100%)',
      border: '1px solid rgba(74, 158, 255, 0.25)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25), 0 0 10px 0 rgba(74, 158, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'all 0.3s ease',
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        title="Dismiss CTA"
      >
        <X size={15} />
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(74, 158, 255, 0.15)',
          border: '1px solid rgba(74, 158, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary)',
          flexShrink: 0,
          marginTop: 2,
        }}>
          <Bell size={18} style={{ animation: 'pulse-bell 2.5s infinite ease-in-out' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="t-subtitle" style={{ color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Enable Push Notifications
          </h3>
          <p className="t-caption" style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
            {permission === 'denied'
              ? 'Real-time alerts are currently blocked. Please open your browser settings and allow notifications for ClassHub to get instant updates.'
              : 'Never miss an assignment deadline or critical CR announcement. Receive direct, secure nudge notifications in real-time!'}
          </p>
        </div>
      </div>

      {permission !== 'denied' && (
        <button
          onClick={handleEnablePush}
          disabled={isSubscribing}
          className="t-subtitle push-cta-btn"
          style={{
            alignSelf: 'stretch',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(74, 158, 255, 0.25)'
          }}
        >
          {isSubscribing ? 'Enabling...' : 'Turn on Notifications'}
        </button>
      )}
    </div>
  );
}

// ── Combined wrapper for DashboardPage ──
interface CriticalAlertsProps {
  items: Announcement[];
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
  showPushCTA: boolean;
  onDismissPushCTA: () => void;
}

export default function CriticalAlerts({
  items,
  onDismiss,
  onAcknowledge,
  showPushCTA,
  onDismissPushCTA,
}: CriticalAlertsProps) {
  return (
    <>
      {items.length > 0 && (
        <CriticalCarousel items={items} onDismiss={onDismiss} onAcknowledge={onAcknowledge} />
      )}
      {showPushCTA && <PushPermissionCTA onDismiss={onDismissPushCTA} />}
    </>
  );
}
