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
  const nulls = ["brand", "family", "generation", "variant", "storage_gb"]
    .filter(f => (f === "brand" ? brand : p[f]) === null || (f === "brand" ? brand : p[f]) === undefined);

  if (nulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${nulls.join(", ")}` };

  const cb = canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };

  return { key: `${cb}|${p.family}|${p.generation}|${p.variant}|${p.storage_gb}`, status: "valid" };
}
