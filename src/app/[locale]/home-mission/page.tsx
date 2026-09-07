import type { Metadata } from "next";
import { HomeMissionClient } from "./home-mission-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * «جهّز بيتك بذكاء» — Home Decision Intelligence (ADR-249 original pilot gate; ADR-250
 * Mobile Experience Pass; ADR-301 PUBLIC PROMOTION).
 *
 * LIFECYCLE: launched noindexed/unlisted (ADR-249, 2026-08-15) while the multi-category,
 * shared-budget planning flow was unproven — no comparable product globally had shipped
 * this successfully, and the founder's own gate required controlled exposure until the
 * flow was measured working end-to-end. ADR-301 (2026-09-07) promotes it to a public,
 * indexable strategic capability: the flow is production-verified working end-to-end
 * (intake → mission card → real multi-category plan with real prices), and the founder
 * decided it is no longer a pilot. This is a deliberate reversal, not a correction of a
 * past mistake — the original noindex was the right call for an unproven flow, and this
 * is the right call now that it is proven.
 *
 * OUTSIDE the (public) route group ON PURPOSE (Mobile Experience Pass): an active
 * mission gets a compact mission-mode header instead of the full global navigation —
 * the founder's iPhone audit measured the 481-line PublicPageShell chrome consuming
 * the first viewport of an active mission. Escape back to Tawveeri is one tap
 * (the header's back control). This is a mission surface, not a search entry point
 * (P2-8 unified-search rule untouched). Being outside `(public)` never implied noindex —
 * the two are independent; only the explicit `robots` field below ever controlled that.
 *
 * 2026-09-04: generateMetadata so canonical/og:url are /{locale}/home-mission —
 * previously inherited locale-layout homepage canonical (/ar), which polluted share cards.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = buildPageMetadata({
    titleAr: "جهّز بيتك بذكاء — توفيري",
    titleEn: "Smart home setup — Tawveeri",
    descriptionAr:
      "صف بيتك وميزانيتك بكلامك، ونحوّلها إلى خطة أجهزة منزلية — بمقارنة أسعار حقيقية بين متاجر السعودية على كل جهاز.",
    descriptionEn:
      "Describe your home and budget in your own words — we turn it into an appliance plan, comparing real observed prices across Saudi stores for every device.",
    locale,
    path: "/home-mission",
  });
  return {
    ...base,
    // ADR-301 (2026-09-07): promoted from the ADR-249 pilot gate to a public, indexable
    // strategic capability. See the file-level comment above for the full lifecycle note.
    robots: { index: true, follow: true },
  };
}

export default async function HomeMissionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomeMissionClient locale={locale === "en" ? "en" : "ar"} />;
}
