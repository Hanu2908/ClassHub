import { Bell, BarChart2 } from 'lucide-react';
import { pageHeaderStyle, iconButtonStyle, notificationBadgeStyle } from './dashboardUtils';

interface DashboardHeaderProps {
  firstName: string;
  unreadCount: number;
  onShowNotifications: () => void;
  onNavigateToPolls: () => void;
}

export default function DashboardHeader({
  firstName,
  unreadCount,
  onShowNotifications,
  onNavigateToPolls,
}: DashboardHeaderProps) {
  return (
    <header style={pageHeaderStyle}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
            ClassHub
          </p>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.04em' }}>
            BETA
          </span>
        </div>
        <h1 className="t-feature" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Hey, {firstName} 👋
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          id="notification-btn"
          aria-label="Notifications"
          onClick={onShowNotifications}
          style={iconButtonStyle}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={notificationBadgeStyle}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button id="polls-btn" aria-label="Polls" onClick={onNavigateToPolls} style={iconButtonStyle}>
          <BarChart2 size={20} />
        </button>
      </div>
    </header>
  );
}
