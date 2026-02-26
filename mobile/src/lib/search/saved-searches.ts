import { supabase } from '@/src/lib/supabase/client';

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  category?: string;
  filters?: Record<string, any>;
  created_at: string;
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function saveSearch(
  userId: string,
  query: string,
  category?: string,
  filters?: Record<string, any>,
): Promise<SavedSearch> {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: userId,
      query: query.trim(),
      category: category || null,
      filters: filters || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
