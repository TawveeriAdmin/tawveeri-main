// scripts/tps-plugins/tv/parser.ts
// Deterministic TV normalization (TV Identity Contract v1). IDENTITY attributes:
// brand, screen_size, resolution, panel, refresh_rate, (manufacturer) model_number.
// NON-identity attributes carried for display/quality only: series, color.
// "لا نخمّن — نقرأ": every attribute read from the text, never inferred.
//
// TWO SOURCES, ONE VOCABULARY (2026-08-02). The parser used to read the TITLE only.
// Measured over the full low-confidence TV population (7,219 observations / 577
// listings), that lost attributes the merchant had already published:
//   · Extra declares refresh on 587/599 rows (`featureArMotionFlow` = '144 هرتز'),
//     panel on 521 (`featureArPanelType` = 'ميني ليد'), resolution on 587.
//   · Jarir states "50 Hz" in the title and the allowlist did not contain 50.
//   · 'Mini-LED' parsed as `led` (the hyphen defeats /mini\s*led/, then \bled\b
//     matched) — a WRONG value, not a missing one, and it puts a Mini-LED into the
//     same key space as a basic LED.
// So: the same vocabulary now runs over the title AND over DECLARED spec fields —
// never over description/marketing prose, where a spec word is not a claim about
// this product.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { extractManufacturerModel, extractManufacturerModelFromName, extractSizePrefixedModel } from "../../../src/lib/identity/store-identifiers";

/**
 * Payload keys that DECLARE a specification. Extra's `featureAr*` fields are its own
 * structured attributes; `specifications` is the shared adapter shape. Free-text
 * fields (description, summary, categories) are deliberately absent: "4K" inside a
 * marketing paragraph may describe upscaling, a bundled item, or nothing at all.
 */
const DECLARED_SPEC_FIELDS = [
  "featureArMotionFlow", "featureArPanelType", "featureArHdType", "featureArScreenSize",
  "specifications",
] as const;

function declaredSpecText(p: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of DECLARED_SPEC_FIELDS) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) parts.push(v);
    else if (v && typeof v === "object") { try { parts.push(JSON.stringify(v)); } catch { /* ignore */ } }
  }
  return parts.join(" | ");
}

function extractSize(text: string): number | null {
  const m = text.match(/\b(3[2-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|”|بوصة|انش|إنش)/i);
  if (m) { const n = Number(m[1]); if (n >= 19 && n <= 120) return n; }
  return null;
}
function extractResolution(text: string): string | null {
  const x = text.toLowerCase();
  if (/\b8k\b|8\s*كي/.test(x)) return "8k";
  // UHD in Arabic ('يو أتش دي', 'فائق الوضوح', 'فائق عالي الوضوح') is 4K. Ordered
  // before the plain-HD branch so 'يو أتش دي' can never fall through to `hd`.
  if (/\b4k\b|uhd|ultra\s*hd|4\s*كي|يو\s*أتش\s*دي|فائق(?:ة)?\s*(?:عالي\s*)?الوضوح|فور\s*كي/.test(x)) return "4k";
  // '2كي' is Extra's label for FHD — its own titles read "43 inch, 2K FHD".
  if (/full\s*hd|\bfhd\b|1080p?|اف\s*اتش\s*دي|2\s*كي|كامل(?:ة)?\s*الوضوح/.test(x)) return "fhd";
  if (/\bhd\b|720p?|اتش\s*دي/.test(x)) return "hd";
  return null;
}
// Panel is an identity axis (OLED ≠ QLED ≠ LED). Order: most specific first.
// Hyphen/space tolerant — 'Mini-LED', 'Mini LED' and 'MiniLED' are one panel, and
// treating them as three was a silent precision defect.
function extractPanel(text: string): string | null {
  const x = text.toLowerCase();
  if (/neo[\s-]*qled|نيو\s*كيو\s*ليد/.test(x)) return "neo_qled";
  if (/qd[\s-]*oled/.test(x)) return "oled";
  if (/\boled\b|أو\s*أل\s*إي\s*دي|او\s*ليد|أوليد/.test(x)) return "oled";
  if (/\bqned\b/.test(x)) return "qned";
  if (/nano[\s-]*cell|nanocell|نانو\s*سيل/.test(x)) return "nanocell";
  if (/(?:qd[\s-]*)?mini[\s-]*led|ميني\s*ليد/.test(x)) return "mini_led";
  if (/\buled\b/.test(x)) return "uled";
  if (/\bqled\b|كيو\s*أل\s*أي\s*دي|كيو\s*ليد/.test(x)) return "qled";
  if (/crystal|كريستال/.test(x)) return "crystal";
  // LCD is recorded as itself, never folded into `led`. A retail "LED TV" IS an LCD
  // with an LED backlight, so folding them would be defensible — and it would also
  // merge two listings on a synonym we inferred rather than read. Unknown beats
  // incorrect; a distinct value corroborates LCD with LCD and merges nothing else.
  if (/\blcd\b/.test(x)) return "lcd";
  if (/\bled\b|ال\s*إي\s*دي|\bليد\b/.test(x)) return "led";
  return null;
}
/**
 * Refresh rate. 50 is in the allowlist because Jarir states it literally
 * ("Samsung 65\" Smart TV, 4K QLED, 50 Hz") on 480 measured observations.
 *
 * `DLG`/`دي ال جي` is rejected: Extra publishes '120 هرتز دي ال جي' for Dual-Line-Gate,
 * a 120 Hz gaming MODE on a 60 Hz panel. Reading it as 120 would merge a DLG set with
 * a genuine 120 Hz panel — the same class of over-merge refresh rate exists to prevent.
 */
const REFRESH_MODE_WORDS = /vrr|memc|dlg|motion|game|boost|mode|clearmotion|trumotion|pqi|دي\s*ال\s*جي|وضع\s*الألعاب/i;

function extractRefresh(text: string): number | null {
  // A title can state several rates — TCL's `60Hz MEMC, 120Hz VRR, DLG 120Hz` states
  // three. Taking the FIRST match made the answer depend on word order, and the
  // panel's native rate is the identity axis while VRR/MEMC/DLG are gaming MODES
  // layered on top of it. So: drop any figure qualified by a mode word, and if more
  // than one distinct UNqualified rate survives, the text does not say which is the
  // panel — return null. Unknown beats incorrect (a wrong rate merges a 60 Hz set
  // with a 120 Hz one).
  // Context is scoped to the PHRASE the figure sits in, not a character window: a
  // merchant separates claims with commas, so `60 Hz, game mode 120 Hz` states a
  // 60 Hz panel and a 120 Hz mode, while `60Hz MEMC` qualifies the 60 itself.
  const found = new Set<number>();
  for (const phrase of text.split(/[,،|()\[\]–—]+/)) {
    if (REFRESH_MODE_WORDS.test(phrase)) continue;
    // EVERY figure in the phrase, not just the first — `60Hz 144Hz` with no separator
    // is still two claims, and taking the first is the word-order guess being removed.
    for (const m of phrase.matchAll(/\b(50|60|75|100|120|144|165|240)\s*(?:hz|هرتز|هيرتز)/gi)) {
      found.add(Number(m[1]));
    }
  }
  return found.size === 1 ? [...found][0] : null;
}
function extractSeries(text: string): string | null {
  // partial series/model code often present in Jarir titles (Q71Q, QNED70, P7L,
  // QN1EF). NON-identity (stores are inconsistent) — carried for display only.
  const m = text.match(/\b(Q[N]?\d[A-Z0-9]{1,4}|QNED\d{2}|P\d{1,2}[A-Z]|U\d[A-Z]\d?|C\d{3,4}|G\d)\b/);
  return m ? m[1].toUpperCase() : null;
}
function extractColor(text: string): string | null {
  const x = text.toLowerCase();
  if (/black|أسود|اسود/.test(x)) return "black";
  if (/silver|فضي/.test(x)) return "silver";
  if (/grey|gray|رمادي/.test(x)) return "gray";
  return null;
}
// Model-number extraction delegated to the single key-integrity authority
// (ADR-058) — see src/lib/identity/store-identifiers.ts.

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();
  const specText = declaredSpecText(payload);

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/samsung|سامسون|\blg\b|ال جي|sony|سوني|\btcl\b|تي سي|hisense|هايسنس|toshiba|توشيبا|nikai|نيكاي|panasonic|philips|فيليبس|dansat|دان ?سات|skyworth|haier|هاير|vision/);
    if (guess) brand = canonicalizeBrand(guess[0].trim());
  }

  // Title first (what the shopper is shown), then the merchant's declared specs.
  // A declared spec never OVERRIDES a stated title value — it only fills a gap.
  const screen_size = extractSize(fullText) ?? extractSize(specText);
  const resolution = extractResolution(fullText) ?? extractResolution(specText);
  const panel = extractPanel(fullText) ?? extractPanel(specText);
  const refresh_rate = extractRefresh(fullText) ?? extractRefresh(specText);
  const series = extractSeries(fullText);
  const color = extractColor(fullText);

  // Model number, in precedence order — payload MPN, then the title (ADR-175, already
  // proven on laptops), then a short size-prefixed code (ADR-177). Each step is a
  // narrower reader than the one before, and every one of them reads a LITERAL string.
  const model_number =
    extractManufacturerModel(payload) ??
    extractManufacturerModelFromName(fullText) ??
    extractSizePrefixedModel(payload, fullText, screen_size);

  const ambiguity_flags: string[] = [];
  if (!screen_size) ambiguity_flags.push("size_missing");
  if (!resolution) ambiguity_flags.push("resolution_missing");
  if (!panel) ambiguity_flags.push("panel_missing");

  return {
    model_number,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      screen_size, resolution, panel, refresh_rate,
      // NON-identity (display/quality only):
      series, color, smart: /smart|google tv|android tv|webos|tizen/.test(combined),
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
