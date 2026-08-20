// src/lib/agent/product-eligibility.ts
//
// Shared, category-agnostic product-eligibility signal checks. Single source of
// truth for logic that decides whether a canonical row's own attributes/title
// genuinely support the category it is filed under — used as a HARD GATE, not a
// ranking signal: a row that fails an eligibility check here must never reach
// scoring, `smart_pick`, or a recommendation list, regardless of price or trust.
//
// MEASURED DEFECT (2026-08-20, Waffar TV P0): this check previously existed only
// inside `home-mission.ts`'s local `eligibleRows()`, protecting Home Mission — but
// `/api/v1/agent/decide` (Waffar) built its candidate rows straight from
// `canonical_products`/`tps_product_projection` with NO equivalent filter, so a
// mislabeled row (8 Funko Pop figures + 3 Oraimo smartwatches, wrongly written as
// category='tv' by an ingestion-side bug — since fixed, see tps-plugins/tv/detector.ts)
// could reach `decideTv()`, score, and surface as `smart_pick` with a real `go_url`.
// Reproduced live: a 79 SAR Funko Pop figure was Waffar's #1 "smart pick" TV for a
// 250 SAR budget query. One shared implementation now backs BOTH call sites — do not
// re-fork a local copy for a third surface; import from here instead.

/** Structural minimum this module needs — deliberately NOT importing `CanonicalRow`
 *  from decision-engine.ts to avoid a circular import (decision-engine.ts also calls
 *  into this file). `CanonicalRow` and Home Mission's row type both satisfy this
 *  shape already. */
export interface EligibilityRow {
  display_name_ar?: string | null;
  display_name_en?: string | null;
  attributes?: Record<string, unknown> | null;
}

// Same digit-folding `norm()` home-mission.ts used locally (Arabic-Indic/Eastern
// digits → ASCII, lowercase, strip Arabic thousand separators) — kept byte-identical
// so moving the caller here changes nothing about which titles match.
const ARABIC_INDIC = /[٠-٩۰-۹]/g;
const asciiDigits = (t: string) =>
  t.replace(ARABIC_INDIC, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
const norm = (t: string) => asciiDigits((t || "").toLowerCase()).replace(/٬/g, "");

/** A row is a genuine TV only if it carries a real screen size — either a structured
 *  `attributes.screen_size` or a recognized size token (32"–120", the real TV range)
 *  in its own title. Returns null (ineligible) for anything else, including a
 *  product that merely matched the category by a loose title/keyword signal
 *  upstream. Category identity is a GATE here, not a hint. */
export function tvSizeOf(row: EligibilityRow): number | null {
  const a = (row.attributes ?? {}) as Record<string, unknown>;
  const structured = Number(a.screen_size);
  if (Number.isFinite(structured) && structured >= 24 && structured <= 120) return structured;
  const text = `${row.display_name_ar ?? ""} ${row.display_name_en ?? ""}`;
  const m = norm(text).match(/(?:^|[^0-9])(32|40|43|48|50|55|58|60|65|70|75|77|85|98|100)\s*(?:بوص[ةه]|انش|إنش|inch|"|-inch)?(?:[^0-9]|$)/);
  return m ? Number(m[1]) : null;
}
