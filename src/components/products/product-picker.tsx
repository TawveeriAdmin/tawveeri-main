'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export interface PickedProduct {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  imageUrl: string | null;
  lowestPrice: number | null;
}

interface ProductPickerProps {
  locale: string;
  onPick: (product: PickedProduct) => void;
  placeholder?: string;
}

interface SearchApiProduct {
  product_id?: string;
  id?: string;
  name_ar: string;
  name_en: string;
  product_slug?: string;
  slug?: string;
  image_urls?: string[] | null;
  best_price?: number;
  current_price?: number;
}

export function ProductPicker({ locale, onPick, placeholder }: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, pages: 1, sort: 'relevance' }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || 'Search failed');
        const products = (data.products as SearchApiProduct[] | undefined) || [];
        setResults(
          products
            .filter((p) => p.product_id || p.id)
            .slice(0, 15)
            .map((p) => ({
              id: (p.product_id || p.id) as string,
              name_ar: p.name_ar,
              name_en: p.name_en,
              slug: (p.product_slug || p.slug) as string,
              imageUrl: p.image_urls?.[0] ?? null,
              lowestPrice: p.best_price ?? p.current_price ?? null,
            })),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const isRTL = locale === 'ar';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? (isRTL ? 'ابحث عن منتج…' : 'Search for a product…')}
          className="ps-9"
          autoFocus
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {query.trim().length >= 2 && (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-outline-variant">
          {loading && (
            <div className="space-y-1 p-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="p-3 text-sm text-on-surface-variant">
              {isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching products.'}
            </p>
          )}
          {!loading &&
            results.map((p) => {
              const name = isRTL ? p.name_ar : p.name_en;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-start hover:bg-on-surface/5"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-container-lowest">
                    {p.imageUrl && (
                      <Image
                        src={p.imageUrl}
                        alt={name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">{name}</p>
                    {typeof p.lowestPrice === 'number' && p.lowestPrice > 0 && (
                      <p className="text-xs text-on-surface-variant">
                        {p.lowestPrice.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
