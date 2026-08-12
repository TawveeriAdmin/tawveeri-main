// scripts/tps-core/identity-projection-guards.ts
// Deterministic NEGATIVE-evidence guards for the storefront identity projection
// (ADR-242). These never create a link; they only veto one. The projection's
// positive evidence is listing equality (same store + same listing URL/ASIN);
// these guards catch the residual failure mode research topic 5 names
// "variant-in-one-URL / in-place product swap": the storefront row and the TPS
// observation reference the same listing page, but the page's content drifted
// (or hosted multiple variants) between the two scrapes.
//
// R11 — storage contradiction: when BOTH sides carry explicit, labeled storage
// tokens (e.g. "256GB", "1TB", "٢٥٦ جيجا") and the token sets are disjoint, the
// two texts describe different commercial variants → the link is vetoed.
// Labeled tokens only — a bare number is never treated as storage — and a side
// with no labeled token never vetoes (unknown beats incorrect, in both
// directions: we neither link on similarity nor block on absence of evidence).

/** Extract labeled storage sizes, normalized to GB. "1TB" → 1024. Arabic and
 *  English units. RAM-style tokens are included too — harmless, because the veto
 *  requires DISJOINT sets, and a shared value ("8GB RAM" both sides) intersects. */
export function storageTokensGb(text: string | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!text) return out;
  // Normalize Arabic-Indic digits so "٢٥٦ جيجا" is readable (ADR-153's lesson: \d
  // never matches Arabic-Indic digits).
  const t = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const tb = /(\d+(?:\.\d+)?)\s*(?:tb|تيرا(?:بايت)?)/gi;
  const gb = /(\d+(?:\.\d+)?)\s*(?:gb|جيجا(?:بايت)?)/gi;
  for (const m of t.matchAll(tb)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) out.add(Math.round(n * 1024));
  }
  for (const m of t.matchAll(gb)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) out.add(Math.round(n));
  }
  return out;
}

/** True when both texts make explicit storage claims and none agree. */
export function storageContradiction(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = storageTokensGb(a);
  const sb = storageTokensGb(b);
  if (!sa.size || !sb.size) return false;         // absence of evidence never vetoes
  for (const v of sa) if (sb.has(v)) return false; // any shared claim → compatible
  return true;
}

// ── R12 — identity-bearing query parameters must agree ─────────────────────────
// URL normalization strips query strings, but some retailers put LISTING identity
// in a query param — Jarir's `childSku` selects a product variant (the exact
// near-miss ADR-058 recorded: stripping it "merged 89 Jarir listings"). Two raw
// URLs that normalize equal but disagree on an identity-bearing param are NOT
// proven to be the same listing. One side carrying the param while the other
// does not is treated as disagreement (parent page vs variant page).
const IDENTITY_PARAMS = ["childsku", "variant", "variantid", "sku"];

export function identityParamSignature(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const qs = rawUrl.split("#")[0].split("?")[1];
  if (!qs) return null;
  const found: string[] = [];
  for (const pair of qs.split("&")) {
    const [k, v] = pair.split("=");
    if (k && IDENTITY_PARAMS.includes(k.toLowerCase()) && v) found.push(`${k.toLowerCase()}=${v}`);
  }
  return found.length ? found.sort().join("&") : null;
}

export function identityParamsDisagree(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = identityParamSignature(a);
  const sb = identityParamSignature(b);
  if (sa === null && sb === null) return false;
  return sa !== sb;
}

// ── R13 — suffixed-numeral contradiction ───────────────────────────────────────
// "Xiaomi 14T" and "Xiaomi 14" are different phones; so are Redmi 13C/13 and
// nova 14i/14. When one side carries a SUFFIXED generation token (14T) and the
// other side carries only the BARE number (14), the two texts name different
// models. Unit suffixes (5G, 8K, 1080p, 1800W, 6.5L, GB/TB…) are excluded so a
// spec token can never fire this. Standalone tokens only — a digit embedded in a
// model code (QN90D) has no word boundary and never tokenizes.
const UNIT_SUFFIXES = new Set(["g", "k", "w", "l", "ml", "hz", "mp", "mm", "cm", "in", "inch", "tb", "gb", "kg", "v", "a", "ah", "mah", "p", "d", "nit", "fps", "bit", "th"]);

function suffixedTokens(text: string): Map<string, Set<string>> {
  // number → set of suffixes seen for it (empty-string member = bare occurrence)
  const out = new Map<string, Set<string>>();
  const t = text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  for (const m of t.matchAll(/(?<![\w.])(\d{1,3})([a-z]{0,4})(?![\w.])/g)) {
    const n = m[1];
    const suf = m[2] ?? "";
    if (suf && UNIT_SUFFIXES.has(suf)) continue;
    if (!out.has(n)) out.set(n, new Set());
    out.get(n)!.add(suf);
  }
  return out;
}

export function suffixedNumeralContradiction(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ta = suffixedTokens(a);
  const tb = suffixedTokens(b);
  const oneWay = (x: Map<string, Set<string>>, y: Map<string, Set<string>>) => {
    for (const [n, sufs] of x) {
      const other = y.get(n);
      if (!other) continue;                       // number absent on other side → no claim
      for (const s of sufs) {
        if (s === "") continue;                   // bare token makes no suffix claim
        if (!other.has(s) && other.has("")) return true; // 14T vs bare 14 → different models
      }
    }
    return false;
  };
  return oneWay(ta, tb) || oneWay(tb, ta);
}

// ── R15 — shared-word numeral contradiction ────────────────────────────────────
// "Huawei nova 14" and "Huawei nova 13" share the family word but disagree on the
// bare generation number — different phones, and R13 cannot see it because no
// suffix is involved. Rule: extract (word, number) pairs where an alphabetic-ish
// word is immediately followed by a standalone numeral (unit-suffixed numerals
// are excluded — "Classic 46mm" makes no generation claim); if both sides carry
// pairs for the SAME word and their number sets are disjoint, the texts name
// different models → veto.
function wordNumberPairs(text: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  const t = text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  for (const m of t.matchAll(/(?<![\w.])([a-z؀-ۿ][\w؀-ۿ]{1,})\s+(\d{1,4})([a-z]{0,4})(?![\w.])/g)) {
    const word = m[1];
    const suf = m[3] ?? "";
    if (suf && UNIT_SUFFIXES.has(suf)) continue;   // "46mm" / "40h" claim nothing
    const n = Number(m[2]);
    if (!Number.isFinite(n)) continue;
    if (!out.has(word)) out.set(word, new Set());
    out.get(word)!.add(n);
  }
  return out;
}

export function sharedWordNumeralContradiction(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = wordNumberPairs(a);
  const pb = wordNumberPairs(b);
  for (const [w, na] of pa) {
    const nb = pb.get(w);
    if (!nb) continue;                              // word absent on other side → no claim
    let shared = false;
    for (const v of na) if (nb.has(v)) { shared = true; break; }
    if (!shared) return true;                       // same family word, disjoint numbers
  }
  return false;
}

// ── R16 — brand contradiction ──────────────────────────────────────────────────
// A storefront row must never link to a canonical carrying a DIFFERENT brand.
// Both sides go through the SAME brand authority the TPS engine uses
// (tps-core/brand-map.ts), and the guard only speaks when that authority KNOWS
// both spellings — an unmapped spelling ("Ariston", "ال جي") claims nothing.
// Measured 2026-08-12: without the both-known gate this fired 114 times, and the
// samples were overwhelmingly same-brand pairs split by an unmapped Arabic
// spelling — the exact alias-blindness ADR-022 fixed inside the matcher. The
// guard must not re-introduce it as a veto.
import { canonicalizeBrand, isKnownBrand } from "./brand-map";

export function brandContradiction(sfBrand: string | null | undefined, canonBrand: string | null | undefined): boolean {
  if (!isKnownBrand(sfBrand) || !isKnownBrand(canonBrand)) return false;
  return canonicalizeBrand(sfBrand) !== canonicalizeBrand(canonBrand);
}

// ── R14 — device-class contradiction ───────────────────────────────────────────
// Uses the platform's own high-confidence title classifier (classifyFromTitle —
// returns null when unsure, never guesses "accessories"): if the storefront
// title confidently names one device class and the canonical's category names a
// different one, the link is refused. This is how a TPS-graph misparse (an air
// fryer keyed as a mobile) is stopped from propagating to the storefront.
const SF_DEVICE_TO_CANON: Record<string, string> = {
  smartphone: "mobile", tablet: "tablet", laptop: "laptop", tv: "tv",
  monitor: "monitor", camera: "camera", smartwatch: "smartwatch",
  printer: "printer", audio: "audio", air_conditioner: "air_conditioner",
};
const CANON_DEVICE = new Set(Object.values(SF_DEVICE_TO_CANON));
const CANON_APPLIANCE = new Set([
  "air_fryer", "oven", "kettle", "blender", "toaster", "coffee_maker", "microwave",
  "vacuum", "air_purifier", "dishwasher", "washing_machine", "refrigerator",
  "appliance", "kitchen", "water_heater", "iron", "dryer", "freezer",
]);

export function deviceClassContradiction(sfTitleClass: string | null, canonCategory: string | null | undefined): boolean {
  if (!sfTitleClass || !canonCategory) return false;
  const sfDev = SF_DEVICE_TO_CANON[sfTitleClass];
  const canonIsDevice = CANON_DEVICE.has(canonCategory);
  if (sfDev && canonIsDevice) return sfDev !== canonCategory;      // two device claims must agree
  if (sfDev && CANON_APPLIANCE.has(canonCategory)) return true;    // device title vs appliance canonical
  if (!sfDev && (sfTitleClass === "kitchen" || sfTitleClass === "appliance") && canonIsDevice) return true;
  return false;                                                    // anything uninformative never vetoes
}

// ── R17 — accessory-title contradiction ────────────────────────────────────────
// A listing whose title explicitly says it is an ACCESSORY (case/cover/charger/
// strap — «كفر ايربودز برو» was the production catch: a third-party AirPods CASE
// whose TPS observation was keyed to the apple|airpods pro 2 canonical) must
// never inherit a MAIN-PRODUCT canonical. The accessory vocabulary is the
// platform's own (category-utils.isAccessoryTitle) — one list, one brain.
export function accessoryTitleContradiction(isAccessory: boolean, canonCategory: string | null | undefined): boolean {
  if (!isAccessory || !canonCategory) return false;
  return CANON_DEVICE.has(canonCategory) || CANON_APPLIANCE.has(canonCategory);
}
