// src/lib/entity-resolution/mask.ts
// ─────────────────────────────────────────────────────────────────────────────
// LABEL-LEAKAGE PROTECTION for the Entity-Resolution benchmark. Ground-truth labels
// come from shared model numbers/SKUs — so if those exact identifiers remain in the
// INPUT, a matcher can "read the answer" instead of resolving the hard long tail.
// maskIdentifiers() removes model codes / SKUs / GTINs / barcodes while KEEPING the
// natural product description a human uses (brand, family, "S25", "Pro Max", specs
// like 256GB / 5G / 55inch / 10100mAh). Deterministic; pure.
// ─────────────────────────────────────────────────────────────────────────────

// Spec tokens to KEEP (number + known unit) — these describe the product, not identity.
const SPEC_UNIT = /^\d+(?:\.\d+)?(?:gb|tb|mah|ghz|mhz|hz|kw|wh|w|inch|mm|cm|nm|mp|kg|ml|[lvakgp])$/i;
const YEAR = /^(?:19|20)\d{2}$/;
const MASK = "⟨id⟩"; // ⟨id⟩

function isSpecOrWord(w: string): boolean {
  if (SPEC_UNIT.test(w)) return true;              // 256gb, 55inch, 10100mah…
  if (YEAR.test(w)) return true;                    // 2024
  if (/^\d{1,4}$/.test(w)) return true;             // short bare numbers (16, 256, 55) — natural
  if (/^[a-z]{1,3}\d{1,3}$/i.test(w) && w.length <= 4) return true; // S25, A36, T7 (short family codes)
  if (!/\d/.test(w)) return true;                   // words with no digit (brand/family/color)
  return false;
}

/** Remove exact identifiers (model numbers, SKUs, GTINs) from a product title. */
export function maskIdentifiers(text: string | null | undefined): string {
  if (!text) return "";
  let t = String(text);
  // hyphen/slash/dot-joined codes: SM-S938B, 24U421A-B.AMIQ, HTG-MT16PL3537, RF-8428
  t = t.replace(/\b[A-Za-z0-9]{2,}(?:[-/.][A-Za-z0-9]{2,}){1,}\b/g, (m) =>
    (/\d/.test(m) && /[A-Za-z]/.test(m) && m.replace(/[^A-Za-z0-9]/g, "").length >= 5 && !SPEC_UNIT.test(m.replace(/[^A-Za-z0-9]/g, ""))) ? ` ${MASK} ` : m);
  // token level
  t = t.split(/\s+/).map((tok) => {
    const w = tok.replace(/[^A-Za-z0-9]/g, "");
    if (!w) return tok;
    if (/^\d{8,}$/.test(w)) return MASK;                                   // barcode / GTIN
    if (isSpecOrWord(w)) return tok;                                        // keep specs / words / short family codes
    if (w.length >= 6 && /[A-Za-z]/.test(w) && /\d/.test(w)) return MASK;   // long alphanumeric model code
    return tok;
  }).join(" ");
  return t.replace(/\s+/g, " ").trim();
}

/** Was anything masked? (useful for benchmark stats.) */
export function hadIdentifier(text: string | null | undefined): boolean {
  return maskIdentifiers(text).includes(MASK) || !!(text && String(text).includes(MASK));
}
