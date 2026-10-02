// src/lib/compare/identity-confidence.ts — ADR-400.
//
// WHAT KIND OF "SAME PRODUCT" A COMPARISON RESTS ON, said plainly.
//
// A TPS identity key is the deterministic parser's SPECIFICATION tuple
// (`brand|type|series|capacity|technology|mode` for an AC). It is never a manufacturer model
// number. When a segment is a sentinel (NO_SERIES / NO_TECH / NO_MODE / NA / UNKNOWN) the
// grouping is even looser: two listings that agree only on brand + BTU + inverter share the
// key, and the price gap between them may be the gap between two different machines.
//
// The reviewer's rejection (2026-10-02): «شارة الأقل على رابط فيه NO_SERIES». The accepted
// wording: «هذه مقارنة مواصفات لا رقم موديل. فرق السعر قد يكون جهازًا آخر.» This module is
// the one place that decides which of the two sentences a surface may say, from the key and
// from whether the knowledge layer holds a model code — never from a confidence number
// (ADR-386: `identity_confidence` is internal and is not rendered as accuracy).

const SENTINEL_SEGMENT = /(^|\|)(NO_[A-Z_]+|NA|UNKNOWN|N\/A)(\||$)/i;

/** True when the identity key carries at least one unknown-spec sentinel. */
export function identityKeyHasSentinel(key: string | null | undefined): boolean {
  if (!key) return false;
  return SENTINEL_SEGMENT.test(decodeURIComponentSafe(key));
}

/** A compare URL (`/ar/compare/<encoded key>`) → the same test on its key segment. */
export function compareUrlHasSentinel(url: string | null | undefined): boolean {
  if (!url) return false;
  const m = url.match(/\/compare\/([^/?#]+)/);
  return m ? identityKeyHasSentinel(m[1]) : false;
}

export type IdentityBasis = "model_code" | "specs" | "specs_incomplete";

/**
 * On what basis these offers were grouped:
 *  - `model_code`        — the knowledge layer holds a manufacturer model/MPN for the canonical.
 *  - `specs`             — a complete specification tuple, no model code.
 *  - `specs_incomplete`  — a specification tuple with at least one unknown segment.
 */
export function identityBasis(key: string | null | undefined, modelCode: string | null | undefined): IdentityBasis {
  if (modelCode && modelCode.trim() && !/^(NO_|NA$)/i.test(modelCode.trim())) return "model_code";
  return identityKeyHasSentinel(key) ? "specs_incomplete" : "specs";
}

/** The one sentence a surface shows for the basis — approved wording, do not paraphrase. */
export function identityBasisLine(basis: IdentityBasis, isAr: boolean): { text: string; tone: "ok" | "warn" } {
  switch (basis) {
    case "model_code":
      return { tone: "ok", text: isAr ? "نفس رقم الموديل — عروض النسخة نفسها" : "Same model number — offers for the same version" };
    case "specs":
      // ADR-401 wording (consultant contract 1): the blank is said as a blank.
      return { tone: "warn", text: isAr ? "مقارنة مواصفات — بلا رقم موديل. تحقق من رقم الموديل عند المتجر." : "Spec comparison — no model number. Confirm the model number at the store." };
    case "specs_incomplete":
    default:
      return { tone: "warn", text: isAr ? "هذه مقارنة مواصفات لا رقم موديل. فرق السعر قد يكون جهازًا آخر." : "This compares specifications, not a model number. The price gap may be a different device." };
  }
}

/** The badge a lowest-offer may carry under each basis — «أقل سعر مرصود» only on a model code. */
export function lowestOfferBadge(basis: IdentityBasis, isAr: boolean): string {
  if (basis === "model_code") return isAr ? "أقل سعر مرصود" : "Lowest observed price";
  return isAr ? "الأقل بين عروض بنفس المواصفات" : "Lowest among same-spec offers";
}

function decodeURIComponentSafe(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
