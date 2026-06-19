import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { useAppStore, type BeforeInstallPromptEvent } from './store/appStore';
import { Toaster, toast } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import { LazyMotion, domAnimation } from 'motion/react';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

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

const TeacherDashboardPage = lazy(() => import('./pages/app/TeacherDashboardPage'));
const CounsellorConsolePage = lazy(() => import('./pages/app/CounsellorConsolePage'));

// ── Auth guard — requires authenticated user ──
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  
  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
  
  // Allow through if active session exists, demo session, or offline with cached user
  const isDemo = import.meta.env.DEV && authUser?.sectionId === 'demo-section';
  const isOfflineWithCache = !navigator.onLine && !!authUser?.sectionId;
  const isAuthenticated = !!session || isDemo || isOfflineWithCache;

  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Hub guard — requires section to be set ──
function RequireHub({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (!authUser?.sectionId && authUser?.role !== 'teacher') return <Navigate to="/onboarding/choice" replace />;
  return <>{children}</>;
}

// ── Teacher guard — requires teacher role ──
function RequireTeacher({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (authUser?.role !== 'teacher') {
    return <Navigate to="/app/home" replace />;
  }
  return <>{children}</>;
}

// ── Student / CR guard — blocks teachers ──
function RequireStudentOrCR({ children }: { children: React.ReactNode }) {
  const authUser = useAppStore(s => s.authUser);
  if (authUser?.role === 'teacher') {
    return <Navigate to="/app/teacher-dashboard" replace />;
  }
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
  if (authUser?.role === 'teacher') {
    if (authUser?.sectionId) return <Navigate to="/app/teacher-dashboard" replace />;
  } else if (authUser?.sectionId) {
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
  
  // If user has active session, demo session, or offline with cached user, redirect to appropriate page
  const isDemo = import.meta.env.DEV && authUser?.sectionId === 'demo-section';
  const isOfflineWithCache = !navigator.onLine && !!authUser?.sectionId;
  const isAuthenticated = !!session || isDemo || isOfflineWithCache;

  if (isAuthenticated) {
    if (authUser?.role === 'teacher') {
      return <Navigate to={authUser?.sectionId ? "/app/teacher-dashboard" : "/onboarding/choice"} replace />;
    }
    if (authUser?.sectionId) {
      return <Navigate to="/app/home" replace />;
    }
    return <Navigate to="/onboarding/choice" replace />;
  }
  return <>{children}</>;
}

// ── Share intake route ──
function ShareIntakeRoute() {
  const session = useAppStore(s => s.session);
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const inboxId = new URLSearchParams(window.location.search).get('id');

  if (isAuthLoading && !(session && authUser)) return <PageSkeleton />;
  const isOfflineWithCache = !navigator.onLine && !!authUser?.sectionId;
  const isDemoBypass = import.meta.env.DEV && authUser?.sectionId === 'demo-section';
  if (!session && !isDemoBypass && !isOfflineWithCache) {
    if (inboxId) localStorage.setItem('classhub-pending-share-inbox-id', inboxId);
    return <Navigate to="/" replace />;
  }
  if (!authUser?.sectionId) return <Navigate to="/onboarding/choice" replace />;
  if (inboxId) localStorage.removeItem('classhub-pending-share-inbox-id');
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

  useEffect(() => {
    // 1. Handle post-update success feedback
    if (sessionStorage.getItem('classhub_just_updated') === 'true') {
      sessionStorage.removeItem('classhub_just_updated');
      const timer = setTimeout(() => {
        toast.success('ClassHub updated successfully! ✓', {
          description: 'You are running the latest version with new features.'
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // 2. Handle mid-session update prompt
    const handleUpdateAvailable = () => {
      toast.info('New features are ready!', {
        description: 'Tap update to apply the latest changes.',
        action: {
          label: 'Update',
          onClick: () => {
            if (typeof (window as any).triggerPwaUpdateReload === 'function') {
              (window as any).triggerPwaUpdateReload();
            } else {
              window.location.reload();
            }
          }
        },
        duration: Infinity, // Keep open until user interacts
      });
    };

    window.addEventListener('classhub-pwa-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('classhub-pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <LazyMotion features={domAnimation}>
          <Toaster
            position="top-center"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: '#121520',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                width: 'calc(100% - 32px)',
                maxWidth: '448px',
                margin: '0 auto',
              },
            }}
            offset={80}
          />
          <SkeletonTheme baseColor="#121520" highlightColor="rgba(255, 255, 255, 0.05)">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<PublicRoute><SignIn /></PublicRoute>} />

                {/* Onboarding — needs auth but no hub yet */}
                <Route path="/onboarding/choice" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><ChoicePage /></ErrorBoundary></RequireNoHub></RequireAuth>} />
                <Route path="/onboarding/join" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><JoinHubPage /></ErrorBoundary></RequireNoHub></RequireAuth>} />
                <Route path="/onboarding/create" element={<RequireAuth><RequireNoHub><ErrorBoundary variant="page"><CreateHubPage /></ErrorBoundary></RequireNoHub></RequireAuth>} />

                {/* App shell — needs auth + hub */}
                <Route path="/app/home" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><DashboardPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/schedule" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><SchedulePage /></ErrorBoundary></RequireHub></RequireAuth>} />
                <Route path="/app/polls" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><PollsPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/profile" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><ProfilePage /></ErrorBoundary></RequireHub></RequireAuth>} />
                <Route path="/app/resource-hub" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><ResourceHubPage /></ErrorBoundary></RequireHub></RequireAuth>} />
                <Route path="/app/announcements" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><AnnouncementsPage /></ErrorBoundary></RequireHub></RequireAuth>} />
                <Route path="/app/assignments" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><AssignmentsPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/attendance" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><AttendancePage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/cr-command" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><CRCommandPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/cr/subjects" element={<RequireAuth><RequireHub><RequireStudentOrCR><RequireDeveloper><ErrorBoundary variant="page"><ManageSubjectsPage /></ErrorBoundary></RequireDeveloper></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/pdf-viewer" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><PDFViewerPage /></ErrorBoundary></RequireHub></RequireAuth>} />
                <Route path="/app/exams" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><ExamsPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/gpa" element={<RequireAuth><RequireHub><RequireStudentOrCR><ErrorBoundary variant="page"><GPACalculatorPage /></ErrorBoundary></RequireStudentOrCR></RequireHub></RequireAuth>} />
                <Route path="/app/dev-console" element={<RequireAuth><RequireHub><RequireDeveloper><ErrorBoundary variant="page"><DeveloperConsolePage /></ErrorBoundary></RequireDeveloper></RequireHub></RequireAuth>} />
                <Route path="/app/members" element={<RequireAuth><RequireHub><ErrorBoundary variant="page"><SectionDirectoryPage /></ErrorBoundary></RequireHub></RequireAuth>} />
                 
                {/* Teacher shell — needs auth + hub + teacher */}
                <Route path="/app/teacher-dashboard" element={<RequireAuth><RequireHub><RequireTeacher><ErrorBoundary variant="page"><TeacherDashboardPage /></ErrorBoundary></RequireTeacher></RequireHub></RequireAuth>} />
                <Route path="/app/counsellor" element={<RequireAuth><RequireHub><RequireTeacher><ErrorBoundary variant="page"><CounsellorConsolePage /></ErrorBoundary></RequireTeacher></RequireHub></RequireAuth>} />
                 
                <Route path="/share-intake" element={<ShareIntakeRoute />} />
                <Route path="/legal" element={<LegalPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SkeletonTheme>
        </LazyMotion>
      </AuthProvider>
    </BrowserRouter>
  );
}
