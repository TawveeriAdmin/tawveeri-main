'use client';

import Link from 'next/link';
import { BarChart3, Info, Store } from 'lucide-react';
import { Price } from '@/components/ui/price';

/**
 * The answer to a comparison request.
 *
 * ONE governing rule decides everything here: **a comparison link is rendered only where the
 * comparison page can genuinely fulfil it.** That was verified server-side by
 * `resolveComparisonRoute`, which asks `getComparison()` — the page's own loader — how many
 * approved-retailer offers it will actually render. This component never re-judges and never
 * constructs a `/compare/...` href of its own; it renders `compare_url` or it renders none.
 *
 * MEASURED: only 15.1% of canonicals carry offers from 2+ retailers, so the "we cannot
 * compare this" branch is the COMMON one. It is written as the main path, not an apology —
 * it still names the product, still shows the price we observed, and still says plainly why
 * the comparison is unavailable rather than leaving the shopper to infer it from an empty
 * page (Principle 3, F3).
 */

export interface EvidencedProduct {
  identity_key: string;
  name_ar: string;
  name_en: string | null;
  brand: string | null;
  category: string;
  lowest_price: number | null;
  retailer_count: number;
  compare_url: string | null;
}

export type CompareRoute =
  | { route: 'none'; reason: string }
  | { route: 'comparison'; product: EvidencedProduct; retailer_count: number; reason: string }
  | { route: 'evidence'; products: EvidencedProduct[]; unresolved: string[]; reason: string };

const nameOf = (p: EvidencedProduct, ar: boolean) => (ar ? p.name_ar : p.name_en || p.name_ar);

function ProductEvidence({ p, ar }: { p: EvidencedProduct; ar: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-3">
      <p className="text-sm font-semibold text-on-surface">{nameOf(p, ar)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {p.lowest_price != null ? (
          <span className="inline-flex items-baseline gap-1 text-xs text-on-surface-variant">
            {ar ? 'أقل سعر رصدناه' : 'Lowest price we observed'}
            <Price amount={p.lowest_price} className="text-sm font-bold text-on-surface tabular-nums" />
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant">
            {ar ? 'لم نرصد سعرًا لهذا المنتج بعد' : 'No price observed for this product yet'}
          </span>
        )}
        {/* A retailer count is only stated where a comparison page honours it (ADR-136). */}
        {p.compare_url && p.retailer_count >= 2 && (
          <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
            <Store className="h-3 w-3" aria-hidden />
            {ar ? `${p.retailer_count} متاجر` : `${p.retailer_count} retailers`}
          </span>
        )}
      </div>
      {p.compare_url && (
        <Link
          href={p.compare_url}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-300 px-3 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-950/40"
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          {ar ? 'قارن أسعار هذا المنتج' : 'Compare this product’s prices'}
        </Link>
      )}
    </div>
  );
}

export function ComparisonAnswer({ route, locale }: { route: CompareRoute; locale: string }) {
  const ar = locale === 'ar';
  if (route.route === 'none') return null;

  // ── Verified: the page will render this comparison ───────────────────────────
  if (route.route === 'comparison') {
    const p = route.product;
    return (
      <div
        data-testid="comparison-answer"
        data-compare-state="delivered"
        data-retailer-count={route.retailer_count}
        className="mb-4 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-800 dark:bg-primary-950/30"
      >
        <p className="text-sm font-semibold text-on-surface">
          {ar
            ? `يمكننا مقارنة ${nameOf(p, ar)} في ${route.retailer_count} متاجر`
            : `We can compare ${nameOf(p, ar)} across ${route.retailer_count} retailers`}
        </p>
        {p.lowest_price != null && (
          <p className="mt-1 inline-flex items-baseline gap-1 text-xs text-on-surface-variant">
            {ar ? 'ابتداءً من' : 'From'}
            <Price amount={p.lowest_price} className="text-sm font-bold text-on-surface tabular-nums" />
          </p>
        )}
        <div className="mt-3">
          <Link
            href={p.compare_url!}
            data-testid="comparison-cta"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-600 px-4 text-xs font-bold text-on-primary transition-colors hover:bg-primary-700"
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            {ar ? `افتح المقارنة (${route.retailer_count} متاجر)` : `Open the comparison (${route.retailer_count} retailers)`}
          </Link>
        </div>
      </div>
    );
  }

  // ── Understood, but not deliverable — the common case ────────────────────────
  const isPair = route.products.length + route.unresolved.length > 1;
  const explanation = ar
    ? isPair
      ? 'لا نعرض مقارنة بين منتجين مختلفين — نعرض لكل منتج ما رصدناه فعلًا من أسعار.'
      : 'لا تتوفر مقارنة لهذا المنتج: لم نرصد عروضًا من متجرين أو أكثر.'
    : isPair
      ? 'We do not put two different products side by side — here is what we actually observed for each.'
      : 'No comparison is available for this product: we have not observed offers from two or more retailers.';

  return (
    <div
      data-testid="comparison-answer"
      data-compare-state="not-deliverable"
      className="mb-4 rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-low p-4"
    >
      <p className="flex items-start gap-2 text-sm font-semibold text-on-surface">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
        {explanation}
      </p>
      {route.products.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {route.products.map((p) => <ProductEvidence key={p.identity_key} p={p} ar={ar} />)}
        </div>
      )}
      {route.unresolved.length > 0 && (
        <p className="mt-2 text-xs text-on-surface-variant">
          {ar
            ? `لم نتعرّف على: ${route.unresolved.join('، ')} — النتائج أدناه قد تساعد.`
            : `We could not identify: ${route.unresolved.join(', ')} — the results below may help.`}
        </p>
      )}
    </div>
  );
}
