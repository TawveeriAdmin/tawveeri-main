'use client';

// Universal analytics bootstrap (ADR-244, Gate A). Mounted ONCE in the root layout so
// EVERY landing page captures test-mode and campaign attribution — before this, capture
// ran on only three page components (landing, search, product detail), so a social link
// pointing at /compare/[key], /categories/*, /deals or /stores silently lost its UTM
// attribution. A comparison page is a PRIMARY social landing target (the UTM convention's
// own examples point at /compare/), which made this the largest attribution hole.
// Renders nothing; never throws; runs after hydration only.
import { useEffect } from 'react';
import { initTestModeFromUrl, sessionId } from '@/lib/analytics/track';
import { initCampaignFromUrl } from '@/lib/analytics/campaign';

export function CampaignCapture() {
  useEffect(() => {
    try {
      initTestModeFromUrl();
      initCampaignFromUrl();
      // Ensures the tw_sid cookie mirror exists even before the first tracked event,
      // so a visitor whose very first click is a /go exit still carries session identity.
      sessionId();
    } catch { /* best-effort */ }
  }, []);
  return null;
}
