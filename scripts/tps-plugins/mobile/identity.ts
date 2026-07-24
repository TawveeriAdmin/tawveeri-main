// scripts/tps-plugins/mobile/identity.ts
// Mobile Identity Contract — brand | family | generation | variant | storage.
//
// ADR-060: the brand segment is CANONICALIZED, as in every other category
// plugin. It previously used the raw store-supplied brand string, which split
// one product into several identities by language and casing:
//   ابل|iPhone|17|Pro|256   (Almanea, SWSG — Arabic brand)
//   Apple|iPhone|17|Pro|256 (Jarir, Amazon — English brand)
//   apple|iPhone|17|Pro|256 (the 38 canonicals mobile-v1 already wrote)
// Measured consequence: Arabic-titled stores could corroborate only with each
// other and English-titled stores only with each other — never across — and
// registering the plugin in that state would have created duplicate product
// cards for the same phone. Saudi-first means Arabic and English titles must
// resolve to ONE identity (Constitution principle 5).
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  _normalizeMeta?: Record<string, unknown>
): IdentityResult {
  // The MODEL fields (brand + family + generation + variant) are ALWAYS required:
  // an unidentified model can never be a canonical product. Storage, however, is a
  // COMMERCIAL VARIANT of that canonical product — and a large class of real Saudi
  // listings state the model but omit storage ("Samsung Galaxy S25 Ultra", "Apple
  // iPhone 17 Pro Max"; the payload `specifications` is empty). Requiring storage
  // discarded ~100 comparison-possible listings on the flagship category (ADR-080).
  //
  // ADR-081: when storage is absent we still assert the canonical product at MODEL
  // level with a `NO_STORAGE` sentinel, so two merchants selling the same model
  // corroborate at the correct hierarchy level (Canonical Product → Commercial
  // Variant → Offers). Precision is preserved by construction: `NO_STORAGE` is a
  // distinct token that can NEVER merge with a storage-specific key (`…|256`), so
  // we never claim a 256 GB unit equals a 512 GB one. The residual uncertainty —
  // that two bare listings could be different storages — is carried transparently
  // as REDUCED identity_confidence (validator) and an explicit caution in the
  // Decision Engine, never as a silent equivalence.
  const modelNulls = ["brand", "family", "generation", "variant"]
    .filter(f => (f === "brand" ? brand : p[f]) === null || (f === "brand" ? brand : p[f]) === undefined);

  if (modelNulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${modelNulls.join(", ")}` };

  const cb = canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };

  const storage = (p.storage_gb === null || p.storage_gb === undefined) ? "NO_STORAGE" : String(p.storage_gb);
  return { key: `${cb}|${p.family}|${p.generation}|${p.variant}|${storage}`, status: "valid" };
}
