import type { Metadata } from "next";
import { createServerClient } from "@/lib/database";
import { SHARE_TOKEN_RE, type ShareSnapshot } from "@/lib/agent/home-mission-share";
import { SharedPlanView } from "./shared-plan-view";

/**
 * «خطة مشتريات» viewer (ADR-257) — the capability-URL share target. Anonymous
 * viewing by design (a login wall for a spouse on WhatsApp kills the feature);
 * the token is 128-bit crypto-random; the snapshot contains no owner identity,
 * no free-typed mission text, and no owner_key. Read-only: nothing on this page
 * can mutate the owner's plan — feedback is opinion, delivered to the owner only.
 */
export const metadata: Metadata = {
  title: "خطة مشتريات — توفيري",
  description: "خطة أجهزة منزلية معدّة عبر توفيري بأدلة أسعار من متاجر السعودية.",
  robots: { index: false, follow: false },
};

export default async function SharedPlanPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await params;
  const locale = rawLocale === "en" ? "en" : "ar";

  let snapshot: ShareSnapshot | null = null;
  if (SHARE_TOKEN_RE.test(token)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServerClient() as any;
    const res = await sb.from("shared_home_plans")
      .select("snapshot, revoked_at, expires_at, view_count")
      .eq("token", token).maybeSingle();
    const row = res?.data as { snapshot: ShareSnapshot; revoked_at: string | null; expires_at: string; view_count: number } | null;
    if (row && !row.revoked_at && new Date(row.expires_at).getTime() >= Date.now()) {
      snapshot = row.snapshot;
      // Best-effort view counter — never blocks the render.
      void sb.from("shared_home_plans").update({ view_count: (row.view_count ?? 0) + 1 }).eq("token", token).then(() => {});
    }
  }

  return <SharedPlanView locale={locale} token={token} snapshot={snapshot} />;
}
