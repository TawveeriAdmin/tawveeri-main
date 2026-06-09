import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

let browserClient: SupabaseClient<Database> | null = null;

export const getBrowserClient = () => {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient must be called in a browser environment.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      db: { schema: 'public' },
      global: { headers: { 'x-application-name': 'tawveeri' } },
    });
  }

  return browserClient;
};

export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: 'public' },
  });
};

export const checkDatabaseConnection = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const client =
    typeof window === 'undefined'
      ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          db: { schema: 'public' },
        })
      : getBrowserClient();

  try {
    const { data, error } = await client.from('users').select('count').limit(1);
    if (error) { console.error('Database connection error:', error); return false; }
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    return false;
  }
};
