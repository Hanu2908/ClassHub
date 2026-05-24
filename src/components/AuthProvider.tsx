/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser, type DbNotification } from '../store/appStore';
import { queryClient } from '../lib/queryClient';
import { showToast } from '../components/Toast';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import InstallPwaBanner from './InstallPwaBanner';
import { ensurePushSubscription } from '../lib/pushNotifications';

const SKIT_DOMAIN = '@skit.ac.in';

// ── Helper: fetch user profile from public.users ──
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role, section_id, section_roll, university_roll, day_scholar, notifications_enabled, is_developer')
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
        } else if (event === 'TOKEN_REFRESHED' && session) {
          store.setSession(session);
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

    if (import.meta.env.DEV) {
      console.log(`[Realtime] Setting up subscriptions for section: ${sectionId}`);
    }

    const channel = supabase
      .channel(`section-realtime-${sectionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', filter: `section_id=eq.${sectionId}` },
        (payload) => {
          console.log('[Realtime] announcement change:', payload);
          queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] });
          // Notification toast/bell is handled by the notification_events realtime subscription
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter: `section_id=eq.${sectionId}` },
        (payload) => {
          console.log('[Realtime] assignment change:', payload);
          queryClient.invalidateQueries({ queryKey: ['assignments', sectionId] });
          // Notification toast/bell is handled by the notification_events realtime subscription
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `section_id=eq.${sectionId}` },
        (payload) => {
          console.log('[Realtime] poll change:', payload);
          queryClient.invalidateQueries({ queryKey: ['polls', sectionId] });
          // Notification toast/bell is handled by the notification_events realtime subscription
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        (payload) => {
          console.log('[Realtime] vote change:', payload);
          queryClient.invalidateQueries({ queryKey: ['polls', sectionId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        (payload) => {
          console.log('[Realtime] submission change:', payload);
          queryClient.invalidateQueries({ queryKey: ['submissions'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'acknowledgments' },
        (payload) => {
          console.log('[Realtime] acknowledgment change:', payload);
          queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] });
        }
      )
      .on(
        'broadcast',
        { event: 'custom_notification' },
        (payload) => {
          console.log('[Realtime] custom notification broadcast:', payload);
          useAppStore.getState().addNotification({
            title: payload.payload.title,
            body: payload.payload.body,
            type: 'system'
          });
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[Realtime] Subscription status for section ${sectionId}:`, status);
        }
      });

    return () => {
      if (import.meta.env.DEV) {
        console.log(`[Realtime] Cleaning up subscriptions for section: ${sectionId}`);
      }
      supabase.removeChannel(channel);
    };
  }, [sectionId]);

  // ── Supabase Realtime Notifications Sync ──
  const authUser = useAppStore(s => s.authUser);
  const authUserId = authUser?.id;
  const setNotifications = useAppStore(s => s.setNotifications);

  useEffect(() => {
    if (!authUserId) return;
    const userId = authUserId;

    if (import.meta.env.DEV) {
      console.log(`[Realtime] Setting up notifications subscription for user: ${userId}`);
    }

    // 1. Initial Fetch of notifications
    async function fetchInitialNotifications() {
      const { data, error } = await supabase
        .from('notification_events')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Cap at 50 to keep it fast

      if (error) {
        console.error('[Realtime] Failed to fetch initial notifications:', error);
        return;
      }

      if (data) {
        const { mapDbNotification } = await import('../store/appStore');
        setNotifications(data.map(mapDbNotification));
      }
    }

    fetchInitialNotifications();

    // Heal push subscriptions that may have been cleaned up server-side.
    // Only in production — SW is intentionally disabled in dev.
    if (import.meta.env.PROD) {
      ensurePushSubscription().catch((err) => {
        console.warn('[Push] ensurePushSubscription on auth ready failed:', err);
      });
    }

    // 2. Real-time Subscription for notification_events
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_events',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          if (import.meta.env.DEV) console.log('[Realtime] notification change:', payload);
          const { mapDbNotification } = await import('../store/appStore');

          if (payload.eventType === 'INSERT') {
            const newNotif = mapDbNotification(payload.new as DbNotification);
            
            // Add to store
            useAppStore.setState((s) => ({
              notifications: [newNotif, ...s.notifications],
            }));

            // Trigger a beautiful toast notification!
            showToast(newNotif.title, 'info');
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = mapDbNotification(payload.new as DbNotification);
            
            // Update in store
            useAppStore.setState((s) => ({
              notifications: s.notifications.map((n) =>
                n.id === updatedNotif.id ? updatedNotif : n
              ),
            }));
          } else if (payload.eventType === 'DELETE') {
            // Remove from store
            useAppStore.setState((s) => ({
              notifications: s.notifications.filter((n) => n.id !== payload.old.id),
            }));
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[Realtime] Notifications subscription status for ${userId}:`, status);
        }
      });

    return () => {
      if (import.meta.env.DEV) {
        console.log(`[Realtime] Cleaning up notifications subscription for user: ${userId}`);
      }
      supabase.removeChannel(channel);
    };
  }, [authUserId, setNotifications]);

  return (
    <>
      {children}
      <InstallPwaBanner />
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

