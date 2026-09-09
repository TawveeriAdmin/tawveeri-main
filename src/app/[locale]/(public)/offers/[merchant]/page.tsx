// src/app/[locale]/(public)/offers/[merchant]/page.tsx
// Merchant Affiliate Campaign Engine (Sept 2026 mission) — ONE reusable, evergreen
// per-merchant offers page. NOT hard-coded to Amazon/Noon/National Day: `merchant` is a
// route param resolved against the existing provider registry (src/lib/providers), and
// any seasonal claim is data (affiliate_campaigns.official_claim_*, campaign_page
// placement), never a branch in this file. A future third affiliate merchant reaches
// this same page the moment its provider config + one enabled campaign row exist — no
// new page, no new route.
//
// Reuses, never duplicates:
//   - merchant identity + branding: getProvider() (src/lib/providers) + MERCHANT_ACCENT
//     (src/components/campaigns/campaign-card.tsx) — the SAME colors as the homepage cards.
//   - campaign eligibility/claim gate: getCampaignPageHero() (src/lib/campaigns/store.ts),
//     which reuses getEligibleCampaigns() unchanged (kill switch, allowlist, window,
//     claim-guard, destination validation, exposure logging).
//   - deal evidence/ranking: getMerchantVerifiedDeals() (src/lib/intelligence/
//     home-verified-deals.ts), the SAME verified-drop logic the homepage's "أفضل
//     العروض" strip already uses — no second deal-selection engine.
//
// OFFER TRUTH MODEL (mission §20): the hero renders the MERCHANT'S OWN official_claim_*
// ONLY when claim_verified_at is set (getCampaignPageHero enforces this) — otherwise a
// generic, honest "current offers" framing, identical in spirit to the homepage's
// already-shipped Amazon/Noon cards. Deal cards show ONLY Tawveeri's own independently-
// computed evidence (observed price history), never a merchant "was" price.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { getProvider } from '@/lib/providers';
import { getCampaignPageHero } from '@/lib/campaigns/store';
import { MERCHANT_ACCENT } from '@/lib/campaigns/merchant-accent';
import { getMerchantVerifiedDeals } from '@/lib/intelligence/home-verified-deals';
import { MerchantOfferDeals } from '@/components/campaigns/merchant-offer-deals';
import type { CampaignMerchant } from '@/lib/campaigns/types';

function isKnownCampaignMerchant(slug: string): slug is CampaignMerchant {
  return slug === 'amazon' || slug === 'noon';
}

// Live evidence (price-history, campaign eligibility) — never statically cached across
// requests, same convention as /api/search and the other server-fetched surfaces in
// this codebase.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; merchant: string }> }): Promise<Metadata> {
  const { locale, merchant } = await params;
  const provider = getProvider(merchant);
  const isAr = locale !== 'en';
  if (!provider || !provider.affiliate) return { title: isAr ? 'غير موجود' : 'Not found' };
  const name = isAr ? provider.displayNameAr : provider.displayName;
  return {
    title: isAr ? `عروض ${name} — توفيري` : `${name} offers — Tawveeri`,
    description: isAr
      ? `عروض ${name} الحالية على توفيري، مدعومة بسجل أسعار حقيقي رصدناه نحن — لا بوعود المتجر.`
      : `Current ${name} offers on Tawveeri, backed by price history we actually observed — not the merchant's own claim.`,
  };
}

export default async function MerchantOffersPage({ params }: { params: Promise<{ locale: string; merchant: string }> }) {
  const { locale, merchant: merchantSlug } = await params;
  const isAr = locale !== 'en';
  const provider = getProvider(merchantSlug);
  // Not every registered store is monetized (mission §11 — "a merchant can exist
  // without affiliate monetization"); this page only ever serves an affiliate-enabled
  // merchant, by construction, never by a hard-coded slug check.
  if (!provider || !provider.affiliate || !isKnownCampaignMerchant(merchantSlug)) notFound();

  const merchantName = isAr ? provider.displayNameAr : provider.displayName;
  const accent = MERCHANT_ACCENT[merchantSlug];

  const [hero, deals] = await Promise.all([
    getCampaignPageHero(merchantSlug),
    getMerchantVerifiedDeals(merchantSlug, 12, locale),
  ]);

  const heroClaim = hero ? (isAr ? hero.official_claim_ar : hero.official_claim_en) : null;
  const heroTitle = isAr ? accent.nameAr : accent.name;
  const genericFraming = isAr
    ? `عروض ${merchantName} الحالية على توفيري`
    : `Current ${merchantName} offers on Tawveeri`;

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div
          style={{
            background: accent.bg, color: accent.fg, borderRadius: 20,
            padding: '24px 20px', marginBottom: 20,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, fontSize: 22, fontWeight: 900,
              color: accent.iconFg, background: accent.iconBg, borderRadius: 12, marginBottom: 12,
            }}
          >
            {accent.iconLetter}
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.3 }}>{heroTitle}</h1>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0, opacity: 0.92, lineHeight: 1.6 }}>
            {heroClaim || genericFraming}
          </p>
          {hero && (
            <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginTop: 10 }}>
              {isAr ? hero.disclosure_ar : hero.disclosure_en}
              {hero.official_claim_source ? ` · ${hero.official_claim_source}` : ''}
            </p>
          )}
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--color-on-surface)', margin: '0 0 12px' }}>
          {isAr ? 'عروض موثّقة بالأدلة' : 'Evidence-backed offers'}
        </h2>
        <MerchantOfferDeals deals={deals} locale={locale} merchant={merchantSlug} />
      </div>
    </PublicPageShell>
  );
}
