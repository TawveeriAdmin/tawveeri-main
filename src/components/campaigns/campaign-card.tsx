// src/components/campaigns/campaign-card.tsx
// Shared presentational card for an eligible affiliate campaign (homepage + post-search).
// Phase 0E — deliberately visually distinct from a neutral Tawveeri result: a different
// background/border treatment (not brand-green, which every neutral surface uses), an
// always-visible disclosure badge, and NO price/availability claim of any kind — V1
// campaigns are pure text + CTA, so none of the Amazon price-sourcing/price-tracking
// compliance questions (Phase 0A) apply to this surface at all.
//
// CLICK ARCHITECTURE (final closure round §3, "B"): `campaign.merchantUrl` is the
// FINAL, already-tagged, server-built destination — this anchor points straight at
// the merchant, never at a Tawveeri redirect. A real click also fires a
// token-verified, best-effort measurement beacon to /api/campaigns/click; that call
// can fail entirely without affecting navigation, because the <a> tag's own href has
// already started it independently.
'use client';

import { useEffect, useRef } from 'react';
import type { EligibleCampaign, CampaignSurface } from '@/lib/campaigns/types';
import { track } from '@/lib/analytics/track';
import { buildModeInsightAr, buildModeInsightEn } from '@/lib/campaigns/original-value';

function sendClickBeacon(campaign: EligibleCampaign, surface: CampaignSurface, category?: string | null) {
  const payload = JSON.stringify({
    campaignId: campaign.id,
    token: campaign.clickToken,
    placement: surface,
    category: category ?? null,
    source: surface,
    // Amazon Decision Layer V2.1 §9 — echoes back exactly what this card was built
    // with; the click endpoint whitelist-validates rather than trusting it verbatim.
    destinationMode: campaign.destinationMode,
    canonicalProductId: campaign.canonicalProductId,
    reasonCode: campaign.reasonCode,
  });
  try {
    // A plain string body (not a Blob) keeps this trivially testable and still
    // parses fine server-side — Next.js route handlers' req.json() parses the raw
    // body regardless of the beacon's default text/plain content-type.
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon('/api/campaigns/click', payload);
      if (ok) return;
    }
  } catch { /* fall through to fetch */ }
  try {
    fetch('/api/campaigns/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  } catch { /* best-effort — navigation already happened via the anchor's own href */ }
}

// Brand-color accents (2026-09-09, Amazon×Noon commercial merchandising mission) — a
// TEXT/color cue for instant merchant recognition, never a copied logo asset (no new
// image pipeline, no trademarked artwork). Amazon's dark navy + its own "smile" orange,
// Noon's own signature yellow — publicly associated brand colors, not Rakhys's design.
const MERCHANT_ACCENT: Record<EligibleCampaign['merchant'], { bg: string; fg: string; badgeBg: string; badgeFg: string; name: string; nameAr: string }> = {
  amazon: { bg: '#131A22', fg: '#ffffff', badgeBg: '#FF9900', badgeFg: '#131A22', name: 'Amazon.sa', nameAr: 'أمازون' },
  noon:   { bg: '#FEEE00', fg: '#111111', badgeBg: '#111111', badgeFg: '#FEEE00', name: 'Noon', nameAr: 'نون' },
};

export function CampaignCard({
  campaign,
  locale,
  surface,
  category,
  variant = 'default',
}: {
  campaign: EligibleCampaign;
  locale: string;
  surface: CampaignSurface;
  category?: string | null;
  /** 'featured' = large, merchant-branded homepage merchandising card (Amazon×Noon
   *  mission). 'default' (unchanged) is the existing small, muted, text-only treatment
   *  already live at post-search — every existing call site keeps rendering byte-for-
   *  byte identically since this prop is optional and defaults to 'default'. */
  variant?: 'default' | 'featured';
}) {
  const isAr = locale !== 'en';
  const firedImpression = useRef(false);

  // Impression telemetry — fires once per mount (ref guard) AND is deduped again by
  // track.ts's own 1.5s window, so neither a React double-mount (StrictMode/dev) nor a
  // render-loop bug can spam campaign_impression the way search's repeat-fire bug did
  // (docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.1). This event is TELEMETRY
  // ONLY — never treated as a lead (Section 1E).
  useEffect(() => {
    if (firedImpression.current) return;
    firedImpression.current = true;
    track('campaign_impression', {
      store: campaign.merchant,
      category: category ?? undefined,
      source: surface,
      meta: { placement: surface, campaign_id: campaign.id, is_test: campaign.is_test },
    });
  }, [campaign.id, campaign.merchant, campaign.is_test, category, surface]);

  const title = isAr ? campaign.title_ar : campaign.title_en;
  const cta = isAr ? campaign.cta_ar : campaign.cta_en;
  const disclosure = isAr ? campaign.disclosure_ar : campaign.disclosure_en;
  // Amazon Decision Layer V2.1 §8 — the original-Tawveeri-value line. null when no
  // meaningful insight exists (e.g. category unrecognized) — the card just omits it
  // rather than inventing intelligence.
  const insight = isAr
    ? buildModeInsightAr(campaign.destinationMode, category ?? null)
    : buildModeInsightEn(campaign.destinationMode, category ?? null);

  if (variant === 'featured') {
    const accent = MERCHANT_ACCENT[campaign.merchant];
    const merchantName = isAr ? accent.nameAr : accent.name;
    return (
      <a
        data-testid="campaign-card"
        data-variant="featured"
        href={campaign.merchantUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          sendClickBeacon(campaign, surface, category);
          track('campaign_click', {
            store: campaign.merchant,
            category: category ?? undefined,
            source: surface,
            meta: { placement: surface, campaign_id: campaign.id },
          });
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: 132,
          background: accent.bg,
          color: accent.fg,
          borderRadius: 18,
          padding: '16px 18px',
          textDecoration: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 22,
              fontSize: 12, fontWeight: 900, color: accent.badgeFg, background: accent.badgeBg,
              borderRadius: 999, padding: '3px 10px',
            }}
          >
            {merchantName}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, whiteSpace: 'nowrap' }}>{disclosure}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4 }}>{title}</div>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 38, alignSelf: 'flex-start',
            background: accent.badgeBg, color: accent.badgeFg,
            borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 900,
          }}
        >
          {cta}
        </span>
      </a>
    );
  }

  return (
    <div
      data-testid="campaign-card"
      style={{
        background: 'var(--color-surface-container-low, #f6f4ee)',
        border: '1px dashed var(--color-outline, #c9c2b3)',
        borderRadius: 16,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--color-on-surface-variant)',
            background: 'var(--color-surface-container-high, #ece7db)',
            borderRadius: 999,
            padding: '3px 9px',
          }}
        >
          {disclosure}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)', marginBottom: insight ? 4 : 10, lineHeight: 1.5 }}>
        {title}
      </div>
      {insight && (
        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 10, lineHeight: 1.5 }}>
          {insight}
        </div>
      )}
      <a
        href={campaign.merchantUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          // Fired alongside the browser's own navigation, never blocking it — the
          // anchor's href already points directly at the merchant.
          sendClickBeacon(campaign, surface, category);
          track('campaign_click', {
            store: campaign.merchant,
            category: category ?? undefined,
            source: surface,
            meta: { placement: surface, campaign_id: campaign.id },
          });
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          background: 'var(--color-on-surface)',
          color: 'var(--color-surface)',
          borderRadius: 10,
          padding: '8px 18px',
          fontSize: 12,
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        {cta}
      </a>
    </div>
  );
}
