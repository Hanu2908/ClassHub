import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Home, Calendar, Megaphone, User, ShieldCheck, ClipboardCheck, Users } from 'lucide-react';

// When role=cr: replace Announcements tab with CR Command tab
const STUDENT_TABS = [
  { id: 'home',          label: 'Home',         icon: Home,          path: '/app/home' },
  { id: 'schedule',      label: 'Schedule',     icon: Calendar,      path: '/app/schedule' },
  { id: 'announcements', label: 'Notices',      icon: Megaphone,     path: '/app/announcements' },
  { id: 'attendance',    label: 'Attendance',   icon: ClipboardCheck, path: '/app/attendance' },
  { id: 'profile',       label: 'Profile',      icon: User,          path: '/app/profile' },
] as const;

const CR_TABS = [
  { id: 'home',       label: 'Home',       icon: Home,           path: '/app/home' },
  { id: 'schedule',   label: 'Schedule',   icon: Calendar,       path: '/app/schedule' },
  { id: 'cr-command', label: 'Command',    icon: ShieldCheck,    path: '/app/cr-command' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, path: '/app/attendance' },
  { id: 'profile',    label: 'Profile',    icon: User,           path: '/app/profile' },
] as const;

const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  '/app/home':              () => import('../pages/app/DashboardPage'),
  '/app/schedule':          () => import('../pages/app/SchedulePage'),
  '/app/announcements':     () => import('../pages/app/AnnouncementsPage'),
  '/app/cr-command':        () => import('../pages/app/CRCommandPage'),
  '/app/attendance':        () => import('../pages/app/AttendancePage'),
  '/app/profile':           () => import('../pages/app/ProfilePage'),
  '/app/teacher-dashboard': () => import('../pages/app/TeacherDashboardPage'),
  '/app/counsellor':        () => import('../pages/app/CounsellorConsolePage'),
};

function prefetchRoute(path: string) {
  PREFETCH_MAP[path]?.().catch(() => {});
}

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveTab, role, authUser } = useAppStore();

  let TABS: ReadonlyArray<{ id: string; label: string; icon: typeof Home; path: string }>;
  if (role === 'teacher') {
    const tabs = [
      { id: 'teacher-dashboard', label: 'Dashboard', icon: Home, path: '/app/teacher-dashboard' },
      { id: 'announcements', label: 'Notices', icon: Megaphone, path: '/app/announcements' },
    ];
    if (authUser?.isCounsellorForBatch) {
      tabs.push({ id: 'counsellor', label: 'Counsellor', icon: Users, path: '/app/counsellor' });
    }
    tabs.push(
      { id: 'profile', label: 'Profile', icon: User, path: '/app/profile' }
    );
    TABS = tabs;
  } else if (role === 'cr') {
    TABS = CR_TABS;
  } else {
    TABS = STUDENT_TABS;
  }

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
            onMouseEnter={() => prefetchRoute(tab.path)}
            onTouchStart={() => prefetchRoute(tab.path)}
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
