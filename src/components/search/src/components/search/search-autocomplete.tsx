'use client';

/**
 * TAWVEERI LIVE SEARCH AUTOCOMPLETE
 * ════════════════════════════════════════
 * يعرض 5 نتائج حقيقية من قاعدة البيانات أثناء الكتابة
 * مع صورة + اسم + أرخص سعر + اسم المتجر + نسبة الخصم
 *
 * مستوحى من:
 * - JD.com — صورة + سعر في الـ dropdown
 * - Taobao — نتائج فورية أثناء الكتابة
 * - Amazon — تنظيم النتائج بأقسام
 * - Algolia — تمييز الكلمة المكتوبة
 * ════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Sparkles, X, TrendingUp, Clock, ArrowLeft, ArrowRight, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Arabic normalization ─────────────────────────────────────────────────────
const ARABIC_MAP: Record<string, string> = {
  'ايفون': 'iphone', 'آيفون': 'iphone', 'سامسونج': 'samsung',
  'لابتوب': 'laptop', 'حاسوب': 'laptop', 'تلفزيون': 'tv',
  'شاشة': 'monitor', 'سماعات': 'headphones', 'مكيف': 'air conditioner',
  'ثلاجة': 'refrigerator', 'غسالة': 'washing machine',
  'مكنسة': 'vacuum', 'جوال': 'smartphone', 'هاتف': 'smartphone',
  'تابلت': 'tablet', 'ساعة': 'smartwatch', 'كاميرا': 'camera',
  'هواوي': 'huawei', 'شاومي': 'xiaomi', 'برو': 'pro',
  'ماكس': 'max', 'بلس': 'plus', 'الترا': 'ultra',
};

function toSearchQuery(q: string): string {
  let result = q;
  for (const [ar, en] of Object.entries(ARABIC_MAP)) {
    result = result.replace(new RegExp(ar, 'gi'), en);
  }
  return result.trim();
}

// Highlight matched text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-[color:var(--color-primary)]/20 text-[color:var(--color-primary)] rounded px-0.5 font-bold not-italic">{part}</mark>
      : part
  );
}

// ─── Trending ─────────────────────────────────────────────────────────────────
const TRENDING_AR = [
  { q: 'ايفون 16 برو ماكس', badge: '🔥 الأكثر بحثاً' },
  { q: 'سامسونج S25 Ultra', badge: '⚡ عرض اليوم' },
  { q: 'لابتوب للدراسة', badge: '📚 موسم الدراسة' },
  { q: 'مكيف سبليت', badge: '❄️ الصيف' },
  { q: 'سماعات لاسلكية', badge: '🎧 خصم 30%' },
];

const TRENDING_EN = [
  { q: 'iPhone 16 Pro Max', badge: '🔥 Most searched' },
  { q: 'Samsung S25 Ultra', badge: "⚡ Today's deal" },
  { q: 'Laptop for study', badge: '📚 Back to school' },
  { q: 'Split AC', badge: '❄️ Summer' },
  { q: 'Wireless headphones', badge: '🎧 30% off' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductResult {
  product_id: string;
  product_slug: string;
  name_ar: string;
  name_en: string;
  best_price: number;
  original_price?: number;
  store_count: number;
  image_url?: string;
  store_name?: string;
}

interface SearchAutocompleteProps {
  locale: string;
  initialQuery?: string;
  compact?: boolean;
  onQuery?: (q: string) => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SearchAutocomplete({
  locale,
  initialQuery = '',
  compact = false,
  onQuery,
  className,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const isRTL = locale === 'ar';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [mode, setMode] = useState<'text' | 'ai'>('text');

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const trending = isRTL ? TRENDING_AR : TRENDING_EN;

  // Load recent
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tw_recent') || '[]');
      setRecentSearches(s.slice(0, 4));
    } catch { /* ignore */ }
  }, []);

  // Outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setFocused(false);
        setSelectedIdx(-1);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Fetch live results
  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const translated = toSearchQuery(q);
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: translated, pageSize: 5, sort: 'relevance' }),
      });
      const data = await res.json();
      setResults((data.products || []).slice(0, 5));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  // Debounce on query change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => fetchResults(query), 280);
    } else {
      setResults([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchResults]);

  const saveRecent = useCallback((q: string) => {
    if (!q.trim()) return;
    try {
      const s = JSON.parse(localStorage.getItem('tw_recent') || '[]');
      const u = [q, ...s.filter((x: string) => x !== q)].slice(0, 6);
      localStorage.setItem('tw_recent', JSON.stringify(u));
      setRecentSearches(u.slice(0, 4));
    } catch { /* ignore */ }
  }, []);

  const navigate = useCallback((q: string, productSlug?: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setFocused(false);
    setSelectedIdx(-1);

    if (productSlug) {
      router.push(`/${locale}/products/${productSlug}`);
    } else if (mode === 'ai') {
      router.push(`/${locale}/assistant?q=${encodeURIComponent(trimmed)}`);
    } else {
      if (onQuery) { onQuery(trimmed); return; }
      router.push(`/${locale}/search?q=${encodeURIComponent(toSearchQuery(trimmed))}`);
    }
  }, [mode, locale, router, onQuery, saveRecent]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && results[selectedIdx]) {
      navigate(results[selectedIdx].name_ar || results[selectedIdx].name_en, results[selectedIdx].product_slug);
    } else {
      navigate(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const max = results.length > 0 ? results.length - 1 : trending.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, max)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setFocused(false); }
  };

  const showDropdown = focused;
  const isEmpty = query.trim().length < 2;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>

      {/* ── Pill ── */}
      <form onSubmit={handleSubmit}>
        <div className={cn(
          'relative flex items-stretch overflow-hidden rounded-full border transition-all duration-200',
          compact ? 'h-11' : 'h-14',
          focused
            ? 'border-[color:var(--color-primary)] ring-4 ring-[color:var(--color-primary)]/12 shadow-[0_8px_32px_-8px_rgba(85,178,149,0.3)]'
            : 'border-[color:var(--color-outline-variant)]',
          'bg-[color:var(--color-surface)]',
        )}>

          {/* Search / AI icon */}
          <span className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2',
            isRTL ? 'right-4' : 'left-4',
            focused ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--color-on-surface-variant)]',
          )}>
            {mode === 'ai'
              ? <Sparkles className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
              : <Search className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.2} />
            }
          </span>

          {/* Input */}
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(-1); }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'ai'
                ? (isRTL ? 'اسأل وفّر... مثلاً: ابي مكيف بأقل من 2000 ريال' : 'Ask Waffir... e.g. AC under 2000 SAR')
                : (isRTL ? 'ابحث عن منتج أو متجر...' : 'Search products or stores...')
            }
            dir={isRTL ? 'rtl' : 'ltr'}
            className={cn(
              'min-w-0 flex-1 bg-transparent outline-none font-semibold',
              'text-[color:var(--color-on-surface)] placeholder:text-[color:var(--color-on-surface-variant)]/60',
              compact ? 'text-[13px]' : 'text-[15px]',
              isRTL ? 'pr-12 pl-2' : 'pl-12 pr-2',
            )}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Loading indicator */}
          {loading && (
            <span className="flex shrink-0 items-center px-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)]" />
            </span>
          )}

          {/* Clear */}
          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="flex shrink-0 items-center justify-center px-2 text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-on-surface)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* AI Toggle */}
          <button type="button" onClick={() => setMode(m => m === 'text' ? 'ai' : 'text')}
            className={cn(
              'mx-1 inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all',
              mode === 'ai'
                ? 'border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                : 'border-[color:var(--color-outline-variant)] text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-primary)]',
            )}>
            <Sparkles className="h-3 w-3" />
            {mode === 'ai' ? 'AI ✓' : 'AI'}
          </button>

          {/* Submit */}
          <button type="submit"
            className={cn(
              'm-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] transition-all hover:opacity-90 active:scale-95',
              compact ? 'h-8 w-8' : 'h-10 w-10',
            )}>
            {mode === 'ai'
              ? <Sparkles className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              : <Search className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.5} />
            }
          </button>
        </div>
      </form>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div className={cn(
          'absolute inset-x-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)]',
          'bg-[color:var(--color-surface)] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.18)]',
        )}>

          {/* ── LIVE RESULTS (5 نتائج حقيقية من DB) ── */}
          {!isEmpty && results.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-on-surface-variant)]">
                  {isRTL ? 'نتائج مطابقة' : 'Matching products'}
                </span>
                <button type="button"
                  onClick={() => navigate(query)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[color:var(--color-primary)] hover:underline">
                  {isRTL ? `عرض كل النتائج` : 'View all results'}
                  <Arrow className="h-3 w-3" />
                </button>
              </div>

              <div className="px-2 pb-2">
                {results.map((product, i) => {
                  const name = isRTL ? (product.name_ar || product.name_en) : (product.name_en || product.name_ar);
                  const discount = product.original_price && product.original_price > product.best_price
                    ? Math.round(((product.original_price - product.best_price) / product.original_price) * 100)
                    : 0;

                  return (
                    <button
                      key={product.product_id}
                      type="button"
                      onClick={() => navigate(name, product.product_slug)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-colors',
                        selectedIdx === i
                          ? 'bg-[color:var(--color-primary-container)]'
                          : 'hover:bg-[color:var(--color-surface-container-low)]',
                      )}>

                      {/* Product image */}
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)]">
                        {product.image_url ? (
                          <Image src={product.image_url} alt="" fill sizes="48px"
                            className="object-contain p-1" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[color:var(--color-on-surface-variant)]">
                            <Search className="h-5 w-5 opacity-30" />
                          </div>
                        )}
                        {discount > 0 && (
                          <span className="absolute -top-1 -start-1 rounded-full bg-[color:var(--color-tertiary)] px-1.5 py-0.5 text-[9px] font-black text-[color:var(--color-on-tertiary)]">
                            -{discount}%
                          </span>
                        )}
                      </div>

                      {/* Product info */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[color:var(--color-on-surface)] leading-tight">
                          {highlightMatch(name, query)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          {/* Price */}
                          <span className="text-[13px] font-black text-[color:var(--color-primary)]">
                            {Math.round(product.best_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                            <span className="text-[10px] font-medium mr-0.5">{isRTL ? 'ر.س' : 'SAR'}</span>
                          </span>
                          {/* Original price */}
                          {product.original_price && product.original_price > product.best_price && (
                            <span className="text-[11px] text-[color:var(--color-on-surface-variant)] line-through">
                              {Math.round(product.original_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                            </span>
                          )}
                          {/* Store count */}
                          <span className="text-[10px] text-[color:var(--color-on-surface-variant)]">
                            · {product.store_count} {isRTL ? 'متاجر' : 'stores'}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <Arrow className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-on-surface-variant)] opacity-40" />
                    </button>
                  );
                })}
              </div>

              {/* View all button */}
              <button type="button" onClick={() => navigate(query)}
                className="flex w-full items-center justify-center gap-2 border-t border-[color:var(--color-outline-variant)]/50 px-4 py-3 text-[13px] font-bold text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-primary-container)]">
                <Search className="h-3.5 w-3.5" />
                {isRTL ? `عرض كل نتائج "${query}"` : `See all results for "${query}"`}
              </button>
            </div>
          )}

          {/* ── NO RESULTS ── */}
          {!isEmpty && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-[13px] font-semibold text-[color:var(--color-on-surface)]">
                {isRTL ? `ما لقينا نتائج لـ "${query}"` : `No results for "${query}"`}
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-on-surface-variant)]">
                {isRTL ? 'جرّب كلمات مختلفة أو اسأل وفّر AI' : 'Try different words or ask Waffir AI'}
              </div>
              <button type="button" onClick={() => setMode('ai')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-[12px] font-bold text-[color:var(--color-on-primary)]">
                <Sparkles className="h-3.5 w-3.5" />
                {isRTL ? 'اسأل وفّر AI' : 'Ask Waffir AI'}
              </button>
            </div>
          )}

          {/* ── ZERO STATE: Recent + Trending ── */}
          {isEmpty && (
            <div>
              {/* Recent */}
              {recentSearches.length > 0 && (
                <div className="px-3 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-on-surface-variant)]">
                      <Clock className="h-3 w-3" />
                      {isRTL ? 'بحثت مؤخراً' : 'Recent'}
                    </span>
                    <button type="button"
                      onClick={() => { localStorage.removeItem('tw_recent'); setRecentSearches([]); }}
                      className="text-[11px] text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-primary)]">
                      {isRTL ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pb-3 border-b border-[color:var(--color-outline-variant)]/50">
                    {recentSearches.map(s => (
                      <button key={s} type="button" onClick={() => { setQuery(s); navigate(s); }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-on-surface-variant)] hover:border-[color:var(--color-primary)]/40 hover:text-[color:var(--color-on-surface)] transition-colors">
                        <Clock className="h-3 w-3 opacity-50" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending */}
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-[color:var(--color-tertiary)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-on-surface-variant)]">
                    {isRTL ? 'الأكثر بحثاً الآن' : 'Trending now'}
                  </span>
                </div>
                {trending.map((item, i) => (
                  <button key={item.q} type="button"
                    onClick={() => { setQuery(item.q); navigate(item.q); }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                      selectedIdx === i
                        ? 'bg-[color:var(--color-primary-container)]'
                        : 'hover:bg-[color:var(--color-surface-container-low)]',
                    )}>
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-tertiary)] opacity-60" />
                    <span className="flex-1 text-[13px] font-semibold text-[color:var(--color-on-surface)]">{item.q}</span>
                    <span className="text-[10px] font-bold text-[color:var(--color-primary)]">{item.badge}</span>
                  </button>
                ))}
              </div>

              {/* AI prompt */}
              <div className="mx-3 mb-3 cursor-pointer rounded-xl border border-[color:var(--color-primary)]/15 bg-gradient-to-l from-[color:var(--color-primary-container)] to-transparent p-3"
                onClick={() => setMode('ai')}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[color:var(--color-on-surface)]">
                      {isRTL ? 'جرّب وفّر AI — اسأل بالعامية' : 'Try Waffir AI — ask naturally'}
                    </div>
                    <div className="text-[11px] text-[color:var(--color-on-surface-variant)]">
                      {isRTL ? 'مثل: ابي مكيف لغرفة 25 متر بأقل من 2000 ريال' : 'e.g. AC for 25m room under 2000 SAR'}
                    </div>
                  </div>
                  <span className="ms-auto rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-on-primary)]">
                    {isRTL ? 'جديد' : 'New'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
