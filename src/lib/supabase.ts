// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Only import ws dynamically when native WebSocket is missing (e.g. Node < 22 or testing environment)
let options = {};
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    const wsModuleName = 'ws';
    const req = (globalThis as any).require;
    const ws = req ? req(wsModuleName) : null;
    if (ws) {
      options = { realtime: { transport: ws } };
      globalThis.WebSocket = ws;
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