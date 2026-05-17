import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser } from '../store/appStore';
import { queryClient } from '../lib/queryClient';
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

// ── Shared helper: handle a valid session ──
async function handleSession(
  user: SupabaseUser,
  session: any,
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
  const profile = await fetchProfile(user.id);
  if (profile) {
    store.setAuthUser(profile);
  } else {
    store.setAuthUser(authUserToBasicProfile(user));
  }
  store.setAuthLoading(false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Module-level auth listener — runs ONCE regardless of React StrictMode.
// This avoids the double-mount problem where the SIGNED_IN event gets consumed
// during Mount 1's subscription (which is cleaned up) and never reaches Mount 2.
// ──────────────────────────────────────────────────────────────────────────────

let _navigateFn: ((path: string) => void) | null = null;
let _authInitialized = false;

function initAuth() {
  if (_authInitialized) return;
  _authInitialized = true;

  const store = useAppStore.getState();

  // Single auth listener — handles ALL auth events including the initial session.
  // Supabase fires INITIAL_SESSION immediately when onAuthStateChange is called,
  // so we do NOT need a separate getSession() bootstrap call.
  supabase.auth.onAuthStateChange(async (event, session) => {
    // Only log auth events during development
    // Keeps production consoles quiet and avoids leaking emails
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) {
      console.log('[Auth]', event, session?.user?.email ?? 'no-user');
    }

    if (
      (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') &&
      session?.user
    ) {
      await handleSession(session.user, session, _navigateFn ?? undefined);
    } else if (event === 'INITIAL_SESSION' && !session) {
      // No existing session — user needs to sign in
      store.setAuthLoading(false);
    } else if (event === 'SIGNED_OUT') {
      store.setSession(null);
      store.setAuthUser(null);
      store.setAuthLoading(false);
      queryClient.clear();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      store.setSession(session);
    }
  });
}

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
    _navigateFn = navigate;
    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      queryParams: { 
        hd: 'skit.ac.in',
        prompt: 'select_account' 
      },
    },
  });
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

