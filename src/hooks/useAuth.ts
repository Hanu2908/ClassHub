import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useAppStore } from '../store/appStore';
// ── Types ───────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'student' | 'cr';
  sectionId: string | null;
  sectionRoll: string | null;
  universityRoll: string | null;
  dayScholar: boolean;
}

interface AuthState {
  session: Session | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const SKIT_DOMAIN = '@skit.ac.in';

// ── Helper: fetch user profile from public.users ──────────
async function fetchProfile(userId: string): Promise<UserProfile | null> {
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

// ── Helper: extract basic info from Supabase auth user ────
function authUserToBasicProfile(authUser: SupabaseUser): Omit<UserProfile, 'role' | 'sectionId' | 'sectionRoll' | 'universityRoll' | 'dayScholar'> {
  const meta = authUser.user_metadata ?? {};
  return {
    id: authUser.id,
    name: meta.full_name ?? meta.name ?? authUser.email?.split('@')[0] ?? 'Student',
    email: authUser.email ?? '',
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────
export function useAuth(): AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
} {
  const isDemoMode = localStorage.getItem('demo_mode') === 'true';
  const demoSession = isDemoMode ? ({ user: { id: 'demo' } } as unknown as Session) : null;
  // Role is set by onboarding flow (Join=student, Create=cr) and persisted in appStore
  const persistedRole = isDemoMode ? useAppStore.getState().role : 'student';
  const demoProfile = isDemoMode ? ({
    id: 'demo-user',
    name: 'Demo Student',
    email: 'demo@skit.ac.in',
    avatarUrl: null,
    role: persistedRole,
    sectionId: localStorage.getItem('demo_section_id') || null,
    sectionRoll: null,
    universityRoll: null,
    dayScholar: true,
  } as UserProfile) : null;

  const [session, setSession] = useState<Session | null>(demoSession);
  const [user, setUser] = useState<UserProfile | null>(demoProfile);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const navigate = useNavigate();

  // Fetch or refresh user profile from DB
  const refreshProfile = useCallback(async () => {
    if (localStorage.getItem('demo_mode') === 'true') {
      setUser(prev => prev ? { ...prev, sectionId: localStorage.getItem('demo_section_id') || null } : null);
      return;
    }
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) {
      setUser(null);
      setSession(null);
      return;
    }

    setSession(currentSession);
    const profile = await fetchProfile(currentSession.user.id);
    if (profile) {
      setUser(profile);
    } else {
      // Authenticated but no profile row yet — set basic info with defaults
      const basic = authUserToBasicProfile(currentSession.user);
      setUser({
        ...basic,
        role: 'student',
        sectionId: null,
        sectionRoll: null,
        universityRoll: null,
        dayScholar: true,
      });
    }
  }, []);

  // Bootstrap: get initial session + listen for changes
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (localStorage.getItem('demo_mode') === 'true') {
        setIsLoading(false);
        return;
      }
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (initialSession?.user) {
        // Domain check
        if (!initialSession.user.email?.endsWith(SKIT_DOMAIN)) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setIsLoading(false);
          navigate('/?error=domain');
          return;
        }

        setSession(initialSession);
        const profile = await fetchProfile(initialSession.user.id);
        if (profile) {
          setUser(profile);
        } else {
          const basic = authUserToBasicProfile(initialSession.user);
          setUser({
            ...basic,
            role: 'student',
            sectionId: null,
            sectionRoll: null,
            universityRoll: null,
            dayScholar: true,
          });
        }
      }
      setIsLoading(false);
    };

    bootstrap();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && newSession?.user) {
          // Domain check on every sign-in
          if (!newSession.user.email?.endsWith(SKIT_DOMAIN)) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            navigate('/?error=domain');
            return;
          }

          setSession(newSession);
          const profile = await fetchProfile(newSession.user.id);
          if (profile) {
            setUser(profile);
          } else {
            const basic = authUserToBasicProfile(newSession.user);
            setUser({
              ...basic,
              role: 'student',
              sectionId: null,
              sectionRoll: null,
              universityRoll: null,
              dayScholar: true,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/onboarding/choice',
        queryParams: { hd: 'skit.ac.in' },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (localStorage.getItem('demo_mode') === 'true') {
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_section_id');
    } else {
      await supabase.auth.signOut();
    }
    // Clear persisted zustand store so stale user/role data doesn't survive
    useAppStore.getState().signOut();
    setSession(null);
    setUser(null);
    navigate('/');
  }, [navigate]);

  // Sync role to appStore whenever auth user changes (live mode)
  useEffect(() => {
    if (user?.role) {
      useAppStore.getState().setRole(user.role);
    }
  }, [user?.role]);

  return {
    session,
    user,
    isLoading,
    isAuthenticated: !!session,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };
}
