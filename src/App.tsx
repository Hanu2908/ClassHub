import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { useAppStore } from './store/appStore';
import { ToastContainer } from './components/Toast';

// Pages (Lazy Loaded for Code Splitting)
const SignIn = lazy(() => import('./pages/SignIn'));
const ChoicePage = lazy(() => import('./pages/onboarding/ChoicePage'));
const JoinHubPage = lazy(() => import('./pages/onboarding/JoinHubPage'));
const CreateHubPage = lazy(() => import('./pages/onboarding/CreateHubPage'));
const DashboardPage = lazy(() => import('./pages/app/DashboardPage'));
const SchedulePage = lazy(() => import('./pages/app/SchedulePage'));
const PollsPage = lazy(() => import('./pages/app/PollsPage'));
const ProfilePage = lazy(() => import('./pages/app/ProfilePage'));
const AnnouncementsPage = lazy(() => import('./pages/app/AnnouncementsPage'));
const AssignmentsPage = lazy(() => import('./pages/app/AssignmentsPage'));
const AttendancePage = lazy(() => import('./pages/app/AttendancePage'));
const CRCommandPage = lazy(() => import('./pages/app/CRCommandPage'));
const ManageSubjectsPage = lazy(() => import('./pages/app/ManageSubjectsPage'));

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
  
  // Show loading skeleton while checking auth to prevent flashing SignIn and breaking history
  if (isAuthLoading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
    </div>
  );
  
  if (session && authUser?.sectionId) return <Navigate to="/app/home" replace />;
  if (session && !authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      useAppStore.getState().setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <Suspense fallback={
          <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          </div>
        }>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
