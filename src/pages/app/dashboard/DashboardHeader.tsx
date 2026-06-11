import { Bell } from 'lucide-react';
import { pageHeaderStyle, iconButtonStyle, notificationBadgeStyle } from './dashboardUtils';

interface DashboardHeaderProps {
  firstName: string;
  unreadCount: number;
  onShowNotifications: () => void;
}

export default function DashboardHeader({
  firstName,
  unreadCount,
  onShowNotifications,
}: DashboardHeaderProps) {
  return (
    <header style={pageHeaderStyle}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p className="t-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
            ClassHub
          </p>
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
      </div>
    </header>
  );
}
