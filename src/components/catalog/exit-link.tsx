'use client';
// src/components/catalog/exit-link.tsx
// ADR-286 — the plain (non-category-attributed) merchant-exit `<a>` on /compare/[key] had
// ZERO click instrumentation of any kind before this: no usage_events row, no interaction_id,
// nothing. `compare/[key]/page.tsx` is a Server Component, so this small client component
// exists for the same reason `CategoryExitLink` (category-exit-link.tsx) already does — one
// interactive surface pays for hydration, not the whole page.
import { track } from '@/lib/analytics/track';
import { recordFirstPartyInteraction, appendInteractionId } from '@/lib/analytics/interaction';

export function ExitLink({
  href,
  className,
  children,
  store,
  canonicalId,
  surface,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  store: string;
  canonicalId: string;
  surface: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        track('go_click', { canonical_id: canonicalId, store, source: surface, meta: { measured: true } });
        e.preventDefault();
        const goId = (href.match(/^\/go\/([^?]+)/) || [])[1] ?? null;
        const interactionId = recordFirstPartyInteraction({ goId, canonicalId, surface });
        window.open(goId ? appendInteractionId(href, interactionId) : href, '_blank', 'noopener,noreferrer');
      }}
    >
      {children}
    </a>
  );
}
