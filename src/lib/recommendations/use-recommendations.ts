'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useAuth } from '@/lib/auth/auth-context';
import type { RecommendedProduct, RecommendationOptions } from './types';

export function useRecommendations(options: RecommendationOptions = {}) {
  const { type = 'auto', productId, limit = 8 } = options;
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error: rpcError } = await supabase.rpc('get_recommendations', {
          p_user_id: user?.id ?? undefined,
          p_product_id: productId ?? undefined,
          p_type: type,
          p_limit: limit,
        });

        if (rpcError) throw rpcError;
        if (!cancelled) {
          setRecommendations((data as RecommendedProduct[]) ?? []);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, [user?.id, productId, type, limit]);

  return { recommendations, loading, error };
}
