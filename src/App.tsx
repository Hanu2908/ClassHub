import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { useAppStore, type BeforeInstallPromptEvent } from './store/appStore';
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
const PDFViewerPage = lazy(() => import('./pages/app/PDFViewerPage'));
const ResourceHubPage = lazy(() => import('./pages/app/ResourceHubPage'));

// ── Auth guard — requires authenticated user ──
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  
  // Cache-first: render children immediately if valid session/user already in store, bypass spinner
  if (isAuthLoading && !(session && authUser)) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
    </div>
  );
  
  // Allow through if active session exists OR we are in a persisted demo session
  const isDemo = authUser?.sectionId === 'demo-section';
  const isAuthenticated = !!session || isDemo;

  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Hub guard — requires section to be set ──
function RequireHub({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (!authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

// ── No Hub guard — blocks already-onboarded users from onboarding routes ──
function RequireNoHub({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (authUser?.sectionId) {
    return <Navigate to="/app/home" replace />;
  }
  return <>{children}</>;
}

// ── Public route — skip login if already authed ──
function PublicRoute({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  
  // Cache-first: bypass spinner if session and authUser are already cached
  if (isAuthLoading && !(session && authUser)) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
    </div>
  );
  
  // If user has active session OR we are in a persisted demo session, redirect to appropriate page
  const isDemo = authUser?.sectionId === 'demo-section';
  const isAuthenticated = !!session || isDemo;

  if (isAuthenticated && authUser?.sectionId) return <Navigate to="/app/home" replace />;
  if (isAuthenticated && !authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const handler = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      useAppStore.getState().setDeferredPrompt(promptEvent);
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
            <Route path="/onboarding/choice" element={<RequireAuth><RequireNoHub><ChoicePage /></RequireNoHub></RequireAuth>} />
            <Route path="/onboarding/join" element={<RequireAuth><RequireNoHub><JoinHubPage /></RequireNoHub></RequireAuth>} />
            <Route path="/onboarding/create" element={<RequireAuth><RequireNoHub><CreateHubPage /></RequireNoHub></RequireAuth>} />

            {/* App shell — needs auth + hub */}
            <Route path="/app/home" element={<RequireAuth><RequireHub><DashboardPage /></RequireHub></RequireAuth>} />
            <Route path="/app/schedule" element={<RequireAuth><RequireHub><SchedulePage /></RequireHub></RequireAuth>} />
            <Route path="/app/polls" element={<RequireAuth><RequireHub><PollsPage /></RequireHub></RequireAuth>} />
            <Route path="/app/profile" element={<RequireAuth><RequireHub><ProfilePage /></RequireHub></RequireAuth>} />
            <Route path="/app/resource-hub" element={<RequireAuth><RequireHub><ResourceHubPage /></RequireHub></RequireAuth>} />
            <Route path="/app/announcements" element={<RequireAuth><RequireHub><AnnouncementsPage /></RequireHub></RequireAuth>} />
            <Route path="/app/assignments" element={<RequireAuth><RequireHub><AssignmentsPage /></RequireHub></RequireAuth>} />
            <Route path="/app/attendance" element={<RequireAuth><RequireHub><AttendancePage /></RequireHub></RequireAuth>} />
            <Route path="/app/cr-command" element={<RequireAuth><RequireHub><CRCommandPage /></RequireHub></RequireAuth>} />
            <Route path="/app/cr/subjects" element={<RequireAuth><RequireHub><ManageSubjectsPage /></RequireHub></RequireAuth>} />
            <Route path="/app/pdf-viewer" element={<RequireAuth><RequireHub><PDFViewerPage /></RequireHub></RequireAuth>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
