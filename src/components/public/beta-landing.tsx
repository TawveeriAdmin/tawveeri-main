'use client';

// BetaLanding — the reversible entry router. Assigns the visitor's arm (advisor|search),
// records landing engagement (with the arm in meta.variant, via track()), and renders the
// matching home. SSR renders a neutral placeholder; the arm is chosen on mount so there is
// no hydration mismatch. Switching the champion — or ending the experiment — is a config
// change to NEXT_PUBLIC_BETA_ADVISOR_SPLIT (see variant.ts); this component never changes.

import { useEffect } from 'react';
import { UnifiedHome } from './unified-home';
import type { HomeVerifiedDeal } from '@/lib/intelligence/home-verified-deals';
import type { EligibleCampaign } from '@/lib/campaigns/types';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';
import { initCampaignFromUrl } from '@/lib/analytics/campaign';
import { getEntryVariant, applyVariantOverrideFromUrl } from '@/lib/analytics/variant';

// The advisor-first vs search-first entry A/B (ADR-121) is superseded by the Founder's explicit
// unified-home design (Search → وفّر → Hero → Categories → Deals), which combines both in one
// natural order. We keep landing_view + the variant tag firing for funnel continuity; everyone now
// sees the single UnifiedHome. The variant infra remains available for future experiments.
export function BetaLanding({
  locale,
  deals = [],
  campaigns = [],
}: {
  locale: string;
  deals?: HomeVerifiedDeal[];
  campaigns?: EligibleCampaign[];
}) {
  useEffect(() => {
    initTestModeFromUrl();
    initCampaignFromUrl();
    applyVariantOverrideFromUrl();
    track('landing_view', { source: 'landing', category: null, meta: { variant: getEntryVariant() } });
  }, []);

  return <UnifiedHome locale={locale} deals={deals} campaigns={campaigns} />;
}
