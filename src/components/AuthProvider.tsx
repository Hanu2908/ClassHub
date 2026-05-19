/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser } from '../store/appStore';
import { queryClient } from '../lib/queryClient';
import { showToast } from '../components/Toast';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

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

// ── Shared helper: handle a valid session ──
async function handleSession(
  user: SupabaseUser,
  session: Session,
  navigateFn?: (path: string) => void,
): Promise<void> {
  const store = useAppStore.getState();

  // Domain check
  if (!user.email?.endsWith(SKIT_DOMAIN)) {
    await supabase.auth.signOut();
    store.setAuthUser(null);
    store.setSession(null);
    store.setAuthLoading(false);
    navigateFn?.('/?error=domain');
    return;
  }

  store.setSession(session);
  // Try to fetch the backend profile; retry a few times in case of eventual consistency
  let profile = await fetchProfile(user.id);
  if (!profile) {
    // Retry with a short backoff — helpful when account row was just created elsewhere
    for (let attempt = 0; attempt < 3 && !profile; attempt++) {
      // 200ms, 400ms, 600ms
       
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
       
      profile = await fetchProfile(user.id);
    }
  }

  if (profile) {
    store.setAuthUser(profile);
  } else {
    // Log a warning so debugging on mobile/other devices is easier
    if (import.meta.env.DEV) {
      console.warn('[Auth] no backend profile found for user', user.id);
    }
    
    // Check if the user was in demo mode from persistence
    const existing = store.authUser;
    if (existing?.sectionId === 'demo-section') {
      store.setAuthUser(existing);
    } else {
      // Surface a lightweight diagnostic to the user so mobile issues are visible
      try {
        showToast('Signed in but profile not found — loading basic profile. If this persists, refresh or contact support.', 'warning');
      } catch {
        // ignore if toast system is not yet mounted
      }
      store.setAuthUser(authUserToBasicProfile(user));
    }
  }

  store.setAuthLoading(false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Module-level auth listener — runs ONCE regardless of React StrictMode.
// This avoids the double-mount problem where the SIGNED_IN event gets consumed
// during Mount 1's subscription (which is cleaned up) and never reaches Mount 2.
// ──────────────────────────────────────────────────────────────────────────────

let _navigateFn: ((path: string) => void) | null = null;

/**
 * AuthProvider — initializes the module-level auth listener on first render
 * and keeps the navigate function reference up to date.
 *
 * Place this inside <BrowserRouter> but outside <Routes>.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // Keep navigate reference fresh for the module-level listener
  useEffect(() => {
    _navigateFn = navigate;
  }, [navigate]);

  // Initialize auth exactly once
  useEffect(() => {
    const store = useAppStore.getState();
    let mounted = true;

    // Safety net: if auth takes too long, stop loading so user isn't stuck on blank screen
    const safetyTimeout = setTimeout(() => {
      if (mounted && store.isAuthLoading) {
        if (import.meta.env.DEV) {
          console.warn('[Auth] Safety timeout — stopping loading spinner after 5s');
        }
        store.setAuthLoading(false);
      }
    }, 5000);

    async function getInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !session) {
          store.setAuthLoading(false);
        } else {
          // Set session IMMEDIATELY so route guards don't redirect to login
          store.setSession(session);
          await handleSession(session.user, session, _navigateFn ?? undefined);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[Auth] getInitialSession failed:', err);
        }
        if (mounted) {
          store.setAuthLoading(false);
        }
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore INITIAL_SESSION because we handled it above explicitly to avoid strict-mode bugs
      if (event === 'INITIAL_SESSION') return;
      
      if (import.meta.env.DEV) {
        console.log('[Auth]', event, session?.user?.email ?? 'no-user');
      }

      if (event === 'SIGNED_IN' && session?.user) {
        await handleSession(session.user, session, _navigateFn ?? undefined);
      } else if (event === 'SIGNED_OUT') {
        store.setSession(null);
        store.setAuthUser(null);
        store.setAuthLoading(false);
        queryClient.clear();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        store.setSession(session);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

/**
 * signInWithGoogle — can be called from any component.
 * Triggers the OAuth flow; the onAuthStateChange listener above
 * will handle the rest.
 */
export async function signInWithGoogle() {
  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/onboarding/choice',
        queryParams: {
          hd: 'skit.ac.in',
        },
      },
    });

    // Supabase may return an error object when the OAuth request fails.
    // Log it so users/developers can see the server response in the console.
    if (result.error) {
       
      console.error('[Auth] signInWithOAuth error:', result.error);
      // Re-throw to allow callers (UI) to surface the error if needed
      throw result.error;
    }

    return result;
  } catch (err) {
     
    console.error('[Auth] signInWithGoogle failed', err);
    throw err;
  }
}

/**
 * signOutGlobal — clears Supabase session and zustand store.
 */
export async function signOutGlobal(navigate: (path: string) => void) {
  await supabase.auth.signOut().catch(() => {});
  useAppStore.getState().signOut();
  queryClient.clear();
  navigate('/');
}

