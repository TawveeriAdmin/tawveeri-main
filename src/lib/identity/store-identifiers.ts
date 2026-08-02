// src/lib/identity/store-identifiers.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE KEY-INTEGRITY INVARIANT (ADR-058)
//
//   An identity or continuity key must derive ONLY from evidence that is stable
//   over time and independent of the observing store's internals.
//
// Violating it is silent and catastrophic: a store-internal SKU used as a
// product identity guarantees that product can never corroborate with any other
// store — or even with itself on a re-scrape — because every retailer mints its
// own. Corroboration is Tawveeri's moat (Constitution Art. III, principle 6), so
// this module is the SINGLE authority deciding which evidence may enter a key.
//
// Previously three near-duplicate `isRetailerSku` implementations lived in the
// laptop/tablet/tv plugins and diverged; none rejected Noon's `N70382194V`
// format, so 163/163 of Noon's identity keys were Noon's own SKUs.
//
// PRODUCTION EVIDENCE (2026-07-23) for the central rule below — the `sku` field
// is a store-internal identifier at EVERY store we ingest, without exception:
//   jarir   sku=670741             model=Galaxy A07        (marketing name)
//   amazon  sku=B0F62T4GWJ         model=128GB             (junk)
//   noon    sku=N70173181V         model=4G SIM Smart Watch(junk)
//   almanea sku=170100502020014    model=SM-S938BZKIMEA    (GENUINE MPN)
//   extra   modelNumber=QA75QN70FAUXSA                     (GENUINE MPN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload fields that may legitimately carry a MANUFACTURER model number.
 * `sku` is deliberately absent — it is a retailer's own identifier by
 * definition, and trusting it is exactly what poisoned Noon's identities.
 * Order is precedence: an explicit MPN beats a generic model field.
 */
const MODEL_FIELDS = ["mpn", "modelNumber", "model_number", "model"] as const;

/**
 * Known retailer identifier shapes. `sku` exclusion already covers the common
 * case; these are defence-in-depth for stores that put their own code into a
 * `model` field. Each pattern is justified by observed production data.
 */
const RETAILER_ID_PATTERNS: RegExp[] = [
  /^B0[A-Z0-9]{8}$/i,      // Amazon ASIN — B0F62T4GWJ
  /^N\d{6,10}[A-Z]$/i,     // Noon product code — N70382194V, N53421344A
  /^Z[A-Z0-9]{20,}$/i,     // Noon long-form code — Z8371A5052A760FF62718Z
  /^\d{5,}$/,              // pure numeric retailer SKU — jarir 670741, almanea 1701005…
];

/**
 * Spec fragments that are not identities. A model number never consists solely
 * of a capacity/size/power figure — Amazon supplied literal `128GB` as a
 * tablet "model", which would merge every 128GB tablet of that brand.
 */
const SPEC_ONLY_PATTERNS: RegExp[] = [
  /^\d+(\.\d+)?\s*(GB|TB|MB|KG|L|W|V|HZ|K|MAH|BTU)$/i,
  /^\d+(\.\d+)?\s*(INCH|IN|")$/i,
  /^\d+(\.\d+)?$/,         // bare number
];

/**
 * Technology/standard tokens that stores put in a `model` field. They are
 * capabilities shared by thousands of products, never identities.
 *
 * Measured harm: `MODEL:HDR10` was accepted as a Hisense and a Skyworth model
 * number and then acted as an alias bridge, fusing a mini-LED TV with a QLED TV.
 */
const STANDARD_TOKENS = new Set([
  "HDR10", "HDR10+", "HDR", "HLG", "DOLBYVISION", "DOLBYATMOS", "DTSX",
  "4K", "8K", "UHD", "FHD", "QHD", "WIFI6", "WIFI7", "BT5", "USB3", "USBC",
  "HDMI2", "TYPEC", "LED", "OLED", "QLED", "IPS", "VA", "TN", "NFC", "GPS",
]);

/**
 * Minimum length for a model number used as an IDENTITY key.
 *
 * Matches the ADR-049 model-corroboration gate. Short codes are the dangerous
 * ones: they are often truncations or spec fragments. Measured harm at 5 chars —
 * `QA65Q` (a truncated Samsung code) bridged Q6, Q7, Q8 and QN70 series TVs into
 * one product. Genuine short models (TCL `50P7K`) are lost; that is the correct
 * trade under precision-over-recall — a missed match merely defers.
 */
const MIN_MODEL_LENGTH = 6;

/**
 * True when `value` is (or looks like) an identifier minted by the observing
 * retailer rather than the manufacturer — i.e. unusable for cross-store identity.
 */
export function isStoreInternalIdentifier(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return RETAILER_ID_PATTERNS.some((re) => re.test(v));
}

/**
 * True when `value` has the structural shape of a real manufacturer model
 * number: a single compact token mixing letters and digits.
 *
 * Requiring BOTH a letter and a digit is the load-bearing rule — it rejects
 * marketing names ("Galaxy A07" also fails on whitespace) and bare numbers,
 * while admitting every genuine MPN observed in production:
 * SM-S938BZKIMEA · QA75QN70FAUXSA · MDHH4AB/A · 83K100EPAD · 27GS60QC ·
 * BRV-TB-T3PRO-CYN · KSGA18NE1 · MG1G4AH/A
 */
export function hasModelNumberShape(value: string): boolean {
  const v = value.trim();
  if (v.length < MIN_MODEL_LENGTH || v.length > 24) return false;
  if (/\s/.test(v)) return false;                      // marketing name / title fragment
  if (!/^[A-Za-z0-9][A-Za-z0-9\-/._]*$/.test(v)) return false;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return false;
  if (SPEC_ONLY_PATTERNS.some((re) => re.test(v))) return false;
  if (STANDARD_TOKENS.has(v.toUpperCase().replace(/[-._/]/g, ""))) return false;
  return true;
}

/**
 * Extract a corroboration-safe MANUFACTURER model number from a raw store
 * payload, or null when the payload carries none.
 *
 * This is the ONLY sanctioned way to derive a `MODEL:` identity key. Returning
 * null is a correct and common outcome — the caller must fall back to a spec
 * identity rather than guessing. Unknown beats incorrect (Constitution
 * principle 1).
 */
export function extractManufacturerModel(payload: Record<string, unknown>): string | null {
  for (const field of MODEL_FIELDS) {
    const raw = payload[field];
    const candidate = typeof raw === "string" ? raw.trim() : "";
    if (!candidate) continue;
    if (!hasModelNumberShape(candidate)) continue;
    if (isStoreInternalIdentifier(candidate)) continue;
    return candidate.toUpperCase();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAME-DERIVED MODEL NUMBERS (ADR-175)
//
// WHY THIS EXISTS. `extractManufacturerModel` reads the payload only. Measured
// 2026-08-02: of laptop-keyword observations absent from the knowledge layer, 45
// were correctly rejected as accessories and 166 (79%) passed detection but
// yielded NO identity — because the merchant put the model number in the TITLE and
// not in a payload field. Arabic listings are the worst hit: the family regexes are
// English-only, so «لابتوب اسوس فيفوبوك 15 X1504VA-BQ575W» loses its family AND its
// model, and a listing carrying the strongest identity signal that exists resolves
// to nothing.
//
// WHY IT IS SAFE. It reuses `hasModelNumberShape` and `isStoreInternalIdentifier` —
// it does NOT introduce a second notion of what a model number is. On top of those
// it adds ONE discriminator that the payload path never needed, because a title is
// a crowded namespace and a payload field is not:
//
//   A CPU string passes the shape guard. `i5-1334U` has a letter, a digit, no
//   whitespace and 8 characters. Extracting it as a model number would merge every
//   laptop sharing a CPU into one canonical — a false merge, which is far worse than
//   no identity (Constitution: unknown beats incorrect).
//
// The separator is DENSITY, verified against production strings:
//   X1504VA-BQ575W  14 chars · 6 letters · 7 digits  → model   ✓
//   83UR007EAD      10 chars · 5 letters · 5 digits  → model   ✓
//   U7-14ILL10      10 chars · 4 letters · 5 digits  → model   ✓
//   i5-1334U         8 chars · 2 letters · 5 digits  → CPU     ✗
//   X1-26-100        9 chars · 1 letter  · 6 digits  → CPU     ✗
//   7430U            5 chars                          → too short ✗
//
// Ties break toward the LONGEST candidate: a real MPN is longer than the noise it
// competes with. Returning null stays a correct and common outcome.

/** Tokens that are never a laptop model number even when they pass the shape guard. */
const NAME_MODEL_CPU_PATTERNS: RegExp[] = [
  /^i[3579]-\d{3,5}[A-Z]{0,2}$/i,        // i5-1334U, i7-13620H
  /^(ultra|core)?-?\d-\d{3,4}[A-Z]{0,2}$/i, // 5-120U, 7-255U
  /^[A-Z]\d-\d{2}-\d{2,3}$/i,            // X1-26-100 (Snapdragon)
  /^\d{4,5}[A-Z]{1,2}$/i,                // 7430U, 13620H
  /^(DDR\d|LPDDR\d|PCIE\d|USB\d|WIFI\d|BT\d)$/i,
];

/**
 * A number welded to a unit is a SPECIFICATION, never a model number — `14.0-inch`
 * passes the shape guard and carries 4 letters and 3 digits, so density alone lets it
 * through. Anchored at both ends so a genuine MPN that merely ENDS in a unit letter
 * (`X1504VA-BQ575W`) is untouched.
 */
const SPEC_UNIT_TOKEN = /^\d+(?:\.\d+)?[-–]?(?:inch|بوصة|gb|tb|mb|ghz|mhz|hz|cm|mm|kg|wh?|rpm|nits|bit)$/i;

/** Words that mark the following token as a CPU, not a model. */
const CPU_CONTEXT = ["معالج", "processor", "cpu", "core", "انتل", "intel", "ryzen", "رايزن", "سناب دراجون", "snapdragon", "الترا"];

/**
 * Extract a manufacturer model number from a product TITLE when the payload has
 * none. Strict by construction; null is the expected result for most titles.
 *
 * This is the second sanctioned way to derive a `MODEL:` identity key, and it is
 * deliberately narrower than the payload path.
 */
export function extractManufacturerModelFromName(name: string): string | null {
  if (!name) return null;

  // Arabic comma and common separators are token boundaries; keep -/._ inside tokens.
  const rawTokens = name.split(/[\s،,;:()[\]{}"'؛]+/).filter(Boolean);

  let best: string | null = null;
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i].replace(/[.,،؛:]+$/, "");
    if (!hasModelNumberShape(token)) continue;
    if (isStoreInternalIdentifier(token)) continue;
    if (NAME_MODEL_CPU_PATTERNS.some((re) => re.test(token))) continue;
    if (SPEC_UNIT_TOKEN.test(token)) continue;

    // Density. The CPU patterns above do the CPU work, so this only has to exclude
    // short/thin noise: >=8 chars with at least 2 letters and 3 digits. Kept at 2
    // letters because real MPNs are digit-heavy — MSI's `9S7-14J112-1024` carries
    // just two.
    const letters = (token.match(/[A-Za-z]/g) || []).length;
    const digits = (token.match(/\d/g) || []).length;
    if (token.length < 8 || letters < 2 || digits < 3) continue;

    // A token directly after a CPU word is a CPU part number, not a product model.
    const prev = (rawTokens[i - 1] || "").toLowerCase();
    if (CPU_CONTEXT.some((w) => prev.includes(w))) continue;

    if (!best || token.length > best.length) best = token;
  }
  return best ? best.toUpperCase() : null;
}
