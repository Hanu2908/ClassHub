import { useAppStore } from '../store/appStore';

// ── Shared Helper: current user context ──────────────────────────────────────
// Centralized auth context hook used by all data-fetching hooks.
// Supports offline-first: treats a persisted authUser with sectionId as
// authenticated when the browser is offline and no active Supabase session
// exists.

export interface AuthContext {
  userId: string | null;
  sectionId: string | null;
  role: 'student' | 'cr' | 'teacher';
  isAuthLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthContext(): AuthContext {
  const authUser = useAppStore(s => s.authUser);
  const session = useAppStore(s => s.session);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const isDemo = authUser?.sectionId === 'demo-section';
  const isOfflineWithCache = !navigator.onLine && !!authUser?.sectionId;
  const isAuthenticated = !!session || isDemo || isOfflineWithCache;
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
    isAuthLoading,
    isAuthenticated,
  };
}
