import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Home, Calendar, BarChart2, User } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Home', icon: Home, path: '/app/home' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/app/schedule' },
  { id: 'polls', label: 'Polls', icon: BarChart2, path: '/app/polls' },
  { id: 'profile', label: 'Profile', icon: User, path: '/app/profile' },
] as const;

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveTab } = useAppStore();

  const active = TABS.find(t => location.pathname.startsWith(t.path))?.id ?? 'home';

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            className={`navbar-tab${isActive ? ' active' : ''}`}
            onClick={() => { setActiveTab(tab.id as any); navigate(tab.path); }}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && <div className="navbar-active-pill" />}
            <span className="nav-icon"><Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} /></span>
            {isActive && <span style={{ fontSize: 10, fontFamily: 'var(--font-body)' }}>{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
