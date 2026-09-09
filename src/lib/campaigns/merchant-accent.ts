// src/lib/campaigns/merchant-accent.ts
// Shared brand-color identity for Amazon/Noon (Sept 2026 Amazon×Noon commercial
// merchandising mission; extended for the Merchant Affiliate Campaign Engine mission).
// Deliberately its own plain module (NOT inside campaign-card.tsx, a 'use client'
// component) so SERVER components (src/app/[locale]/(public)/offers/[merchant]/page.tsx)
// can import it directly without crossing a client-component module boundary — a TEXT/
// color cue for instant merchant recognition, never a copied logo asset (no new image
// pipeline, no trademarked artwork). Amazon's dark navy + its own "smile" orange, Noon's
// own signature yellow — publicly associated brand colors, not a pixel copy of any
// reference site's own design.
import type { CampaignMerchant } from './types';

export const MERCHANT_ACCENT: Record<CampaignMerchant, {
  bg: string; fg: string; badgeBg: string; badgeFg: string; name: string; nameAr: string;
  iconBg: string; iconFg: string; iconLetter: string;
}> = {
  amazon: {
    bg: '#131A22', fg: '#ffffff', badgeBg: '#FF9900', badgeFg: '#131A22', name: 'Amazon.sa', nameAr: 'أمازون',
    iconBg: '#ffffff', iconFg: '#131A22', iconLetter: 'a',
  },
  noon: {
    bg: '#FEEE00', fg: '#111111', badgeBg: '#111111', badgeFg: '#FEEE00', name: 'Noon', nameAr: 'نون',
    iconBg: '#111111', iconFg: '#FEEE00', iconLetter: 'ن',
  },
};
