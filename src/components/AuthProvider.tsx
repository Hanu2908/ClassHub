import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser } from '../store/appStore';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const SKIT_DOMAIN = '@skit.ac.in';

// ── Helper: fetch user profile from public.users ──
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role, section_id, section_roll, university_roll, day_scholar')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url ?? null,
    role: data.role as 'student' | 'cr',
    sectionId: data.section_id,
    sectionRoll: data.section_roll,
    universityRoll: data.university_roll,
    dayScholar: data.day_scholar,
  };
}

// ── Helper: extract basic info from Supabase auth user ──
function authUserToBasicProfile(authUser: SupabaseUser): AuthUser {
  const meta = authUser.user_metadata ?? {};
  return {
    id: authUser.id,
    name: meta.full_name ?? meta.name ?? authUser.email?.split('@')[0] ?? 'Student',
    email: authUser.email ?? '',
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    role: 'student',
    sectionId: null,
    sectionRoll: null,
    universityRoll: null,
    dayScholar: true,
  };
}

/**
 * AuthProvider — mounts exactly ONE Supabase auth listener and pushes
 * all state changes into the global Zustand store. Renders nothing.
 *
 * Place this inside <BrowserRouter> but outside <Routes>.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const store = useAppStore.getState();

    // ── Demo Mode Bootstrap ──
    if (localStorage.getItem('demo_mode') === 'true') {
      const persistedRole = store.role; // Preserved from Create/Join hub
      const demoUser: AuthUser = {
        id: 'demo-user',
        name: 'Demo Student',
        email: 'demo@skit.ac.in',
        avatarUrl: null,
        role: persistedRole,
        sectionId: localStorage.getItem('demo_section_id') || null,
        sectionRoll: null,
        universityRoll: null,
        dayScholar: true,
      };
      store.setAuthUser(demoUser);
      store.setSession({ user: { id: 'demo' } });
      store.setAuthLoading(false);
      return; // No Supabase listener needed in demo mode
    }

    // ── Live Mode Bootstrap ──
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (initialSession?.user) {
          // Domain check
          if (!initialSession.user.email?.endsWith(SKIT_DOMAIN)) {
            await supabase.auth.signOut();
            store.setAuthUser(null);
            store.setSession(null);
            store.setAuthLoading(false);
            navigate('/?error=domain');
            return;
          }

          store.setSession(initialSession);
          const profile = await fetchProfile(initialSession.user.id);
          if (profile) {
            store.setAuthUser(profile);
          } else {
            store.setAuthUser(authUserToBasicProfile(initialSession.user));
          }
        }
      } catch (err) {
        console.warn('Auth bootstrap failed:', err);
      }
      if (mounted) store.setAuthLoading(false);
    };

    bootstrap();

    // Auth state listener (single global instance)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && newSession?.user) {
          if (!newSession.user.email?.endsWith(SKIT_DOMAIN)) {
            await supabase.auth.signOut();
            store.setAuthUser(null);
            store.setSession(null);
            navigate('/?error=domain');
            return;
          }

          store.setSession(newSession);
          const profile = await fetchProfile(newSession.user.id);
          if (profile) {
            store.setAuthUser(profile);
          } else {
            store.setAuthUser(authUserToBasicProfile(newSession.user));
          }
        } else if (event === 'SIGNED_OUT') {
          store.setSession(null);
          store.setAuthUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <>{children}</>;
}

/**
 * signInWithGoogle — can be called from any component.
 * Triggers the OAuth flow; the onAuthStateChange listener above
 * will handle the rest.
 */
export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/onboarding/choice',
      queryParams: { hd: 'skit.ac.in' },
    },
  });
}

/**
 * signOutGlobal — clears demo mode, Supabase session, and zustand store.
 */
export async function signOutGlobal(navigate: (path: string) => void) {
  if (localStorage.getItem('demo_mode') === 'true') {
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_section_id');
  } else {
    await supabase.auth.signOut().catch(() => {});
  }
  useAppStore.getState().signOut();
  navigate('/');
}
