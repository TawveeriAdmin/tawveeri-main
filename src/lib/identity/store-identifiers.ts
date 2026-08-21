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
 * A spec figure welded into a token is a SPECIFICATION, never a model number.
 * Measured over TV titles (2026-08-02, full staging population): `65LCS120HZ` ×33,
 * `DTD55QLED120HZ`, `DTQ85QLED144.HZ`, `HSR120HZ`, `144/288HZ` all satisfy the density
 * rule and would each have become an identity.
 */
const SPEC_COMPOUND_TOKEN = /\d+\.?\s*HZ$/i;

/**
 * Two models joined by a slash — a retailer listing a PAIR of products, not one
 * product's MPN. Measured: `98Q6C/98C6K`, `85C6K/85Q6C`, `EVOQ75QLC/EVOQ75S4QLC2`,
 * `UHD65SLED/UHD65SLED-FL`, `NTV5000SLED/NTV5000SLED3`. Apple's genuine slash form
 * (`MDHH4AB/A`, `MG1G4AH/A`) has a ONE-character suffix and is untouched.
 */
const DUAL_MODEL_SLASH = /^[A-Za-z0-9._-]{3,}\/[A-Za-z0-9._-]{3,}$/;

/**
 * A slash pair whose LEFT side is a memory/spec standard is a SPECIFICATION, whatever
 * its right side looks like. `DDR5/512` slipped through the length rule — 512 is three
 * characters — and was live in staging as `dell|MODEL:DDR5/512`. The cross-tier merge
 * dry run then proposed folding 489 observations into it, which would have compared every
 * Dell laptop carrying DDR5 and a 512 GB disk as one product. Caught before any write.
 */
const SPEC_LEAD_SLASH = /^(DDR\d|LPDDR\d|PROCESSOR|CPU|GPU|RAM|SSD|HDD|EMMC|NVME|WIFI\d?|USB\d?|HDMI\d?)\b/i;

/**
 * Memory/bus standards as a WHOLE token. `LPDDR5` satisfies every shape rule — six
 * characters, letters and digits, no whitespace — and was live as `acer|MODEL:LPDDR5`.
 * STANDARD_TOKENS is an exact-match set and cannot express the family, so this is the
 * pattern form of the same idea.
 */
const MEMORY_STANDARD_TOKEN = /^(LP)?DDR\d[A-Z]?$/i;
const SIZE_PREFIXED_MODEL = /^(\d{2,3})([A-Z][A-Z0-9]{1,3})$/;

/**
 * P4 (2026-08-21): `DUAL_MODEL_SLASH` only rejects a slash pair when BOTH sides are
 * >=3 characters, so a RAM/Storage spec whose bare-number side is short escapes it —
 * `16/256GB` (left side "16", 2 chars), `8/512GB` (left side "8", 1 char) were both live
 * as `MODEL:` identities. Order-agnostic (the bare number can be on either side) and
 * length-agnostic by construction: it asks what each side IS, not how long it is, so a
 * longer bare number (`128/256GB`) that DUAL_MODEL_SLASH already happens to catch is
 * caught here too, redundantly but harmlessly.
 */
const BARE_NUMBER = /^\d+(\.\d+)?$/;
const NUMBER_WITH_UNIT = SPEC_ONLY_PATTERNS[0];

function isRamStorageSlashPair(left: string, right: string): boolean {
  return (BARE_NUMBER.test(left) && NUMBER_WITH_UNIT.test(right)) ||
         (BARE_NUMBER.test(right) && NUMBER_WITH_UNIT.test(left));
}

/** True when a token is a spec compound or a slash-joined pair rather than one MPN. */
function isNotASingleModel(value: string): boolean {
  const v = value.trim();
  if (SPEC_COMPOUND_TOKEN.test(v) || DUAL_MODEL_SLASH.test(v)) return true;
  if (MEMORY_STANDARD_TOKEN.test(v)) return true;
  if (v.includes("/") && SPEC_LEAD_SLASH.test(v)) return true;

  const slashParts = v.split("/");
  // P4: a retailer stringing multiple specs together with slashes (`GEN/10-CORE/16GB`)
  // is never a single MPN — `DUAL_MODEL_SLASH` is anchored for exactly one slash and
  // its character class excludes "/", so a second slash makes the whole regex miss
  // entirely rather than partially match. No genuine MPN observed anywhere in this
  // module's evidence carries more than one slash (Apple's own form has exactly one).
  if (slashParts.length > 2) return true;
  if (slashParts.length === 2 && isRamStorageSlashPair(slashParts[0], slashParts[1])) return true;
  return false;
}

/**
 * The authority's own verdict on a string already being used as a `MODEL:` identity.
 *
 * Exported because a consumer that MERGES identity classes must be able to refuse a
 * target key that was written before a guard existed — staging holds keys minted by
 * older rules, and a merge amplifies a bad one across every listing it touches.
 */
export function isUsableModelIdentity(value: string): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (isStoreInternalIdentifier(v) || isNotASingleModel(v)) return false;
  // The ADR-177 size-prefixed form (`85P8L`) is 4–5 chars and so fails the global
  // minimum by design; it is a complete model and a valid merge target.
  return hasModelNumberShape(v) || SIZE_PREFIXED_MODEL.test(v.toUpperCase());
}

/**
 * Marketing words some merchants weld onto the front of a real MPN.
 * Measured: LuLu publishes `SMART-UA65U8000HUXSA` while three other stores publish
 * `UA65U8000HUXSA` — the same TV, unable to meet itself because of one prefix.
 *
 * Deliberately a CLOSED list of non-model words, not a general "strip up to the first
 * hyphen" rule: `BRV-TB-T3PRO-CYN` and `SM-S938BZKIMEA` are genuine MPNs whose leading
 * segment is part of the identity, and a general rule would silently truncate them.
 */
const MARKETING_PREFIXES = new Set(["SMART", "TV", "LED", "NEW", "ORIGINAL", "MODEL", "SCREEN"]);

/**
 * Remove a marketing prefix when what remains is itself a full-strength model number.
 * Conservative by construction: if the remainder is not clearly an MPN on its own, the
 * original string is returned untouched.
 */
function stripMarketingPrefix(value: string): string {
  const i = value.indexOf("-");
  if (i <= 0) return value;
  const head = value.slice(0, i).toUpperCase();
  const tail = value.slice(i + 1);
  if (!MARKETING_PREFIXES.has(head)) return value;
  const letters = (tail.match(/[A-Za-z]/g) || []).length;
  const digits = (tail.match(/\d/g) || []).length;
  if (tail.length < 8 || letters < 2 || digits < 3) return value;
  if (!hasModelNumberShape(tail) || isStoreInternalIdentifier(tail) || isNotASingleModel(tail)) return value;
  return tail;
}

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
    if (isNotASingleModel(candidate)) continue;
    return stripMarketingPrefix(candidate.toUpperCase());
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORT MODELS — a naming CONVENTION test, not a lower threshold (ADR-177)
//
// `MIN_MODEL_LENGTH = 6` exists because `QA65Q` — a truncation of QA65Q8FAAUXSA —
// bridged Q6/Q7/Q8/QN70 into one product. That harm is real and this module keeps
// rejecting it. But the same rule discards `85P8L` and `65C8K`, which are COMPLETE
// TCL/Hisense model numbers, and it did so for 1,432 measured observations.
//
// MEASURED, before writing this (scripts/tps-analysis/short-model-prefix-audit.ts,
// 2026-08-02, 107 distinct store+model pairs over the full TV catalogue), applying
// the founder's test — "a short string that is a PREFIX of a longer model elsewhere
// in that retailer's catalogue is a truncation":
//
//   Almanea   13 short models   0 truncations    85Q6C 98P8L 75U7Q 85C7L …
//   Extra     73 short models   4 truncations    (all four are `X ⊂ X+PRO`, i.e. a
//                                                 real model that happens to prefix
//                                                 a real Pro variant)
//   Amazon    21 short models  14 truncations    UA43F ⊂ UA43F6000FUXSA, QA75Q ⊂ …
//
// THE DISCRIMINATOR IS NOT THE RETAILER'S NAME — IT IS THE SHAPE OF ITS CONVENTION,
// and that is a stronger rule than a per-retailer allowlist: it admits a new
// retailer using the same convention without a code change, and it cannot be
// widened by a retailer changing its data. Every accepted string above is
// `<screen-size><series>` (85P8L = an 85-inch P8L). Every Amazon truncation begins
// with letters (UA43F, QA75Q, QN95B, UA80) and matches nothing here.
//
// Three conditions, all required:
//   1. shape      — `<2–3 digits><letter><1–3 alnum>`, total 4–5 chars
//   2. self-consistency — the leading digits equal the listing's parsed screen size,
//                    so a fragment cannot masquerade as a complete code
//   3. not a prefix — no longer model-shaped token in this listing's own text starts
//                    with it, and the next word is not a variant word (PRO/PLUS/…).
//                    This is the founder's test applied at ROW scope, which the audit
//                    showed reproduces the catalogue verdict everywhere except the
//                    four Extra `+PRO` pairs — where the catalogue scope is the
//                    CONSERVATIVE one and condition 3's variant-word guard covers the
//                    dangerous half (a Pro listing written `55C6K PRO`).
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_SUFFIX_WORDS = new Set(["PRO", "PLUS", "MAX", "ULTRA", "EVO", "LITE"]);

/**
 * Extract a COMPLETE but short (4–5 char) manufacturer model number, or null.
 *
 * Deliberately separate from `extractManufacturerModel` so the global rule keeps its
 * meaning: this is not "the minimum is now 4", it is "this specific shape, proven to
 * stand alone, on a listing that corroborates its own screen size".
 */
export function extractSizePrefixedModel(
  payload: Record<string, unknown>,
  listingText: string,
  screenSize: number | null
): string | null {
  if (screenSize == null) return null;
  const text = (listingText || "").toUpperCase();
  const words = text.split(/[\s،,;:()[\]{}"'؛|–—]+/).map((t) => t.replace(/[.,،؛:]+$/, "")).filter(Boolean);

  for (const field of MODEL_FIELDS) {
    const raw = payload[field];
    const candidate = (typeof raw === "string" ? raw.trim() : "").toUpperCase();
    if (!candidate || candidate.length < 4 || candidate.length >= MIN_MODEL_LENGTH) continue;
    if (isStoreInternalIdentifier(candidate) || isNotASingleModel(candidate)) continue;

    const shape = SIZE_PREFIXED_MODEL.exec(candidate);
    if (!shape) continue;                                   // (1) shape
    if (Number(shape[1]) !== screenSize) continue;           // (2) self-consistency

    // (3) the listing must state it verbatim as its own token — never a fragment of
    // a longer string we then silently shortened.
    const at = words.indexOf(candidate);
    if (at === -1) continue;
    if (words.some((w) => w.length > candidate.length && w.startsWith(candidate))) continue;
    if (VARIANT_SUFFIX_WORDS.has(words[at + 1] ?? "")) continue;

    return candidate;
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
    if (isNotASingleModel(token)) continue;

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
  return best ? stripMarketingPrefix(best.toUpperCase()) : null;
}
