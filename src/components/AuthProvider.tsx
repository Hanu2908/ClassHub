/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore, type AuthUser } from '../store/appStore';
import { queryClient } from '../lib/queryClient';
import { toast } from 'sonner';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { ensurePushSubscription } from '../lib/pushNotifications';
import { saveSession, clearSession, playbackOfflineActionsClient } from '../lib/offlineSync';
import InstallPwaBanner from './InstallPwaBanner';
import OfflineSyncPill from './OfflineSyncPill';
import { subscribeToSection } from '../lib/realtimeBroker';

const SKIT_DOMAIN = '@skit.ac.in';

// ── Helper: fetch user profile from public.users ──
async function fetchProfile(userId: string): Promise<{ profile: AuthUser | null; isError: boolean }> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, role, cr_rank, section_id, section_roll, university_roll, day_scholar, notifications_enabled, is_developer, sub_batch, phone, branch')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Auth] fetchProfile error:', error);
    return { profile: null, isError: true };
  }

  if (!data) {
    if (import.meta.env.DEV) {
      console.log('[Auth] fetchProfile: no profile row returned for user:', userId);
    }
    return { profile: null, isError: false };
  }

  let isCounsellorForBatch: '1' | '2' | null = null;
  if (data.role === 'teacher' && data.section_id) {
    const { data: stData } = await supabase
      .from('section_teachers')
      .select('is_counsellor_for_batch')
      .eq('teacher_id', userId)
      .eq('section_id', data.section_id)
      .not('is_counsellor_for_batch', 'is', null)
      .limit(1)
      .maybeSingle();
    if (stData) {
      isCounsellorForBatch = stData.is_counsellor_for_batch as '1' | '2';
    }
  }

  const profile: AuthUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url ?? null,
    role: data.role as 'student' | 'cr' | 'teacher',
    crRank: (data as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
    sectionId: data.section_id,
    sectionRoll: data.section_roll,
    universityRoll: data.university_roll,
    dayScholar: data.day_scholar,
    notificationsEnabled: data.notifications_enabled,
    isDeveloper: data.is_developer ?? false,
    subBatch: (data as Record<string, unknown>).sub_batch as string | null ?? null,
    isCounsellorForBatch,
    phone: data.phone ?? null,
    branch: data.branch ?? null,
  };

  return { profile, isError: false };
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
    phone: null,
    branch: null,
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

  // Domain check (case-insensitive)
  if (!user.email?.toLowerCase().endsWith(SKIT_DOMAIN)) {
    await supabase.auth.signOut();
    store.setAuthUser(null);
    store.setSession(null);
    store.setAuthLoading(false);
    navigateFn?.('/?error=domain');
    return;
  }

  store.setSession(session);
  saveSession(session.access_token, user.id);

  // Try to fetch the backend profile; retry ONLY in case of query/network errors
  let { profile, isError } = await fetchProfile(user.id);
  if (!profile && isError) {
    // Retry with a short backoff — helpful when network/DB is temporarily glitching
    for (let attempt = 0; attempt < 3 && !profile; attempt++) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      const res = await fetchProfile(user.id);
      profile = res.profile;
      isError = res.isError;
    }
  }

  if (profile) {
    store.setAuthUser(profile);
  } else if (isError) {
    // A network or query error occurred. Fall back to cached profile to prevent logout loops during flaky connections.
    const existing = store.authUser;
    if (existing && existing.id === user.id) {
      store.setAuthUser(existing);
    } else if (import.meta.env.DEV && existing?.sectionId === 'demo-section') {
      store.setAuthUser(existing);
    } else {
      const isAppRoute = window.location.pathname.startsWith('/app');
      if (isAppRoute) {
        try {
          toast.warning('Signed in but profile fetch failed due to a network glitch. Loading basic profile.');
        } catch {
          // ignore if toast system is not yet mounted
        }
      }
      store.setAuthUser(authUserToBasicProfile(user));
    }
  } else {
    // Database query succeeded but returned no profile row.
    // The user has either been deleted from public.users or has not yet completed onboarding.
    // Force set the basic profile (which has sectionId: null) so they are sent to onboarding choice.
    // This resolves the security bypass where deleted users could navigate with cached credentials.
    const existing = store.authUser;
    if (import.meta.env.DEV && existing?.sectionId === 'demo-section') {
      store.setAuthUser(existing);
    } else {
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

  // Capture invite code from URL parameters as early as possible
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite') || params.get('code');
    if (inviteCode) {
      const isStudentCode = /^[A-Za-z0-9]{2}[A-Za-z]{4}$/.test(inviteCode);
      const isTeacherCode = /^T-[A-Za-z0-9]{6}$/i.test(inviteCode);
      if (isStudentCode || isTeacherCode) {
        localStorage.setItem('classhub-pending-invite-code', inviteCode.toUpperCase());
        if (import.meta.env.DEV) {
          console.log('[Auth] Captured pending invite code:', inviteCode.toUpperCase());
        }
      }
    }
  }, []);

  // Initialize auth exactly once
  useEffect(() => {
    const store = useAppStore.getState();
    let mounted = true;

    // Safety net: if auth takes too long, stop loading so user isn't stuck on blank screen
    const safetyTimeout = setTimeout(() => {
      if (mounted && store.isAuthLoading) {
        if (import.meta.env.DEV) {
          console.warn('[Auth] Safety timeout — stopping loading spinner after 7s');
        }
        store.setAuthLoading(false);
      }
    }, 7000);

    async function getInitialSession() {
      // If there is an auth hash in the URL, let onAuthStateChange handle the event cleanly to avoid Supabase client deadlock
      const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
      if (hasAuthHash) {
        if (import.meta.env.DEV) {
          console.log('[Auth] Auth hash detected in URL. Skipping getInitialSession to let onAuthStateChange handle token recovery.');
        }
        return;
      }

      // Offline fast-path: if we're offline and have a cached authUser with a sectionId,
      // trust the persisted Zustand state instead of calling getSession() which will
      // hang or fail when attempting to refresh an expired JWT.
      if (!navigator.onLine) {
        const offlineStore = useAppStore.getState();
        if (offlineStore.authUser?.sectionId) {
          if (import.meta.env.DEV) {
            console.log('[Auth] Offline with cached authUser — using persisted profile, skipping getSession().');
          }
          offlineStore.setAuthLoading(false);
          return;
        }
      }

      // Dev demo bypass fast-path: if demo_mode is active in DEV, ensure demo authUser is initialized and skip remote getSession()
      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        const store = useAppStore.getState();
        if (!store.authUser) {
          const demoSectionId = localStorage.getItem('demo_section_id') || null;
          store.setAuthUser({
            id: 'demo-user-id',
            name: 'Demo Contributor',
            email: 'contributor@skit.ac.in',
            avatarUrl: null,
            role: 'student',
            crRank: null,
            sectionId: demoSectionId,
            sectionRoll: 'P-01',
            universityRoll: '24ESKCS001',
            dayScholar: true,
            notificationsEnabled: false,
            isDeveloper: true,
            phone: '9876543210',
            branch: 'CSE',
          });
        }
        store.setAuthLoading(false);
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !session) {
          if (error) {
            console.error('[Auth] Error fetching initial session:', error);
          }
          // Do not wipe cached authUser here to prevent kicking mobile PWA users to login
          // during background resumes or transient token refreshes.
          // True logout is handled authoritatively by SIGNED_OUT event.
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
      } catch (err: any) {
        console.error('[Auth] getInitialSession failed with exception:', err);
        if (mounted) {
          store.setAuthLoading(false);
        }
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (import.meta.env.DEV) {
        console.log('[Auth] AuthStateChange Event:', event, session?.user?.email ?? 'no-user');
      }

      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const currentStore = useAppStore.getState();
          if (currentStore.session?.user?.id === session.user.id && currentStore.authUser?.id === session.user.id) {
            if (import.meta.env.DEV) {
              console.log('[Auth] Skipping duplicate auth event for user:', session.user.id);
            }
            return;
          }
          
          store.setSession(session);
          saveSession(session.access_token, session.user.id);

          // Decouple to avoid deadlocking the Supabase client's auth state listener
          setTimeout(() => {
            handleSession(session.user, session, _navigateFn ?? undefined).catch(err => {
              console.error('[Auth] Error inside async handleSession background task:', err);
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          store.setSession(null);
          store.setAuthUser(null);
          store.setAuthLoading(false);
          localStorage.removeItem('classhub-pending-invite-code');
          localStorage.removeItem('classhub-pending-share-inbox-id');
          queryClient.clear();
          clearSession();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          store.setSession(session);
          saveSession(session.access_token, session.user.id);
        } else if (event === 'INITIAL_SESSION' && !session) {
          store.setAuthLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Error in onAuthStateChange callback for event:', event, err);
        store.setAuthLoading(false);
      }
    });

    // Handle Mobile PWA resume / tab visibility change
    const handleVisibilityOrPageShow = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            const currentStore = useAppStore.getState();
            if (!currentStore.session) {
              currentStore.setSession(session);
              saveSession(session.access_token, session.user.id);
            }
          }
        }).catch((err) => {
          if (import.meta.env.DEV) {
            console.log('[Auth] Visibility change session refresh skipped:', err);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrPageShow);
    window.addEventListener('pageshow', handleVisibilityOrPageShow);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityOrPageShow);
      window.removeEventListener('pageshow', handleVisibilityOrPageShow);
      subscription.unsubscribe();
    };
  }, []);

  // ── Supabase Realtime Subscriptions ──
  const sectionId = useAppStore(s => s.authUser?.sectionId);

  useEffect(() => {
    if (!sectionId) return;

    const unsubscribe = subscribeToSection(sectionId, {
      onAnnouncement: (payload) => {
        if (!payload) {
          queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] });
          return;
        }

        const { eventType, new: newRow, old: oldRow } = payload;

        if (eventType === 'INSERT' && newRow) {
          const incomingId = newRow.id;
          const formattedNewAnn = {
            id: incomingId,
            authorId: newRow.author_id,
            title: newRow.title,
            body: newRow.message_content,
            priority: newRow.priority,
            deadline: newRow.deadline_at,
            postedAt: newRow.created_at,
            expiresAt: newRow.expires_at ?? null,
            attachmentUrl: null,
            isAcknowledged: false,
            targetBatch: newRow.target_batch ?? null,
            attachments: [],
          };

          queryClient.setQueriesData(
            { queryKey: ['announcements', sectionId] },
            (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              // Check if announcement already exists (e.g. optimistic or already prepended)
              const existingIdx = oldData.findIndex(a => a.id === incomingId);
              if (existingIdx !== -1) {
                const updated = [...oldData];
                updated[existingIdx] = { ...updated[existingIdx], ...formattedNewAnn };
                return updated;
              }
              // Prepend new announcement live without network refetch
              return [formattedNewAnn, ...oldData];
            }
          );
        } else if (eventType === 'DELETE' && oldRow?.id) {
          queryClient.setQueriesData(
            { queryKey: ['announcements', sectionId] },
            (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.filter(a => a.id !== oldRow.id);
            }
          );
        } else {
          // For updates or complex events, invalidate query softly
          queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] });
        }
      },
      onAssignment: () => queryClient.invalidateQueries({ queryKey: ['assignments', sectionId] }),
      onPoll: () => queryClient.invalidateQueries({ queryKey: ['polls', sectionId] }),
      onVote: () => queryClient.invalidateQueries({ queryKey: ['polls', sectionId] }),
      onSubmission: () => {
        queryClient.invalidateQueries({ queryKey: ['submissions'] });
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
      },
      onAcknowledgment: () => queryClient.invalidateQueries({ queryKey: ['announcements', sectionId] }),
    });

    return unsubscribe;
  }, [sectionId]);

  // ── Push Notification Subscriptions Self-Heal ──
  const authUser = useAppStore(s => s.authUser);
  const authUserId = authUser?.id;

  useEffect(() => {
    if (!authUserId) return;
    ensurePushSubscription().catch((err) => {
      console.warn('[Push] ensurePushSubscription on auth ready failed:', err);
    });
  }, [authUserId]);

  // Listen for online/offline event transitions and manage Zustand syncStatus
  useEffect(() => {
    const store = useAppStore.getState();

    // Set initial status based on current browser environment
    const isOfflineInitially = !navigator.onLine;
    store.setSyncStatus(isOfflineInitially ? 'offline' : 'online');
    if (isOfflineInitially) {
      toast.warning('Offline Mode. Timetable and attendance loaded from cache.');
    }

    const triggerClientPlayback = () => {
      store.setSyncStatus('syncing');
      playbackOfflineActionsClient()
        .then(() => {
          store.setSyncStatus('synced');
          toast.success('Offline actions synchronized successfully.');
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
          toast.error('Some offline changes could not be synchronized. They will be retried when the connection improves.');
        });
    };

    const handleOnline = () => {
      toast.info('Connection restored. Syncing offline changes...');
      triggerClientPlayback();

      // Notify Service Worker to run sync if supported
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_ACTIONS' });
      }
    };

    const handleOffline = () => {
      store.setSyncStatus('offline');
      toast.warning('Offline Mode. Timetable and attendance loaded from cache.');
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
    const pendingShareInboxId = localStorage.getItem('classhub-pending-share-inbox-id');
    const pendingInviteCode = localStorage.getItem('classhub-pending-invite-code');
    const redirectPath = pendingShareInboxId
      ? `/share-intake?id=${encodeURIComponent(pendingShareInboxId)}`
      : (pendingInviteCode ? '/onboarding/join' : '/onboarding/choice');
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + redirectPath,
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
  localStorage.removeItem('classhub-pending-invite-code');
  localStorage.removeItem('classhub-pending-share-inbox-id');
  queryClient.clear();
  navigate('/');
}

