import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Home, Calendar, BarChart2, User, ShieldCheck, ClipboardCheck } from 'lucide-react';

// When role=cr: replace Polls tab with CR Command tab
const STUDENT_TABS = [
  { id: 'home',       label: 'Home',       icon: Home,           path: '/app/home' },
  { id: 'schedule',   label: 'Schedule',   icon: Calendar,       path: '/app/schedule' },
  { id: 'polls',      label: 'Polls',      icon: BarChart2,      path: '/app/polls' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, path: '/app/attendance' },
  { id: 'profile',    label: 'Profile',    icon: User,           path: '/app/profile' },
] as const;

const CR_TABS = [
  { id: 'home',       label: 'Home',       icon: Home,           path: '/app/home' },
  { id: 'schedule',   label: 'Schedule',   icon: Calendar,       path: '/app/schedule' },
  { id: 'cr-command', label: 'Command',    icon: ShieldCheck,    path: '/app/cr-command' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, path: '/app/attendance' },
  { id: 'profile',    label: 'Profile',    icon: User,           path: '/app/profile' },
] as const;

type TabId = typeof STUDENT_TABS[number]['id'] | typeof CR_TABS[number]['id'];

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveTab, role } = useAppStore();

  const TABS = role === 'cr' ? CR_TABS : STUDENT_TABS;

  const active: TabId = (TABS.find(t => location.pathname.startsWith(t.path))?.id ?? 'home') as TabId;

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
            onClick={() => { setActiveTab(tab.id); navigate(tab.path); }}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && <div className="navbar-active-pill" />}
            <span className="nav-icon"><Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} /></span>
            {isActive && <span className="t-mono-sm">{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
