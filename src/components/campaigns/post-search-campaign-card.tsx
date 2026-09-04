// src/components/campaigns/post-search-campaign-card.tsx
// Phase 1D — renders strictly AFTER Tawveeri's neutral search results. The parent
// (search-client.tsx) mounts this component only inside its `products.length > 0`
// branch, so it can never render before or in place of a neutral answer, and it
// never touches the products array, sort, or any ranking input — it only READS the
// top result's own id + the query's resolved category to ask the server for an
// eligible campaign (Amazon Decision Layer V2.1 — topProductId/queryText are offered
// as routing evidence only; the server independently re-verifies them).
'use client';

import { useEffect, useState } from 'react';
import type { EligibleCampaign } from '@/lib/campaigns/types';
import { CampaignCard } from './campaign-card';

export function PostSearchCampaignCard({
  locale, category, topProductId, queryText,
}: {
  locale: string;
  category: string | null;
  /** Amazon Decision Layer V2.1 — the top/most relevant result's own DB id, offered as
   *  EXACT_PRODUCT evidence. Never trusted as-is: the server re-verifies it against
   *  product_stores before it can influence a link (src/lib/campaigns/amazon-evidence.ts). */
  topProductId?: string | null;
  queryText?: string | null;
}) {
  // At most one per merchant (Phase 1C) — up to 2 cards (amazon + noon).
  const [campaigns, setCampaigns] = useState<EligibleCampaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    setCampaigns([]);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (topProductId) params.set('productId', topProductId);
    if (queryText) params.set('q', queryText);
    const qs = params.toString();
    fetch(`/api/campaigns/eligible${qs ? `?${qs}` : ''}`)
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((data: { campaigns?: EligibleCampaign[] }) => {
        if (cancelled) return;
        setCampaigns(data.campaigns ?? []);
      })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, [category, topProductId, queryText]);

  // No eligible campaign ⇒ render nothing — no broken/empty commercial shell (Phase 1C).
  if (campaigns.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} locale={locale} surface="post_search" category={category} />
      ))}
    </div>
  );
}
