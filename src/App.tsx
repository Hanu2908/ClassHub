import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';
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

// Auth guard — requires Supabase session OR mock user in store
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore(s => s.user);
  // In demo mode: skip real auth check if user is in store
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Hub guard — requires hub to be configured
function RequireHub({ children }: { children: React.ReactNode }) {
  const hub = useAppStore(s => s.hub);
  if (!hub) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

// If already authenticated + has hub, skip login
function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore(s => s.user);
  const hub = useAppStore(s => s.hub);
  if (user && hub) return <Navigate to="/app/home" replace />;
  if (user && !hub) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

export default function App() {
  const { setUser, setSession } = useAppStore();

  useEffect(() => {
    // Listen for Supabase OAuth session — populates name + avatarUrl from Google
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        setUser({
          id: session.user.id,
          name: meta.full_name ?? meta.name ?? session.user.email?.split('@')[0] ?? 'Student',
          email: session.user.email ?? '',
          avatarUrl: meta.avatar_url ?? meta.picture ?? null,
        });
        setSession(session);
      }
    });
    return () => subscription.unsubscribe();
  }, [setUser, setSession]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public */}
        <Route path="/" element={<PublicRoute><SignIn /></PublicRoute>} />

        {/* Onboarding — needs auth but no hub */}
        <Route path="/onboarding/choice" element={<ChoicePage />} />
        <Route path="/onboarding/join" element={<JoinHubPage />} />
        <Route path="/onboarding/create" element={<CreateHubPage />} />

        {/* App shell — needs auth + hub */}
        <Route path="/app/home" element={<RequireAuth><RequireHub><DashboardPage /></RequireHub></RequireAuth>} />
        <Route path="/app/schedule" element={<RequireAuth><RequireHub><SchedulePage /></RequireHub></RequireAuth>} />
        <Route path="/app/polls" element={<RequireAuth><RequireHub><PollsPage /></RequireHub></RequireAuth>} />
        <Route path="/app/profile" element={<RequireAuth><RequireHub><ProfilePage /></RequireHub></RequireAuth>} />
        <Route path="/app/announcements" element={<RequireAuth><RequireHub><AnnouncementsPage /></RequireHub></RequireAuth>} />
        <Route path="/app/assignments" element={<RequireAuth><RequireHub><AssignmentsPage /></RequireHub></RequireAuth>} />
        <Route path="/app/attendance" element={<RequireAuth><RequireHub><AttendancePage /></RequireHub></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
