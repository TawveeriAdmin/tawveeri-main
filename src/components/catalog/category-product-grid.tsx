// src/components/catalog/category-product-grid.tsx
// Product-card grid shared between /categories/[slug] (ADR-226) and the new
// /categories/[slug]/[facet] tier (2026-08-25) — same card markup, same data shape
// (`CategoryProductSummary`), extracted so the facet page doesn't duplicate it.
//
// `category`/`facet` (2026-08-25, category-facet-pages analytics mission): every card link
// carries `?src=category&category=...[&facet=...]` so a later merchant-exit click on
// /compare/[key] can be attributed back to the page that sent the visitor there — see
// category-link.ts and category-exit-link.tsx for the read side.
import Link from 'next/link';
import { Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import type { CategoryProductSummary } from '@/lib/catalog/getCategoryOverview';
import { withCategoryAttribution } from '@/lib/catalog/category-link';

export function CategoryProductGrid({
  products,
  locale,
  isAr,
  category,
  facet = null,
}: {
  products: CategoryProductSummary[];
  locale: string;
  isAr: boolean;
  category: string;
  facet?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {products.map((p) => {
        const displayName = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
        return (
          <Link
            key={p.identityKey}
            href={`/${locale}${withCategoryAttribution(p.compareUrl, category, facet)}`}
            className="flex flex-col rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-4 transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
          >
            <div className="flex items-start justify-between gap-2">
              {p.brand && <Badge variant="outline" className="text-[11px]">{p.brand}</Badge>}
              <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                <Store className="h-3 w-3" />
                {isAr ? `${p.storeCount} متاجر` : `${p.storeCount} stores`}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-on-surface line-clamp-2 min-h-[2.5rem]">
              {displayName}
            </p>
            {p.lowestPrice != null && (
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[11px] text-on-surface-variant">{isAr ? 'من' : 'from'}</span>
                <Price amount={p.lowestPrice} className="text-lg font-extrabold text-[var(--brand-green-dark)]" symbolClassName="w-4 h-4" />
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
