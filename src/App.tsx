import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { useAppStore } from './store/appStore';
import { ToastContainer } from './components/Toast';

// Pages
import SignIn from './pages/SignIn';
import ChoicePage from './pages/onboarding/ChoicePage';
import JoinHubPage from './pages/onboarding/JoinHubPage';
import CreateHubPage from './pages/onboarding/CreateHubPage';
import DashboardPage from './pages/app/DashboardPage';
import SchedulePage from './pages/app/SchedulePage';
import PollsPage from './pages/app/PollsPage';
import ProfilePage from './pages/app/ProfilePage';
import AnnouncementsPage from './pages/app/AnnouncementsPage';
import AssignmentsPage from './pages/app/AssignmentsPage';
import AttendancePage from './pages/app/AttendancePage';
import CRCommandPage from './pages/app/CRCommandPage';
import ManageSubjectsPage from './pages/app/ManageSubjectsPage';

// ── Auth guard — requires authenticated user ──
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  if (isAuthLoading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
    </div>
  );
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Hub guard — requires section to be set ──
function RequireHub({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (!authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

// ── Public route — skip login if already authed ──
function PublicRoute({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  // While auth is loading, show the sign-in page — don't block with blank screen
  if (isAuthLoading) return <>{children}</>;
  if (session && authUser?.sectionId) return <Navigate to="/app/home" replace />;
  if (session && !authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          {/* Public */}
          <Route path="/" element={<PublicRoute><SignIn /></PublicRoute>} />

          {/* Onboarding — needs auth but no hub yet */}
          <Route path="/onboarding/choice" element={<RequireAuth><ChoicePage /></RequireAuth>} />
          <Route path="/onboarding/join" element={<RequireAuth><JoinHubPage /></RequireAuth>} />
          <Route path="/onboarding/create" element={<RequireAuth><CreateHubPage /></RequireAuth>} />

          {/* App shell — needs auth + hub */}
          <Route path="/app/home" element={<RequireAuth><RequireHub><DashboardPage /></RequireHub></RequireAuth>} />
          <Route path="/app/schedule" element={<RequireAuth><RequireHub><SchedulePage /></RequireHub></RequireAuth>} />
          <Route path="/app/polls" element={<RequireAuth><RequireHub><PollsPage /></RequireHub></RequireAuth>} />
          <Route path="/app/profile" element={<RequireAuth><RequireHub><ProfilePage /></RequireHub></RequireAuth>} />
          <Route path="/app/announcements" element={<RequireAuth><RequireHub><AnnouncementsPage /></RequireHub></RequireAuth>} />
          <Route path="/app/assignments" element={<RequireAuth><RequireHub><AssignmentsPage /></RequireHub></RequireAuth>} />
          <Route path="/app/attendance" element={<RequireAuth><RequireHub><AttendancePage /></RequireHub></RequireAuth>} />
          <Route path="/app/cr-command" element={<RequireAuth><RequireHub><CRCommandPage /></RequireHub></RequireAuth>} />
          <Route path="/app/cr/subjects" element={<RequireAuth><RequireHub><ManageSubjectsPage /></RequireHub></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
