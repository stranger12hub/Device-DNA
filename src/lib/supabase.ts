import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let clerkAccessTokenGetter: (() => Promise<string | null>) | null = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'missing-anon-key',
  {
    accessToken: async () => clerkAccessTokenGetter?.() ?? null,
  },
);

export function setSupabaseAccessTokenGetter(
  getter: (() => Promise<string | null>) | null,
) {
  clerkAccessTokenGetter = getter;
}

export async function getClerkAccessToken(): Promise<string | null> {
  return clerkAccessTokenGetter?.() ?? null;
}
