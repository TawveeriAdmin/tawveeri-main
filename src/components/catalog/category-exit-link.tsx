'use client';
// src/components/catalog/category-exit-link.tsx
// Category-facet-pages mission (2026-08-25). The merchant-exit `<a>` on /compare/[key],
// instrumented ONLY when the visit is attributable to a category/facet page (via
// `withCategoryAttribution`/`readCategoryAttribution`, category-link.ts). For every other
// visitor the compare page keeps rendering the same plain, zero-JS `<a>` it always has —
// this component exists so that ONE surface, not the whole page, pays for hydration.
import type { ReactNode } from 'react';
import { track } from '@/lib/analytics/track';
import { recordFirstPartyInteraction, appendInteractionId } from '@/lib/analytics/interaction';
import type { CategoryAttribution } from '@/lib/catalog/category-link';

export function CategoryExitLink({
  href,
  className,
  children,
  attribution,
  store,
  canonicalId,
}: {
  href: string;
  className: string;
  children: ReactNode;
  attribution: CategoryAttribution;
  store: string;
  canonicalId: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        track('category_go_click', {
          canonical_id: canonicalId,
          store,
          category: attribution.category,
          source: 'category_page',
          meta: attribution.facet ? { facet: attribution.facet } : undefined,
        });
        // ADR-286 — decision-grade interaction evidence, minted synchronously in this real onClick.
        e.preventDefault();
        const goId = (href.match(/^\/go\/([^?]+)/) || [])[1] ?? null;
        const interactionId = recordFirstPartyInteraction({ goId, canonicalId, surface: 'category_page' });
        window.open(goId ? appendInteractionId(href, interactionId) : href, '_blank', 'noopener,noreferrer');
      }}
    >
      {children}
    </a>
  );
}
