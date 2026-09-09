// src/components/campaigns/merchant-offer-deals.tsx
// Merchant Affiliate Campaign Engine (Sept 2026 mission) — the deal-card grid for
// /offers/[merchant]. Deliberately reuses the SAME evidence data (getMerchantVerifiedDeals,
// which shares its ranking/eligibility logic with the homepage's getHomeVerifiedDeals —
// no second deal-selection engine) and the SAME decision-grade click-interaction pattern
// already proven on the homepage's own verified-deals strip (unified-home.tsx) —
// recordFirstPartyInteraction + appendInteractionId, not a new tracking mechanism.
'use client';

import { useEffect, useRef } from 'react';
import type { HomeVerifiedDeal } from '@/lib/intelligence/home-verified-deals';
import { recordFirstPartyInteraction, appendInteractionId } from '@/lib/analytics/interaction';
import { track } from '@/lib/analytics/track';

export function MerchantOfferDeals({
  deals,
  locale,
  merchant,
}: {
  deals: HomeVerifiedDeal[];
  locale: string;
  merchant: string;
}) {
  const isAr = locale !== 'en';
  const num = (n: number) => n.toLocaleString(isAr ? 'ar-SA' : 'en-US');
  const firedView = useRef(false);

  // campaign_page_view — mission §31's requested event, fired once per real page load.
  // Deliberately separate from the per-deal campaign_impression/click events below (a
  // page view and a deal impression answer different questions).
  useEffect(() => {
    if (firedView.current) return;
    firedView.current = true;
    track('campaign_page_view', { store: merchant, source: 'campaign_page', meta: { merchant, deal_count: deals.length } });
  }, [merchant, deals.length]);

  if (deals.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
        {isAr
          ? 'لا توجد عروض موثّقة حاليًا لهذا المتجر — تحقّق لاحقًا.'
          : 'No verified offers for this store right now — check back later.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
      {deals.map((d) => (
        <a
          key={d.url}
          href={d.href}
          {...(d.internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          onClick={d.internal ? undefined : (e) => {
            e.preventDefault();
            const goId = (d.href.match(/^\/go\/([^?]+)/) || [])[1] ?? null;
            const interactionId = recordFirstPartyInteraction({ goId, surface: 'merchant_offers_page' });
            track('deal_click', { store: merchant, source: 'campaign_page', meta: { merchant, name: d.name } });
            window.open(goId ? appendInteractionId(d.href, interactionId) : d.href, '_blank', 'noopener,noreferrer');
          }}
          style={{ textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: '14px 16px', display: 'block' }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)', lineHeight: 1.45, marginBottom: 8 }}>{d.name}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand-green-dark, #3a7a66)' }}>{num(d.price)}</span>
            <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--brand-bg-green, #eaf6f1)', color: 'var(--brand-green-dark, #3a7a66)', borderRadius: 8, padding: '3px 8px' }}>
              {isAr ? 'وفّر' : 'Save'} {num(Math.round(d.observedMax - d.price))} {isAr ? 'ريال' : 'SAR'}
            </span>
          </div>
          {/* THE EVIDENCE LINE — Tawveeri's own observation, never the merchant's "was" price. */}
          <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 8, lineHeight: 1.6 }}>
            {isAr
              ? `تتبّعنا هذا المنتج ${num(d.trackedDays)} يومًا · أعلى سعر رصدناه ${num(d.observedMax)} ريال`
              : `We tracked this product for ${num(d.trackedDays)} days · highest price we observed ${num(d.observedMax)} SAR`}
          </div>
        </a>
      ))}
    </div>
  );
}
