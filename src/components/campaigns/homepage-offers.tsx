'use client';

import type { EligibleCampaign } from '@/lib/campaigns/types';
import { CampaignCard } from './campaign-card';

/** Existing homepage inventory only; no merchant or attribution changes. */
export function HomepageOffers({ campaigns, locale }: { campaigns: EligibleCampaign[]; locale: string }) {
  return (
    <section id="offers" aria-labelledby="homepage-offers-title" style={{ marginTop: 34, marginBottom: 28, scrollMarginTop: 160 }}>
      <h2 id="homepage-offers-title" style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-on-surface)', margin: '0 0 16px' }}>
        {locale === 'en' ? 'Offers picked for you' : 'ركن العروض من أجلك'}
      </h2>
      <div className="homepage-offers-grid">
        {[...campaigns].sort((a, b) => Number(b.merchant === 'amazon') - Number(a.merchant === 'amazon')).map(c => (
          <CampaignCard key={c.id} campaign={c} locale={locale} surface="homepage" category={null} variant="featured" />
        ))}
      </div>
      <style>{`
        .homepage-offers-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        @media (min-width: 768px) { .homepage-offers-grid { grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); align-items: stretch; } }
        .homepage-offers-grid > :only-child { grid-column: 1 / -1; }
      `}</style>
    </section>
  );
}
