import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type AppNotification, useAppStore } from '../../../store/appStore';
import { useNotifications } from '../../../hooks/useNotifications';
import { BottomSheet } from '../../../components/BottomSheet';
import { timeAgo } from '../../../components/Shared';

interface NotificationSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationSheet({ open, onClose }: NotificationSheetProps) {
  const navigate = useNavigate();
  const authUser = useAppStore(s => s.authUser);
  const { notifications, markAllRead, clear, clearAll } = useNotifications();

  const visibleNotifications = notifications;

  useEffect(() => {
    if (open && notifications.some(n => !n.read)) {
      markAllRead();
    }
  }, [open, notifications, markAllRead]);

  // Deep-link: map target_table + target_id to a URL
  function getNotificationUrl(n: AppNotification): string | null {
    const id = n.target_id;
    const table = n.target_table ?? n.kind;
    if (!table) return null;
    if (table === 'polls') return id ? `/app/polls?highlight=${id}` : '/app/polls';
    if (table === 'assignments') return id ? `/app/assignments?highlight=${id}` : '/app/assignments';
    if (table === 'announcements') return id ? `/app/announcements?highlight=${id}` : '/app/announcements';
    if (table === 'timetable_slots') return '/app/schedule';
    if (table === 'counsellor_notes' || table === 'counsellor_remark' || table === 'counsellor_remark_reply') {
      return authUser?.role === 'teacher' ? '/app/counsellor' : '/app/home';
    }
    return null;
  }

  function handleNotificationClick(n: AppNotification) {
    const url = getNotificationUrl(n);
    if (url) {
      onClose();
      navigate(url);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Notifications">
      <div style={{ paddingBottom: 20 }}>
        {visibleNotifications.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)'
          }}>
            <Bell size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p className="t-body-medium" style={{ color: 'var(--text-secondary)' }}>No notifications yet</p>
          </div>
        ) : (
          <>
            <button
              onClick={() => clearAll(visibleNotifications.map(n => n.id))}
              className="t-label"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                padding: '0 0 12px',
                display: 'block',
                fontWeight: 600,
              }}
            >
              Clear all
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence mode="popLayout">
                {visibleNotifications.map((n, index) => {
                  const hasLink = !!getNotificationUrl(n);
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ x: 80, opacity: 0 }}
                      transition={{
                        layout: { type: 'spring', stiffness: 300, damping: 30 },
                        x: { delay: index * 0.025, duration: 0.15 },
                        opacity: { delay: index * 0.025, duration: 0.15 }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        background: n.read ? 'var(--bg-elevated)' : 'rgba(74,158,255,0.07)',
                        border: `1px solid ${n.read ? 'var(--border-default)' : 'rgba(74,158,255,0.2)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: hasLink ? 'pointer' : 'default',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {!n.read ? (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }} />
                      ) : null}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-subtitle" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</p>
                        <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
                        <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); clear(n.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
