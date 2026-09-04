import type { Metadata } from "next";
import { HomeMissionClient } from "./home-mission-client";
import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * «جهّز بيتك بذكاء» — Home Decision Intelligence PILOT (ADR-249; Mobile Experience
 * Pass ADR-250). Controlled exposure: direct URL only, noindexed, not in nav.
 *
 * OUTSIDE the (public) route group ON PURPOSE (Mobile Experience Pass): an active
 * mission gets a compact mission-mode header instead of the full global navigation —
 * the founder's iPhone audit measured the 481-line PublicPageShell chrome consuming
 * the first viewport of an active mission. Escape back to Tawveeri is one tap
 * (the header's back control). This is a mission surface, not a search entry point
 * (P2-8 unified-search rule untouched).
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
      "صف بيتك وميزانيتك، ونحوّلها إلى خطة أجهزة مدروسة بأدلة أسعار حقيقية من متاجر السعودية.",
    descriptionEn:
      "Describe your home and budget — we turn it into an appliance plan with real observed prices from Saudi stores.",
    locale,
    path: "/home-mission",
  });
  return {
    ...base,
    robots: { index: false, follow: false },
  };
}

export default async function HomeMissionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomeMissionClient locale={locale === "en" ? "en" : "ar"} />;
}
