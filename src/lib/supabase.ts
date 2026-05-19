// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Only import ws dynamically in non-browser environments to prevent compile errors
let options = {};
if (typeof window === 'undefined') {
  try {
    const wsModuleName = 'ws';
    const req = (globalThis as any).require;
    const ws = req ? req(wsModuleName) : null;
    if (ws) {
      options = { realtime: { transport: ws } };
    }
  } catch (e) {}
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  options
);