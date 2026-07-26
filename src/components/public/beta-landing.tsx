'use client';

// BetaLanding — the reversible entry router. Assigns the visitor's arm (advisor|search),
// records landing engagement (with the arm in meta.variant, via track()), and renders the
// matching home. SSR renders a neutral placeholder; the arm is chosen on mount so there is
// no hydration mismatch. Switching the champion — or ending the experiment — is a config
// change to NEXT_PUBLIC_BETA_ADVISOR_SPLIT (see variant.ts); this component never changes.

import { useEffect, useState } from 'react';
import { AdvisorHome } from './advisor-home';
import { SearchHome } from './search-home';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';
import { getEntryVariant, applyVariantOverrideFromUrl, type EntryVariant } from '@/lib/analytics/variant';

export function BetaLanding({ locale }: { locale: string }) {
  const [variant, setVariant] = useState<EntryVariant | null>(null);

  useEffect(() => {
    initTestModeFromUrl();          // ?test=1 opt-in (QA/founder), keeps test traffic out of validation
    applyVariantOverrideFromUrl();  // ?variant=advisor|search preview override
    const v = getEntryVariant();
    setVariant(v);
    track('landing_view', { source: 'landing', category: null, meta: { variant: v } });
  }, []);

  if (variant === null) {
    // Minimal, theme-aware placeholder for the first paint (arm resolves on mount).
    return <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-surface-variant)' }} aria-busy="true" />;
  }
  return variant === 'advisor' ? <AdvisorHome locale={locale} /> : <SearchHome locale={locale} />;
}
