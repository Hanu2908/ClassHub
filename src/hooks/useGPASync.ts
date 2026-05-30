import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGPAStore } from '../store/gpaStore';
import { useAppStore } from '../store/appStore';

export function useGPASync() {
  const user = useAppStore((state) => state.user);
  const isHydrated = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch initial state
    const fetchState = async () => {
      const { data, error } = await (supabase as any)
        .from('user_gpa_data')
        .select('gpa_state')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data?.gpa_state) {
        // Hydrate store from backend JSON
        useGPAStore.getState().hydrateState(data.gpa_state);
      }
      
      // Mark as hydrated regardless of success/fail (e.g. if row doesn't exist yet)
      // We do this to allow saving new data.
      setTimeout(() => {
        isHydrated.current = true;
      }, 100);
    };
    
    fetchState();

    // 2. Subscribe to changes
    const unsubscribe = useGPAStore.subscribe((state) => {
      // Don't save before initial load is complete
      if (!isHydrated.current) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(async () => {
        const payload = {
          activeBranch: state.activeBranch,
          activeSemester: state.activeSemester,
          semesters: state.semesters,
          manualHistory: state.manualHistory,
          targetCgpa: state.targetCgpa
        };

        await (supabase as any)
          .from('user_gpa_data')
          .upsert({
            user_id: user.id,
            gpa_state: payload,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }, 1500) as unknown as number; // 1.5s debounce
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user]);
}
