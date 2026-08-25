'use client';
// src/components/catalog/category-view-tracker.tsx
// Category-facet-pages mission (2026-08-25). Fires `category_page_view` once on mount.
// `/categories/[slug]` and its `[facet]` child are server components (force-dynamic, read
// the DB per request) — `track()` needs `window`/`localStorage`, so it can't run there
// directly. This is the same "tiny client beacon mounted inside a server page" pattern
// `product-detail-client.tsx` already uses for `product_view`, applied here rather than
// invented fresh. Renders nothing.
import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function CategoryViewTracker({ category, facet }: { category: string; facet: string | null }) {
  useEffect(() => {
    track('category_page_view', { category, meta: facet ? { facet } : undefined });
  }, [category, facet]);
  return null;
}
