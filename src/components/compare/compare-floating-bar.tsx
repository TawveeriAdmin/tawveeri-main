'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, X, Trash2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/database';

const COMPARE_STORAGE_KEY = 'compare_products';
const COMPARE_CACHE_STORAGE_KEY = 'compare_products_cache';
const MAX_COMPARE = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CompareItem {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string | null;
  imageUrl: string | null;
}

interface CachedProduct {
  id?: string;
  name_ar?: string;
  name_en?: string;
  slug?: string;
  image_urls?: (string | null)[] | null;
}

interface CompareFloatingBarProps {
  locale: string;
}

/**
 * Persistent bottom bar that surfaces whatever the user has added to
 * their compare list. Pulls thumbnails + names from two sources:
 *   1. `compare_products_cache` in localStorage (written by the search page)
 *   2. Direct DB lookup for UUID product IDs not found in the cache
 *      (happens when the user adds-to-compare from the product-detail page)
 *
 * Does nothing when the list is empty.
 */
export function CompareFloatingBar({ locale }: CompareFloatingBarProps) {
  const isRTL = locale === 'ar';
  const pathname = usePathname() ?? '';
  // The compare page itself shows this same selection, so hide the bar there
  // to avoid stacking the tray over the page's own UI.
  const onComparePage = /\/compare(\/|$|\?)/.test(pathname);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    if (typeof window === 'undefined') return;

    let ids: string[] = [];
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      ids = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      ids = [];
    }
    ids = Array.from(new Set(ids)).slice(0, MAX_COMPARE);
    if (!ids.length) {
      setItems([]);
      return;
    }

    let cache: Record<string, CachedProduct> = {};
    try {
      const raw = window.localStorage.getItem(COMPARE_CACHE_STORAGE_KEY);
      cache = raw ? (JSON.parse(raw) as Record<string, CachedProduct>) : {};
    } catch {
      cache = {};
    }

    const resolved = new Map<string, CompareItem>();
    const missingDbIds: string[] = [];

    for (const id of ids) {
      const c = cache[id];
      if (c && (c.name_ar || c.name_en)) {
        resolved.set(id, {
          id,
          name_ar: c.name_ar ?? '',
          name_en: c.name_en ?? '',
          slug: c.slug ?? null,
          imageUrl: c.image_urls?.[0] ?? null,
        });
      } else if (UUID_RE.test(id)) {
        missingDbIds.push(id);
      }
    }

    if (missingDbIds.length) {
      try {
        const supa = getSupabaseBrowserClient();
        const { data } = await supa
          .from('products')
          .select('id, name_ar, name_en, slug, image_urls')
          .in('id', missingDbIds);
        for (const p of (data as Array<{ id: string; name_ar: string; name_en: string; slug: string; image_urls: string[] | null }> | null) ?? []) {
          resolved.set(p.id, {
            id: p.id,
            name_ar: p.name_ar,
            name_en: p.name_en,
            slug: p.slug,
            imageUrl: p.image_urls?.[0] ?? null,
          });
        }
      } catch {
        // Silent — if we can't resolve a DB product, it just won't appear in the bar.
      }
    }

    // Preserve user's original add order.
    const ordered = ids
      .map((id) => resolved.get(id))
      .filter((x): x is CompareItem => Boolean(x));
    setItems(ordered);
  }, []);

  useEffect(() => {
    load();
    const handler = () => {
      setHidden(false);
      load();
    };
    window.addEventListener('compare-products-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('compare-products-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [load]);

  const removeItem = useCallback((id: string) => {
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      const current: string[] = raw ? JSON.parse(raw) : [];
      const next = current.filter((x) => x !== id);
      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));

      const cacheRaw = window.localStorage.getItem(COMPARE_CACHE_STORAGE_KEY);
      if (cacheRaw) {
        try {
          const cache = JSON.parse(cacheRaw) as Record<string, CachedProduct>;
          delete cache[id];
          window.localStorage.setItem(COMPARE_CACHE_STORAGE_KEY, JSON.stringify(cache));
        } catch {
          // ignore malformed cache
        }
      }
      window.dispatchEvent(new Event('compare-products-updated'));
    } catch {
      // ignore storage errors
    }
  }, []);

  const clearAll = useCallback(() => {
    try {
      window.localStorage.removeItem(COMPARE_STORAGE_KEY);
      window.localStorage.removeItem(COMPARE_CACHE_STORAGE_KEY);
      window.dispatchEvent(new Event('compare-products-updated'));
    } catch {
      // ignore
    }
  }, []);

  if (!items.length || hidden || onComparePage) return null;

  const canCompare = items.length >= 2;
  const compareHref = `/${locale}/compare`;
  // Always clickable — opens the compare page even with 1 item so the user
  // can see it side-by-side and pick more from there. Copy hints at state.
  const labelCompare = isRTL
    ? canCompare
      ? 'قارن الآن'
      : 'افتح المقارنة'
    : canCompare
      ? 'Compare now'
      : 'Open compare';

  return (
    <div
      role="region"
      aria-label={isRTL ? 'لوحة المقارنة' : 'Compare tray'}
      className="fixed inset-x-3 bottom-3 z-50 md:inset-x-6 md:bottom-5"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)]/95 p-3 shadow-[var(--elevation-3)] backdrop-blur-md md:gap-4 md:p-4">
        {/* Header / count */}
        <div className="hidden shrink-0 items-center gap-2 pe-3 me-1 border-e border-[color:var(--color-outline-variant)]/50 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-green)]/10 text-[var(--brand-green-dark)]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-semibold text-on-surface">
              {isRTL ? 'المقارنة' : 'Compare'}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {items.length}/{MAX_COMPARE}
            </p>
          </div>
        </div>

        {/* Thumbnails */}
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const rawName = isRTL ? item.name_ar || item.name_en : item.name_en || item.name_ar;
            return (
              <li key={item.id} className="relative shrink-0">
                <Link
                  href={item.slug ? `/${locale}/products/${item.slug}` : compareHref}
                  className="flex w-16 flex-col items-center gap-1 rounded-lg border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-lowest)] p-1.5 transition-colors hover:border-[var(--brand-green)] md:w-20"
                  title={rawName || ''}
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded md:h-12 md:w-12">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <span
                    dir="auto"
                    className="line-clamp-1 max-w-full text-[10px] font-medium text-on-surface-variant md:text-[11px]"
                  >
                    {rawName || '—'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    removeItem(item.id);
                  }}
                  aria-label={isRTL ? 'إزالة من المقارنة' : 'Remove from compare'}
                  className="absolute -top-1.5 -end-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-on-surface-variant shadow-[var(--elevation-1)] transition-colors hover:bg-red-500 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}

          {/* Placeholders up to MAX_COMPARE */}
          {Array.from({ length: Math.max(0, MAX_COMPARE - items.length) }).map((_, i) => (
            <li
              key={`placeholder-${i}`}
              className="hidden h-[66px] w-16 shrink-0 rounded-lg border border-dashed border-[color:var(--color-outline-variant)]/50 md:block md:h-[74px] md:w-20"
              aria-hidden
            />
          ))}
        </ul>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={clearAll}
            aria-label={isRTL ? 'مسح الكل' : 'Clear all'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title={isRTL ? 'مسح الكل' : 'Clear all'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <Link
            href={compareHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--brand-green)] px-3 text-sm font-semibold text-on-primary transition-colors hover:bg-[var(--brand-green-dark)] md:h-10 md:px-4"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden whitespace-nowrap sm:inline">{labelCompare}</span>
            <span className="sm:hidden">{isRTL ? 'قارن' : 'Compare'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
