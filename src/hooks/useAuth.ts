import { useMemo } from 'react';
import { useAppStore, type AuthUser } from '../store/appStore';
import { signInWithGoogle as authSignInWithGoogle, signOutGlobal } from '../components/AuthProvider';
import type { Session } from '@supabase/supabase-js';

// Thin compatibility wrapper around centralized app store + AuthProvider
// Keeps existing callsites working while removing duplicate listeners.
export function useAuth() {
  const store = useAppStore();

  const isDemoMode = import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true';

  const session = useMemo(
    () => store.session ?? (isDemoMode ? ({ user: { id: 'demo' } } as Session) : null),
    [isDemoMode, store.session]
  );
  const user = useMemo(
    () => store.authUser ?? (isDemoMode ? ({
      id: 'demo-user',
      name: 'Demo Student',
      email: 'demo@skit.ac.in',
      avatarUrl: null,
      role: store.role,
      sectionId: localStorage.getItem('demo_section_id') || null,
      sectionRoll: null,
      universityRoll: null,
      dayScholar: true,
      notificationsEnabled: false,
      isDeveloper: false,
    } satisfies AuthUser) : null),
    [isDemoMode, store.authUser, store.role]
  );

  const api = useMemo(() => ({
    session,
    user,
    isLoading: store.isAuthLoading,
    isAuthenticated: !!session,
    signInWithGoogle: authSignInWithGoogle,
    signOut: async () => {
      if (isDemoMode) {
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('demo_section_id');
        useAppStore.getState().signOut();
        return;
      }
      await signOutGlobal((path) => { window.location.href = path; });
    },
    refreshProfile: () => useAppStore.getState().refreshProfile(),
  }), [isDemoMode, session, user, store.isAuthLoading]);

  return api;
}
