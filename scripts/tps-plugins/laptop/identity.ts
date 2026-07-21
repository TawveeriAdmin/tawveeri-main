// scripts/tps-plugins/laptop/identity.ts
// Laptop Identity Contract v1 — precision over recall.
//
//   PRIMARY  : brand | MODEL:<normalized_model_number>
//   FALLBACK : brand | family | cpu | ram | storage | screen | gpu
//
// Commercial attributes (color, warranty, region, seller bundle, OS edition)
// are NEVER part of the key — they live in normalized_payload only. RAM /
// storage / cpu are ALWAYS in the fallback key, so different configurations of
// the same model can never false-merge (a 16GB/512GB and a 32GB/1TB stay
// distinct canonicals). A key with neither family nor screen is too weak to
// assert identity and is rejected (invalid) rather than guessed.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };

  const model = normalizeMeta?.model_number ? String(normalizeMeta.model_number) : null;
  // PRIMARY — a clean model number is the exact SKU; precise and corroboration-safe.
  if (model) return { key: `${cb}|MODEL:${model}`, status: "valid", reason: "primary: model_number" };

  // FALLBACK — require the three discriminating specs.
  const cpu = p.cpu as string | null, ram = p.ram as number | null, storage = p.storage as number | null;
  const missing = (["cpu", "ram", "storage"] as const).filter((f) => p[f] === null || p[f] === undefined);
  if (missing.length) return { key: null, status: "invalid", reason: `null in critical: ${missing.join(", ")}` };

  const family = (p.family as string | null) ?? null;
  const screen = (p.screen as number | null) ?? null;
  // Neither family nor screen → identity too weak to assert. Unknown beats incorrect.
  if (!family && !screen) return { key: null, status: "invalid", reason: "no family and no screen" };

  const gpu = (p.gpu as string) ?? "igpu";
  const fam = family ?? "NO_FAMILY";
  const scr = screen != null ? String(screen) : "NO_SCREEN";
  const key = `${cb}|${fam}|${cpu}|${ram}|${storage}|${scr}|${gpu}`;

  const full = !!family && screen != null;
  return { key, status: full ? "valid" : "low_confidence_candidate", reason: full ? "fallback: full spec" : "fallback: family or screen missing" };
}
