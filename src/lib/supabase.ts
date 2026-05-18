import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example → .env and fill in your Supabase project credentials.'
  );
}

// Build options dynamically to support Node.js < 22 (e.g. testing with Vitest)
const clientOptions: any = {};

if (typeof window === 'undefined') {
  try {
    // Access require via globalThis to prevent TypeScript compilation errors in pure ESM setups
    const wsModuleName = 'ws';
    const req = (globalThis as any).require;
    const ws = req ? req(wsModuleName) : null;
    if (ws) {
      clientOptions.realtime = { transport: ws };
    }
  } catch (err) {
    // Fallback to dynamic import polyfill for pure ESM server contexts
    try {
      const wsModuleName = 'ws';
      import(wsModuleName).then((ws) => {
        globalThis.WebSocket = ws.default || ws;
      }).catch(() => {});
    } catch (e) {}
  }
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  clientOptions
);
