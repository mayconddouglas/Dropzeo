import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables irrespective of node / vite environment
const getEnv = (key: string): string => {
  if (typeof window !== 'undefined') {
    // Client-side Vite environment
    const metaEnv = (import.meta as any).env;
    return metaEnv?.[key] || '';
  }
  // Server-side Node environment
  return process.env[key] || '';
};

// URL and Anon key are needed on both client and server
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// Admin client using service_role to bypass RLS for uploads, deletes, and cleanup
// Safe to use ONLY server-side (in express API routes)
export const getSupabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin cannot be used on the client-side!');
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.warn('WARNING: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing for server-side admin client initialization.');
  }
  return createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};
