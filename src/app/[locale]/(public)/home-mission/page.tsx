import type { Metadata } from "next";
import { HomeMissionClient } from "./home-mission-client";

/**
 * «جهّز بيتك بذكاء» — Home Decision Intelligence PILOT (gate GO_HOME,
 * AUDIT_REPORT_HOME §19–20). Controlled exposure (§68): direct URL only — not
 * linked from the nav/homepage, and noindexed until the founder promotes it.
 * This is a distinct MISSION surface (a multi-category plan composer), not a
 * second search entry point — the unified-search rule (P2-8) governs search,
 * and this page never answers a single-product search question.
 */
export const metadata: Metadata = {
  title: "جهّز بيتك بذكاء — توفيري",
  description:
    "صف بيتك وميزانيتك، ونحوّلها إلى خطة أجهزة مدروسة بأدلة أسعار حقيقية من متاجر السعودية.",
  robots: { index: false, follow: false },
};

export default async function HomeMissionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomeMissionClient locale={locale === "en" ? "en" : "ar"} />;
}
