import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Fail fast on missing Supabase configuration.
 * No credential defaults are embedded in source — the environment is the only
 * authority for which Supabase project this process talks to.
 */
const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `[supabase] Missing required environment variable: ${name}. ` +
        'Configure it for this environment before starting the application.'
    );
  }
  return value;
};

let browserClient: SupabaseClient<Database> | null = null;

export const getBrowserClient = () => {
  if (!browserClient) {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
    const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);

    browserClient = createBrowserClient<Database>(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      db: { schema: 'public' },
      global: { headers: { 'x-application-name': 'tawveeri' } },
    });
  }
  return browserClient;
};

export const createServerClient = () => {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  // Service role is required: silently falling back to the anon key would
  // downgrade privileges and return RLS-filtered results as if they were complete.
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createClient<Database>(url, key, {
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