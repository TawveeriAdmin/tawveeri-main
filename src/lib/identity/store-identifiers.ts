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
  if (v.length < 4 || v.length > 24) return false;
  if (/\s/.test(v)) return false;                      // marketing name / title fragment
  if (!/^[A-Za-z0-9][A-Za-z0-9\-/._]*$/.test(v)) return false;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return false;
  if (SPEC_ONLY_PATTERNS.some((re) => re.test(v))) return false;
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
