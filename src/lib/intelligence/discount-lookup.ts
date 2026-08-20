// src/lib/intelligence/discount-lookup.ts
// Join canonical products → their listing offers → per-listing Discount Integrity
// (tps_listing_price_facts, keyed by the observed listing URL). Lets canonical-based
// surfaces (the Advisor, product/compare pages) show the honest "real saving vs what
// we observed" signal per product. Read-only, deterministic; commission-blind.
import type { createServerClient } from "@/lib/database";
import { isMoreAuthoritative } from "./listing-currency";

export interface CanonicalDiscountIntel {
  verdict: "verified_drop" | "inflated_reference" | "stable";
  real_saving_pct: number | null;
  advertised_saving_pct: number | null;
  text: { ar: string; en: string };
  // MEASURED DEFECT (2026-08-20, Waffar TV budget-alternatives follow-up): `text_ar`/`text_en`
  // narrate a real observed price in prose (e.g. "السعر مستقر عند ~6499") that the customer
  // reads as the item's price, but until now nothing else on the Recommendation carried that
  // number structurally — a caller checking `unit_price` alone (null when
  // `tps_product_projection.lowest_price` is unpopulated) could show an item as a "suitable
  // option" while its OWN displayed text states a price far outside a stated budget. The
  // column already existed in `tps_listing_price_facts` (`current_price`) and was simply never
  // selected. Exposed here so callers can gate on the SAME number the text discloses, instead
  // of regex-parsing a rendered sentence (which is not a stable contract across verdict
  // templates).
  current_price: number | null;
}

const PRIORITY: Record<string, number> = { verified_drop: 3, inflated_reference: 2, stable: 1, insufficient_history: 0 };

/**
 * For each canonical id, the Discount Integrity verdict of the listing we observed
 * MOST RECENTLY among its offers. `insufficient_history` is dropped (we stay silent
 * without evidence).
 *
 * ADR-134: this used to pick the highest-PRIORITY verdict, ties broken by the largest
 * real_saving_pct — i.e. the most flattering claim. Where one product carries two
 * listing rows with contradictory verdicts (measured: 650 products), that published a
 * saving the customer's actual listing does not support. Freshest wins; ties go to the
 * more conservative verdict. See `listing-currency.ts`.
 */
export async function getCanonicalDiscountIntegrity(
  sb: ReturnType<typeof createServerClient>, canonicalIds: string[]
): Promise<Map<string, CanonicalDiscountIntel>> {
  const out = new Map<string, CanonicalDiscountIntel>();
  const ids = [...new Set(canonicalIds.filter(Boolean))];
  if (!ids.length) return out;

  const { data: nobs } = await sb.from("normalized_product_observations").select("canonical_product_id, normalized_payload").in("canonical_product_id", ids);
  const urlByCanon = new Map<string, Set<string>>();
  const allUrls = new Set<string>();
  for (const n of nobs ?? []) {
    const u = (n.normalized_payload as { _url?: unknown } | null)?._url;
    if (typeof u === "string" && u) {
      (urlByCanon.get(n.canonical_product_id as string) ?? urlByCanon.set(n.canonical_product_id as string, new Set()).get(n.canonical_product_id as string)!).add(u);
      allUrls.add(u);
    }
  }
  if (!allUrls.size) return out;

  type Fact = { verdict: string; last_seen: string | null; real_saving_pct: number | null; advertised_saving_pct: number | null; text_ar: string | null; text_en: string | null; current_price: number | null };
  const factByUrl = new Map<string, Fact>();
  const urls = [...allUrls];
  for (let i = 0; i < urls.length; i += 500) {
    const { data: facts } = await sb.from("tps_listing_price_facts").select("url, verdict, last_seen, real_saving_pct, advertised_saving_pct, text_ar, text_en, current_price").in("url", urls.slice(i, i + 500));
    for (const f of facts ?? []) factByUrl.set(f.url as string, f as never);
  }

  for (const [cid, us] of urlByCanon) {
    let best: Fact | null = null;
    for (const u of us) {
      const f = factByUrl.get(u); if (!f) continue;
      if (!best || isMoreAuthoritative(f, best)) best = f;
    }
    if (best && best.verdict !== "insufficient_history" && PRIORITY[best.verdict] > 0) {
      out.set(cid, { verdict: best.verdict as CanonicalDiscountIntel["verdict"], real_saving_pct: best.real_saving_pct, advertised_saving_pct: best.advertised_saving_pct, text: { ar: best.text_ar ?? "", en: best.text_en ?? "" }, current_price: best.current_price ?? null });
    }
  }
  return out;
}
