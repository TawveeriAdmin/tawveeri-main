/**
 * Saved Searches Utility Functions
 * Functions for managing user saved searches
 */

import { getSupabaseBrowserClient, createServerClient } from '@/lib/database';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  search_query: string | null;
  filters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SaveSearchParams {
  userId: string;
  name: string;
  query?: string;
  filters?: Record<string, any>;
}

/**
 * Save a search
 */
export async function saveSearch(
  params: SaveSearchParams
): Promise<{ data: SavedSearch | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    const { data, error } = await (supabase
      .from('saved_searches' as any)
      .insert({
        user_id: params.userId,
        name: params.name,
        search_query: params.query || null,
        filters: params.filters || {},
      })
      .select()
      .single() as any);

    if (error) throw error;
    return { data: data as SavedSearch, error: null };
  } catch (error) {
    console.error('Error saving search:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get user's saved searches
 */
export async function getSavedSearches(
  userId: string
): Promise<{ data: SavedSearch[] | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as SavedSearch[], error: null };
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(
  searchId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return { error: error as Error };
  }
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  searchId: string,
  userId: string,
  updates: { name?: string; query?: string; filters?: Record<string, any> }
): Promise<{ data: SavedSearch | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.query !== undefined) updateData.search_query = updates.query;
    if (updates.filters !== undefined) updateData.filters = updates.filters;

    const { data, error } = await (supabase
      .from('saved_searches' as any)
      .update(updateData)
      .eq('id', searchId)
      .eq('user_id', userId)
      .select()
      .single() as any);

    if (error) throw error;
    return { data: data as SavedSearch, error: null };
  } catch (error) {
    console.error('Error updating saved search:', error);
    return { data: null, error: error as Error };
  }
}

