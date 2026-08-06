// src/lib/providers/campaigns/blackbox-riyal-festival.ts
// Official first-party evidence + freshness/expiry policy for Black Box's "مهرجان الريال"
// (Riyal Festival) conditional-offer campaign. See docs/BLACKBOX-RETAILER-ONBOARDING.md §15
// and ADR-219 (docs/DECISIONS.md) for the full research record.
//
// TWO INDEPENDENT EVIDENCE TIERS, never merged:
//   1. CAMPAIGN_SOURCE (below) — the retailer's own official announcement. Fixed, versioned,
//      manually updated only when a new official post is reviewed. This justifies LEVEL 2
//      wording ("this product is eligible for the campaign, exact gift varies") for any
//      product whose OWN category[] carries CAMPAIGN_CATEGORY_ID (nextjs-ssr-adapter.ts).
//   2. Per-product `free_gifts[]` (nextjs-ssr-adapter.ts, `mapFreeGiftToConditionalOffer` in
//      v1-search-helpers.ts) — structured, per-SKU, re-derived on every ingestion. This is
//      the ONLY source for an exact add-on identity/price, and none of the sampled pairs so
//      far are literally "1 SAR" (see the onboarding doc) — so LEVEL 1 ("...بريال واحد") is
//      NOT used anywhere in this codebase; only the generic, evidence-matching LEVEL 2
//      wording is, which never states a specific SAR amount it cannot prove.
//
// FRESHNESS / AUTO-EXPIRY (both tiers): no `valid_until` exists anywhere in the retailer's
// data (category `is_active` is a boolean flag, not a date). Per this task's own instruction
// not to invent a date, a conservative TTL is used instead — evidence older than the TTL
// fails closed (auto-hides) with NO manual action required. The TTL is re-armed automatically
// by the existing scheduler's normal periodic re-ingestion of store 10 (already wired via
// TPS_STORES, ADR-217) re-deriving `campaign_eligibility`/`free_gifts` fresh on every
// re-observation — if Black Box removes a product from the campaign, the very next
// re-observation simply omits the field, which is indistinguishable from (and handled by)
// ordinary TTL expiry. No new cron/service was created for this.

/** The official announcement this campaign's Level-2 eligibility wording is grounded in.
 *  PRESERVED EVIDENCE — never delete even if the post is later removed by the retailer. */
export const CAMPAIGN_SOURCE = {
  source_url: "https://x.com/blackboxksa/status/2085321446625091743",
  source_type: "first_party_official_post" as const,
  author_handle: "@blackboxksa",
  author_verified_org: true,
  published_at: "2026-08-06T11:05:50Z",
  captured_at: "2026-08-06T00:00:00Z", // date this record was authored — see git history for exact time
  text_ar:
    "مهرجان الريال 🔥 على الموعد بالصندوق الأسود!\n" +
    "اشترِ ثلاجة ، واحصل على غسالة بـ 1 ريال فقط\n" +
    "أو\n" +
    "اشترِ غسالة، واحصل على غسالة صحون بـ 1 ريال فقط\n" +
    "وقسّطها بالطريقة اللي تناسبك\n" +
    "✅ تقسيط بنكي حتى 12 شهر\n" +
    "✅ إمكان أو مدفوع حتى 6 دفعات\n" +
    "✅ تمارا حتى 12 دفعة\n" +
    "تسوق الان",
  campaign_link_shortened: "https://bit.ly/45iKJ4k",
  campaign_link_resolved:
    "https://www.blackbox.com.sa/riyal-festival-c-1133/home-appliances-offers-c-1134",
  /** No end date found anywhere in first-party evidence — see FRESHNESS note above. */
  valid_until: null as string | null,
} as const;

/** No reliable end date exists (see CAMPAIGN_SOURCE.valid_until) — a conservative TTL stands
 *  in its place. 72h: long enough to survive a normal scheduler cadence gap, short enough that
 *  a removed/changed campaign can't linger publicly for days on stale evidence. */
export const CAMPAIGN_FRESHNESS_TTL_HOURS = 72;

/** True iff campaign-related evidence captured at `evidenceAt` is still fresh enough to
 *  display, given `now`. Pure — no clock reads, so it's exactly testable. */
export function isCampaignEvidenceFresh(evidenceAt: string | null | undefined, now: Date): boolean {
  if (!evidenceAt) return false;
  const t = Date.parse(evidenceAt);
  if (!Number.isFinite(t)) return false;
  const ageHours = (now.getTime() - t) / (1000 * 60 * 60);
  return ageHours >= 0 && ageHours < CAMPAIGN_FRESHNESS_TTL_HOURS;
}

export interface CampaignEligibilityEvidence {
  eligible: true;
  campaign_category_id: number;
  source: "category_membership";
  /** Level 2 wording — never claims a specific SAR amount or gift identity this tier can't prove. */
  message_ar: string;
  message_en: string;
  official_source_url: string;
  last_verified_at: string;
}

/** Maps a raw `specifications.campaign_eligibility` marker (see nextjs-ssr-adapter.ts) +
 *  its observation's own scrape time into public-safe Level-2 evidence, or null if the
 *  evidence has gone stale (TTL) or was never present. Pure — safe to unit test. */
export function deriveCampaignEligibility(
  raw: { campaign_category_id?: number } | null | undefined,
  scrapedAt: string | null,
  now: Date,
): CampaignEligibilityEvidence | null {
  if (!raw?.campaign_category_id) return null;
  if (!isCampaignEvidenceFresh(scrapedAt, now)) return null;
  return {
    eligible: true,
    campaign_category_id: raw.campaign_category_id,
    source: "category_membership",
    message_ar: "هذا المنتج مؤهل لعرض الريال من الصندوق الأسود. تختلف الهدية والموديل حسب شروط المتجر.",
    message_en: "This product is eligible for Black Box's Riyal offer. The exact gift and model vary by the retailer's terms.",
    official_source_url: CAMPAIGN_SOURCE.campaign_link_resolved,
    last_verified_at: scrapedAt as string,
  };
}
