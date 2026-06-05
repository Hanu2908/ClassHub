import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { useAppStore, type BeforeInstallPromptEvent } from './store/appStore';
import { ToastContainer } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';

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
const GPACalculatorPage = lazy(() => import('./pages/app/GPACalculatorPage'));
const ResourceHubPage = lazy(() => import('./pages/app/ResourceHubPage'));
const DeveloperConsolePage = lazy(() => import('./pages/app/DeveloperConsolePage'));
const ExamsPage = lazy(() => import('./pages/app/ExamsPage'));
const ShareIntakePage = lazy(() => import('./pages/app/ShareIntakePage'));
const SectionDirectoryPage = lazy(() => import('./pages/app/SectionDirectoryPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

// ── Auth guard — requires authenticated user ──
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  
  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
  
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

// ── Developer guard — requires developer role ──
function RequireDeveloper({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (!authUser?.isDeveloper) {
    return <Navigate to="/app/home" replace />;
  }
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
  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
  
  // If user has active session OR we are in a persisted demo session, redirect to appropriate page
  const isDemo = authUser?.sectionId === 'demo-section';
  const isAuthenticated = !!session || isDemo;

  if (isAuthenticated && authUser?.sectionId) return <Navigate to="/app/home" replace />;
  if (isAuthenticated && !authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

function ShareIntakeRoute() {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const inboxId = new URLSearchParams(window.location.search).get('id');

  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
  if (!session && authUser?.sectionId !== 'demo-section') {
    if (inboxId) sessionStorage.setItem('classhub-pending-share-inbox-id', inboxId);
    return <Navigate to="/" replace />;
  }
  if (!authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  if (inboxId) sessionStorage.removeItem('classhub-pending-share-inbox-id');
  return <ErrorBoundary variant="page"><ShareIntakePage /></ErrorBoundary>;
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
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicRoute><SignIn /></PublicRoute>} />

            {/* Onboarding — needs auth but no hub yet */}
            <Route path="/onboarding/choice" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><ChoicePage /></ErrorBoundary></RequireNoHub></RequireAuth>} />
            <Route path="/onboarding/join" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><JoinHubPage /></ErrorBoundary></RequireNoHub></RequireAuth>} />
            <Route path="/onboarding/create" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><CreateHubPage /></ErrorBoundary></RequireNoHub></RequireAuth>} />

            {/* App shell — needs auth + hub */}
            <Route path="/app/home" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><DashboardPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/schedule" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><SchedulePage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/polls" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><PollsPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/profile" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><ProfilePage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/resource-hub" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><ResourceHubPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/announcements" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><AnnouncementsPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/assignments" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><AssignmentsPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/attendance" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><AttendancePage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/cr-command" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><CRCommandPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/cr/subjects" element={<RequireAuth><RequireHub><RequireDeveloper><ErrorBoundary variant="page"><ManageSubjectsPage /></ErrorBoundary></RequireDeveloper></RequireHub></RequireAuth>} />
            <Route path="/app/pdf-viewer" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><PDFViewerPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/exams" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><ExamsPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/gpa" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><GPACalculatorPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/app/dev-console" element={<RequireAuth><RequireHub><RequireDeveloper><ErrorBoundary variant="page"><DeveloperConsolePage /></ErrorBoundary></RequireDeveloper></RequireHub></RequireAuth>} />
            <Route path="/app/members" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><SectionDirectoryPage /></ErrorBoundary></RequireHub></RequireAuth>} />
            <Route path="/share-intake" element={<ShareIntakeRoute />} />
            <Route path="/legal" element={<LegalPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
