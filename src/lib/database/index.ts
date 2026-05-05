// Main database export file
import {
  getBrowserClient,
  createServerClient as serverClient,
  checkDatabaseConnection as checkDbConnection,
} from './supabase';

export type { Database } from './types';
export * from './types';

export const getSupabaseBrowserClient = getBrowserClient;
export const createServerClient = serverClient;
export const checkDatabaseConnection = checkDbConnection;
