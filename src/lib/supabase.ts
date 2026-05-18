import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const clientOptions: any = {};

if (typeof window === 'undefined') {
  // For Node.js (CI/test) environments
  // Force import 'ws'
  // @ts-expect-error
  const ws = require('ws');
  if (ws) {
    clientOptions.realtime = { transport: ws };
  }
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  clientOptions
);


