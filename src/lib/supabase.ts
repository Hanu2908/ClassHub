// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// The Supabase URL and Anon Key are public credentials intended for client-side use.
// They are safe to expose in client code and inspect element because the database enforces
// strict Row Level Security (RLS) policies on every table. All client-side reads, writes,
// and updates are validated at the database layer based on the user's authenticated session.
//
// ⚠️ SECURITY WARNING:
// - NEVER import or reference the `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
// - NEVER expose or bundle private API keys (e.g. OpenAI/Gemini AI keys, third-party payment secrets).
// - All operations requiring service-role privileges or private API keys must be performed
//   server-side within Supabase Edge Functions, using Deno.env secrets.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example → .env and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key'
);