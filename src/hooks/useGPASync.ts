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

    // Shared save function — used by both initial sync push and subscription handler
    const saveStateToDb = async () => {
      const state = useGPAStore.getState();
      const payload = {
        activeBranch: state.activeBranch,
        activeSemester: state.activeSemester,
        semesters: state.semesters,
        manualHistory: state.manualHistory,
        targetCgpa: state.targetCgpa,
      };
      const { error } = await (supabase as any)
        .from('user_gpa_data')
        .upsert({
          user_id: user.id,
          gpa_state: payload,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) console.error('Failed to sync GPA data to database:', error);
      else console.log('Successfully synced GPA data to database!');
    };

    // 1. Fetch initial state
    const fetchState = async () => {
      const { data, error } = await (supabase as any)
        .from('user_gpa_data')
        .select('gpa_state')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Failed to fetch GPA data from database:', error);
      } else if (data?.gpa_state) {
        const localState = useGPAStore.getState();
        
        // Count how many marks are filled locally vs in the database
        const countLocalMarks = Object.values(localState.semesters).reduce((sum, sem) => 
          sum + sem.subjects.filter(sub => sub.marks !== null).length, 0
        );
        const countDbMarks = Object.values((data.gpa_state as any).semesters || {}).reduce((sum: number, sem: any) => 
          sum + (sem.subjects || []).filter((sub: any) => sub.marks !== null).length
        , 0) as number;

        console.log(`GPA Sync: Local marks count = ${countLocalMarks}, DB marks count = ${countDbMarks}`);

        // Prevent destructive overwrites: only hydrate if DB has equal or more marks, 
        // or if local store is completely blank.
        if (countLocalMarks === 0 || countDbMarks >= countLocalMarks) {
          console.log('Hydrating local store from database:', data.gpa_state);
          localState.hydrateState(data.gpa_state);
        } else {
          console.log('Client has richer local marks than database. Skipping hydration to prevent overwrite.');
          // Directly push the richer local state to the database
          setTimeout(saveStateToDb, 500);
        }
      } else {
        console.log('No existing GPA data found in database for user.');
      }
      
      // Mark as hydrated regardless of success/fail (e.g. if row doesn't exist yet)
      // We do this to allow saving new data.
      setTimeout(() => {
        isHydrated.current = true;
      }, 100);
    };
    
    fetchState();

    // 2. Subscribe to changes
    const unsubscribe = useGPAStore.subscribe(() => {
      // Don't save before initial load is complete
      if (!isHydrated.current) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(saveStateToDb, 1500) as unknown as number; // 1.5s debounce
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user]);
}
