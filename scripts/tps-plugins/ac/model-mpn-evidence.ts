// scripts/tps-plugins/ac/model-mpn-evidence.ts
// EVIDENCE INSTRUMENTATION ONLY (ADR-317) — founder-authorized, narrow scope: Amazon + AC.
// This module does NOT decide product identity. It answers one question only:
// "what manufacturer identifiers do we actually have?" It is NOT imported by any live
// pipeline file (verified by grep, same as pdp-evidence.ts / ADR-315) — inert until a
// separate, future, explicitly-approved mission wires it in.
//
// Deliberately distinct fields, never collapsed (per founder instruction #5):
//   model_number   — a manufacturer-facing model/product code, source field unclear whether
//                     it's the precise MPN or a broader marketing model name.
//   mpn            — only set when the source field is Amazon's own "Manufacturer Reference"
//                     label specifically (the closest Amazon comes to a labeled MPN field in
//                     what this scraper captures) — kept separate from model_number because
//                     Amazon does NOT label a field "MPN" directly; "Manufacturer Reference"
//                     is the nearest analogue and should not be silently treated as identical
//                     to "Item model number"/"Model number" without saying so.
//   system/indoor/outdoor model — NOT populated by this module. Nothing in the captured
//                     Amazon spec vocabulary distinguishes a split AC's indoor vs. outdoor vs.
//                     complete-system model number — the single "Item model number" field is
//                     undifferentiated. Reporting these as unpopulated is the honest answer,
//                     not a gap to paper over with a guess.
//
// NO normalization beyond trimming whitespace/control characters. Hyphens, slashes, prefixes,
// suffixes, and regional/voltage codes are preserved verbatim in normalized_value.

export interface ExtractedIdentifier {
  raw_value: string;
  normalized_value: string;
  source_field: string; // the exact (cleaned) spec key this came from
  extraction_method: "spec_key_match";
  confidence: "labeled_manufacturer_reference" | "labeled_model_number" | "labeled_asin" | "labeled_upc";
}

export interface ModelMpnEvidenceResult {
  model_number: ExtractedIdentifier | null;
  mpn: ExtractedIdentifier | null; // only from an explicit "Manufacturer Reference" label
  asin: ExtractedIdentifier | null;
  upc_or_gtin: ExtractedIdentifier | null;
  system_model: null; // never populated — see module comment
  indoor_model: null; // never populated — see module comment
  outdoor_model: null; // never populated — see module comment
  all_spec_keys_seen: string[];
}

// Cleans Amazon's HTML-derived spec key noise (embedded newlines, bidi marks U+200E/U+200F,
// Arabic presentation-form colon artifacts, repeated whitespace) WITHOUT touching the VALUE.
function cleanKey(rawKey: string): string {
  return rawKey
    .replace(/[‎‏​]/g, "")
    .replace(/\s+/g, " ")
    .replace(/:\s*$/g, "")
    .trim()
    .toLowerCase();
}

// Cleans the VALUE only of control/bidi characters and collapses internal newlines to a single
// space — this is presentation cleanup (the raw HTML wraps values across lines), never a
// content change. Every other character — hyphens, slashes, digits, letters, spaces within the
// real value — is preserved exactly.
function cleanValue(rawValue: string): string {
  return rawValue
    .replace(/[‎‏​]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MPN_LABEL = /manufacturer\s*reference/;
const MODEL_LABEL = /\b(item\s*model\s*number|model\s*number)\b/;
const ASIN_LABEL = /^asin$/;
const UPC_LABEL = /^upc$/;

export function extractModelMpnEvidence(specifications: Record<string, unknown> | null | undefined): ModelMpnEvidenceResult {
  const result: ModelMpnEvidenceResult = {
    model_number: null, mpn: null, asin: null, upc_or_gtin: null,
    system_model: null, indoor_model: null, outdoor_model: null,
    all_spec_keys_seen: [],
  };
  if (!specifications) return result;

  for (const [rawKey, rawVal] of Object.entries(specifications)) {
    if (typeof rawVal !== "string") continue;
    const key = cleanKey(rawKey);
    result.all_spec_keys_seen.push(key);
    const value = cleanValue(rawVal);
    if (!value) continue;

    if (MPN_LABEL.test(key) && !result.mpn) {
      result.mpn = { raw_value: rawVal, normalized_value: value, source_field: key, extraction_method: "spec_key_match", confidence: "labeled_manufacturer_reference" };
    } else if (MODEL_LABEL.test(key) && !result.model_number) {
      result.model_number = { raw_value: rawVal, normalized_value: value, source_field: key, extraction_method: "spec_key_match", confidence: "labeled_model_number" };
    } else if (ASIN_LABEL.test(key) && !result.asin) {
      result.asin = { raw_value: rawVal, normalized_value: value, source_field: key, extraction_method: "spec_key_match", confidence: "labeled_asin" };
    } else if (UPC_LABEL.test(key) && !result.upc_or_gtin) {
      result.upc_or_gtin = { raw_value: rawVal, normalized_value: value, source_field: key, extraction_method: "spec_key_match", confidence: "labeled_upc" };
    }
  }
  return result;
}
