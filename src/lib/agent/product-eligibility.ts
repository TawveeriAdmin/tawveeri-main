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

// MEASURED, EVIDENCE-BASED SIZES (2026-08-20, whitelist follow-up to the Waffar TV P0):
// extracted from real production canonical_products titles that genuinely are
// televisions but were being excluded for lacking a recognized size token — never
// guessed. 42: a real, common size gap in the original list (Dansat "DTD42BF ...
// 42-Inch Screen Size" — jumped straight from 40 to 43). 83/86/97/115: repeated,
// multi-brand real large-format model-naming conventions (LG "OLED83…"/"86QNED…",
// Samsung "QA83…"/"QA115…", TCL "115C7K", Skyworth "86…") found across dozens of
// genuine rows. Deliberately did NOT add 111 or 120: in this same dataset, 111
// appears in "111x8x64.7cm" (a physical package dimension, not a screen size) and
// 120 appears only as a refresh rate ("120Hz") on rows that already state a real
// size separately — adding either risked a false accept with no real row it would
// fix. Deliberately did NOT add 34 (a real computer-monitor size, not a TV one) —
// the evidence for excluding it: an LG 34" UltraGear, a Xiaomi 34" curved gaming
// monitor, and 3 more Samsung/LG "شاشة ألعاب/كمبيوتر" (gaming/computer monitor)
// listings were all found mislabeled category='tv' in the same audit. This list is
// a WHITELIST, not an open numeric range, specifically because of that evidence —
// broadening it to "any 2–3 digit number near an inch marker" would admit exactly
// the monitor sizes this dataset proves collide with real TV sizes.
const TV_SIZES = [32, 40, 42, 43, 48, 50, 55, 58, 60, 65, 70, 75, 77, 83, 85, 86, 97, 98, 100, 115];

/** A row is a genuine TV only if it carries a real screen size — either a structured
 *  `attributes.screen_size` or a recognized size token (the real, evidenced TV-size
 *  set above) in its own title. Returns null (ineligible) for anything else,
 *  including a product that merely matched the category by a loose title/keyword
 *  signal upstream. Category identity is a GATE here, not a hint. */
export function tvSizeOf(row: EligibilityRow): number | null {
  const a = (row.attributes ?? {}) as Record<string, unknown>;
  const structured = Number(a.screen_size);
  if (Number.isFinite(structured) && structured >= 24 && structured <= 120) return structured;
  const text = `${row.display_name_ar ?? ""} ${row.display_name_en ?? ""}`;
  const re = new RegExp(`(?:^|[^0-9])(${TV_SIZES.join("|")})\\s*(?:بوص[ةه]|انش|إنش|inch|"|-inch)?(?:[^0-9]|$)`);
  const m = norm(text).match(re);
  return m ? Number(m[1]) : null;
}
