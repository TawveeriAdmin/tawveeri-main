import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vyceqrzttspyycdpojtn.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Y2Vxcnp0dHNweXljZHBvanRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjczNjgsImV4cCI6MjA4NTc0MzM2OH0.eSfmDJukU9y4h-yEtAS9OfGXV443eBL82a99O0kwr14';

let browserClient: SupabaseClient<Database> | null = null;

export const getBrowserClient = () => {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      db: { schema: 'public' },
      global: { headers: { 'x-application-name': 'tawveeri' } },
    });
  }
  return browserClient;
};

export const createServerClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey || SUPABASE_ANON_KEY;

  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
};

export const checkDatabaseConnection = async () => {
  try {
    const client = createServerClient();
    const { error } = await client.from('products').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};