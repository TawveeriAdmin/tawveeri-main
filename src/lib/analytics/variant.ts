// src/lib/analytics/variant.ts
// ─────────────────────────────────────────────────────────────────────────────
// Entry-experience experiment (Founder directive: Advisor-first as DEFAULT, but proven
// against a search-first control — and reversible without a redesign). Each visitor is
// assigned ONE stable arm, persisted, so their experience is consistent across sessions
// (required to measure retention honestly). The split is config-only, so the champion can
// be changed — or the experiment ended — by flipping one env value, never a code rewrite.
//
//   advisor  = champion (deterministic evidence-ranked advisor is the landing hero)
//   search   = control  (traditional search-first storefront entry)
//
// The whole point of the founder's "change without major redesign" requirement lives here:
// the landing surface is a VALUE, not a hardcoded design.

export type EntryVariant = "advisor" | "search";

const KEY = "tw_variant";

// Fraction of NEW visitors assigned to the champion (advisor-first). Default 0.5 = a clean,
// balanced A/B with full statistical power on both arms. Raise toward 1.0 to make advisor-first
// the dominant default once/if the data supports it; set 1.0 to end the experiment on advisor,
// 0.0 to revert entirely to search-first — all config-only, no redesign.
function championSplit(): number {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BETA_ADVISOR_SPLIT : undefined;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.5;
}

/** Stable per-visitor arm. Assigns once (weighted coin flip), then persists — so retention,
 *  session-completion, and funnel metrics are all measured against a consistent experience. */
export function getEntryVariant(): EntryVariant {
  if (typeof window === "undefined") return "advisor"; // SSR default = champion (avoids control flash for the majority path)
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "advisor" || stored === "search") return stored;
    const assigned: EntryVariant = Math.random() < championSplit() ? "advisor" : "search";
    localStorage.setItem(KEY, assigned);
    return assigned;
  } catch {
    return "advisor";
  }
}

/** Force an arm (QA / founder preview): `?variant=advisor` or `?variant=search`. Persists like a real assignment. */
export function applyVariantOverrideFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const v = new URLSearchParams(window.location.search).get("variant");
    if (v === "advisor" || v === "search") localStorage.setItem(KEY, v);
  } catch { /* noop */ }
}
