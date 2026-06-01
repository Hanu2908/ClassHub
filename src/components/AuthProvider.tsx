/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser } from '../store/appStore';
import { queryClient } from '../lib/queryClient';
import { showToast } from '../components/Toast';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { ensurePushSubscription } from '../lib/pushNotifications';
import { saveSession, clearSession, playbackOfflineActionsClient } from '../lib/offlineSync';
import InstallPwaBanner from './InstallPwaBanner';
import OfflineSyncPill from './OfflineSyncPill';
import { subscribeToSection } from '../lib/realtimeBroker';

const SKIT_DOMAIN = '@skit.ac.in';

// ── Helper: fetch user profile from public.users ──
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role, cr_rank, section_id, section_roll, university_roll, day_scholar, notifications_enabled, is_developer')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] fetchProfile error:', error);
    return null;
  }

  if (!data) {
    console.warn('[Auth] fetchProfile: no profile row returned for user:', userId);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url ?? null,
    role: data.role as 'student' | 'cr',
    crRank: (data as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
    sectionId: data.section_id,
    sectionRoll: data.section_roll,
    universityRoll: data.university_roll,
    dayScholar: data.day_scholar,
    notificationsEnabled: data.notifications_enabled,
    isDeveloper: data.is_developer ?? false,
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
    crRank: null,
    sectionId: null,
    sectionRoll: null,
    universityRoll: null,
    dayScholar: true,
    notificationsEnabled: false,
    isDeveloper: false,
  };
}

// ── Shared helper: handle a valid session ──
async function handleSession(
  user: SupabaseUser,
  session: Session,
  navigateFn?: (path: string) => void,
): Promise<void> {
  const store = useAppStore.getState();

  // Clean the auth hash from the URL if present to prevent parsing deadlock on refresh
  if (window.location.hash.includes('access_token=')) {
    if (import.meta.env.DEV) {
      console.log('[Auth] Cleaning auth access_token hash from URL to prevent refresh deadlocks.');
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

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
  saveSession(session.access_token, user.id);
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
    
    // If the user has a valid cached profile with the same ID, preserve it (prevents network/latency logout loop)
    const existing = store.authUser;
    if (existing && existing.id === user.id) {
      store.setAuthUser(existing);
    } else if (existing?.sectionId === 'demo-section') {
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
          console.warn('[Auth] Safety timeout — stopping loading spinner after 15s');
        }
        store.setAuthLoading(false);
      }
    }, 15000);

    async function getInitialSession() {
      // If there is an auth hash in the URL, let onAuthStateChange handle the event cleanly to avoid Supabase client deadlock
      const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
      if (hasAuthHash) {
        if (import.meta.env.DEV) {
          console.log('[Auth] Auth hash detected in URL. Skipping getInitialSession to let onAuthStateChange handle token recovery.');
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !session) {
          if (error) {
            console.error('[Auth] Error fetching initial session:', error);
          }
          // If no active session, clear the stale persisted user profile so they aren't stuck with guard-bypassed null session
          const store = useAppStore.getState();
          if (store.authUser?.sectionId !== 'demo-section') {
            if (import.meta.env.DEV) {
              console.log('[Auth] No active session found. Clearing cached authUser to prevent guard bypass.');
            }
            store.setAuthUser(null);
            store.setSession(null);
          }
          store.setAuthLoading(false);
        } else {
          const store = useAppStore.getState();
          // Prevent duplicate invocation if onAuthStateChange already handled it
          if (store.session?.user?.id === session.user.id) {
            if (import.meta.env.DEV) {
              console.log('[Auth] getInitialSession: Skipping duplicate session handling.');
            }
            return;
          }
          // Set session IMMEDIATELY so route guards don't redirect to login
          store.setSession(session);
          saveSession(session.access_token, session.user.id);
          setTimeout(() => {
            handleSession(session.user, session, _navigateFn ?? undefined).catch(err => {
              console.error('[Auth] Error inside async getInitialSession handleSession background task:', err);
            });
          }, 0);
        }
      } catch (err) {
        console.error('[Auth] getInitialSession failed with critical exception:', err);
        // Clear cached authUser on critical exception to be safe
        const store = useAppStore.getState();
        if (store.authUser?.sectionId !== 'demo-section') {
          store.setAuthUser(null);
          store.setSession(null);
        }
        if (mounted) {
          store.setAuthLoading(false);
        }
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore INITIAL_SESSION because we handled it above explicitly to avoid strict-mode bugs
      if (event === 'INITIAL_SESSION') return;
      
      if (import.meta.env.DEV) {
        console.log('[Auth] AuthStateChange Event:', event, session?.user?.email ?? 'no-user');
      }

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          const currentStore = useAppStore.getState();
          if (currentStore.session?.user?.id === session.user.id) {
            if (import.meta.env.DEV) {
              console.log('[Auth] Skipping duplicate SIGNED_IN event for user:', session.user.id);
            }
            return;
          }
          
          // Decouple to avoid deadlocking the Supabase client's auth state listener
          setTimeout(() => {
            handleSession(session!.user, session!, _navigateFn ?? undefined).catch(err => {
              console.error('[Auth] Error inside async handleSession background task:', err);
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          store.setSession(null);
          store.setAuthUser(null);
          store.setAuthLoading(false);
          queryClient.clear();
          clearSession();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          store.setSession(session);
          saveSession(session.access_token, session.user.id);
        }
      } catch (err) {
        console.error('[Auth] Error in onAuthStateChange callback for event:', event, err);
        store.setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // ── Supabase Realtime Subscriptions ──
  const sectionId = useAppStore(s => s.authUser?.sectionId);

  useEffect(() => {
    if (!sectionId) return;

    const unsubscribe = subscribeToSection(sectionId, {
      onAnnouncement: () => queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] }),
      onAssignment: () => queryClient.invalidateQueries({ queryKey: ['assignments', sectionId] }),
      onPoll: () => queryClient.invalidateQueries({ queryKey: ['polls', sectionId] }),
      onVote: () => queryClient.invalidateQueries({ queryKey: ['polls', sectionId] }),
      onSubmission: () => queryClient.invalidateQueries({ queryKey: ['submissions'] }),
      onAcknowledgment: () => queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] }),
    });

    return unsubscribe;
  }, [sectionId]);

  // ── Push Notification Subscriptions Self-Heal ──
  const authUser = useAppStore(s => s.authUser);
  const authUserId = authUser?.id;

  useEffect(() => {
    if (!authUserId) return;
    if (import.meta.env.PROD) {
      ensurePushSubscription().catch((err) => {
        console.warn('[Push] ensurePushSubscription on auth ready failed:', err);
      });
    }
  }, [authUserId]);

  // Listen for online/offline event transitions and manage Zustand syncStatus
  useEffect(() => {
    const store = useAppStore.getState();

    // Set initial status based on current browser environment
    store.setSyncStatus(navigator.onLine ? 'online' : 'offline');

    const triggerClientPlayback = () => {
      store.setSyncStatus('syncing');
      playbackOfflineActionsClient()
        .then(() => {
          store.setSyncStatus('synced');
          showToast('Offline actions synchronized successfully.', 'success');
          // Smoothly reset back to online state after showing success confirmation
          setTimeout(() => {
            if (useAppStore.getState().syncStatus === 'synced') {
              useAppStore.getState().setSyncStatus('online');
            }
          }, 3000);
        })
        .catch((err) => {
          console.error('[OfflineSync] Client sync playback failed:', err);
          store.setSyncStatus('online'); // Reset back to standard online to avoid stuck pill
        });
    };

    const handleOnline = () => {
      showToast('Connection restored. Syncing offline changes...', 'info');
      triggerClientPlayback();

      // Notify Service Worker to run sync if supported
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_ACTIONS' });
      }
    };

    const handleOffline = () => {
      store.setSyncStatus('offline');
      showToast('Offline Mode. Timetable and attendance loaded from cache.', 'warning');
    };

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC_PLAYBACK') {
        if (navigator.onLine) {
          triggerClientPlayback();
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // Run initial check and sync on mount if online
    if (navigator.onLine) {
      playbackOfflineActionsClient().catch((err) => {
        console.error('[OfflineSync] Initial online action queue playback failed:', err);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  return (
    <>
      {children}
      <InstallPwaBanner />
      <OfflineSyncPill />
    </>
  );
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

