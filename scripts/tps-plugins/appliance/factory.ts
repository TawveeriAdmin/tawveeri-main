// scripts/tps-plugins/appliance/factory.ts
// Config-driven TPS CategoryPlugin factory for home appliances. One factory
// implements the full plugin contract (detect / normalize / buildIdentityKey /
// scoreConfidence) plus the registry helpers (names / attrs) for ANY appliance
// whose identity is brand + a discriminator (type and/or capacity). This is the
// DRY reuse of the TPS architecture: adding a category is a config, not 5 files.
//
// Identity key format is uniform 3-part: `brand|type|capacity` with "NA" as an
// explicit placeholder for an absent part (so attrs decoding is positional and
// deterministic). Precision-first: a brand-only match (no type AND no capacity)
// is INVALID — we never over-merge a whole brand into one identity.
import type { CategoryPlugin, NormalizeResult, IdentityResult, ConfidenceResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { extractManufacturerModel } from "../../../src/lib/identity/store-identifiers";

export interface CapacitySpec {
  regex: string;            // must capture the number in group 1
  min: number; max: number;
  round?: number;           // round to nearest N
  cuftToLiters?: boolean;   // convert cubic feet → liters (÷ appliances quoting cu.ft)
  /** Optional dimensions form (ADR-254, cookers: «60*90 سم» / «90×60»): a regex with TWO
   *  numeric groups; capacity = the LARGER dimension, so 60×90 and 90×60 key identically
   *  (order-independent — the LD141BBSIT split-defect class). Tried BEFORE `regex`. */
  dimsRegex?: string;
}
export interface ApplianceCfg {
  category: string; version: string;
  nounAr: string; nounEn: string;
  metricAr?: string; metricEn?: string;   // unit label for the capacity number
  signals: string;                          // regex src — at least one must match
  rejectAccessory?: string;                 // regex src — reject (spare parts/consumables)
  rejectWrong?: string;                      // regex src — reject (wrong category/collision)
  brandGuess: string;                        // regex src — fallback brand extraction
  types?: [string, string][];                // [label, regexSrc] — first match wins
  capacity?: CapacitySpec;
  techFlags?: [string, string][];            // [payloadField, regexSrc] — boolean features
  /** Registry raw_name prefilter override. The default ([nounEn first word, nounAr]) fails
   *  when the market's own words differ from the noun (cooker: names say «فرن غاز», not
   *  «طباخ»). ADR-254. */
  filterKeywords?: string[];
  /** Customer-facing name override. The factory default renders `noun brand type capacity`
   *  which is crude for categories whose type labels are not display words (burner counts). */
  namesOverride?: (key: string) => { nameAr: string; nameEn: string };
  /** Full-control type resolver (ADR-254 cooker fuel identity): when present it REPLACES
   *  the `types` first-match list. Needed where the type is a COMPOSITE fact (fuel ×
   *  burner count) that ordered regexes cannot express safely — e.g. the brand «جليم غاز»
   *  contains غاز, so only noun-adjacent matching can tell a Glem Gas ELECTRIC cooker
   *  from a gas one. Receives the lowercased combined name text. */
  typeResolve?: (text: string) => string | null;
}

const rx = (s?: string) => (s ? new RegExp(s, "i") : null);

export interface AppliancePluginBundle {
  plugin: CategoryPlugin;
  names: (key: string, rep?: Record<string, unknown>) => { nameAr: string; nameEn: string };
  attrs: (key: string, rep?: Record<string, unknown>) => Record<string, unknown>;
  config: ApplianceCfg;
}

export function makeAppliancePlugin(cfg: ApplianceCfg): AppliancePluginBundle {
  const sig = new RegExp(cfg.signals, "i");
  const acc = rx(cfg.rejectAccessory), wrong = rx(cfg.rejectWrong);
  const brandRx = new RegExp(cfg.brandGuess, "i");
  const types = (cfg.types || []).map(([label, src]) => [label, new RegExp(src, "i")] as const);
  const techs = (cfg.techFlags || []).map(([f, src]) => [f, new RegExp(src, "i")] as const);
  const capRx = cfg.capacity ? new RegExp(cfg.capacity.regex, "i") : null;

  function detect(nameAr: string, nameEn: string): boolean {
    const t = `${nameAr} ${nameEn}`.toLowerCase();
    if (wrong && wrong.test(t)) return false;
    if (acc && acc.test(t)) return false;
    return sig.test(t);
  }
  const dimsRx = cfg.capacity?.dimsRegex ? new RegExp(cfg.capacity.dimsRegex, "i") : null;
  function extractCapacity(full: string): number | null {
    if (!cfg.capacity) return null;
    if (dimsRx) {
      const d = full.match(dimsRx);
      if (d && d[1] != null && d[2] != null) {
        let n = Math.max(parseFloat(d[1]), parseFloat(d[2]));
        if (Number.isFinite(n)) {
          if (cfg.capacity.round) n = Math.round(n / cfg.capacity.round) * cfg.capacity.round;
          if (n >= cfg.capacity.min && n <= cfg.capacity.max) return n;
        }
      }
    }
    if (!capRx) return null;
    const m = full.match(capRx); if (!m || m[1] == null) return null;
    let n = parseFloat(m[1]); if (!Number.isFinite(n)) return null;
    if (cfg.capacity.cuftToLiters) n = Math.round((n * 28.3) / 10) * 10;
    else if (cfg.capacity.round) n = Math.round(n / cfg.capacity.round) * cfg.capacity.round;
    if (n < cfg.capacity.min || n > cfg.capacity.max) return null;
    return n;
  }
  function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
    const full = `${nameAr} ${nameEn}`; const t = full.toLowerCase();
    let brand = canonicalizeBrand(rawBrand);
    if (brand === "unknown" || brand === "other") { const g = t.match(brandRx); if (g) brand = canonicalizeBrand(g[0].trim()); }
    let type: string | null = null;
    if (cfg.typeResolve) type = cfg.typeResolve(t);
    else for (const [label, re] of types) if (re.test(t)) { type = label; break; }
    const capacity = extractCapacity(full);
    const payload: Record<string, unknown> = { brand: brand === "unknown" ? null : brand, type, capacity };
    for (const [f, re] of techs) payload[f] = re.test(t);
    const flags: string[] = [];
    if (type == null && capacity == null) flags.push("no_discriminator");
    // P4/P6 (2026-08-21): the retailer's OWN structured model/modelNumber payload
    // field, via the SAME key-integrity authority laptop/TV/AC use — PAYLOAD ONLY,
    // deliberately never the title name-rescue path. Survey evidence (11 appliance
    // categories, 400-observation samples each) found the name-rescue path produces
    // false positives on appliance-specific spec phrasing (a toaster titled
    // "Stainless Steel-1050W-" extracted THAT as if it were the model, burying the
    // real "ET244-B5" in the same title) that the payload field never exhibited
    // across any category (zero false-positive collisions measured). A clean model
    // number is the strongest single signal and becomes the PRIMARY identity,
    // exactly like the laptop plugin; its absence is the common case and falls
    // through to the existing brand|type|capacity scheme unchanged — zero churn for
    // every appliance already identified that way.
    const model_number = rawPayload ? extractManufacturerModel(rawPayload) : null;
    return { model_number, color: null, payload, ignored_terms: [], ambiguity_flags: flags };
  }
  function buildIdentityKey(brand: string | null, p: Record<string, unknown>, normalizeMeta?: Record<string, unknown>): IdentityResult {
    const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
    if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };
    const model = normalizeMeta?.model_number ? String(normalizeMeta.model_number) : null;
    if (model) return { key: `${cb}|MODEL:${model}`, status: "valid", reason: "primary: model_number" };
    const type = (p.type as string | null) ?? null;
    const cap = p.capacity as number | null;
    if (type == null && cap == null) return { key: null, status: "invalid", reason: "no discriminator (type/capacity)" };
    // Capacity is the discriminating spec. Without it, `brand|type|NA` collapses
    // every model of that type into one identity — a false merge (measured: all
    // Xiaomi robot vacuums merged, 165→849 SAR). So a capacity-less key is
    // catalogue-only (low_confidence), never corroboration-eligible. Precision over recall.
    const full = cap != null;
    return {
      key: `${cb}|${type ?? "NA"}|${cap == null ? "NA" : cap}`,
      status: full ? "valid" : "low_confidence_candidate",
      reason: full ? "brand+type+capacity" : "capacity missing — brand+type too coarse to corroborate",
    };
  }
  function scoreConfidence(brand: string | null, p: Record<string, unknown>, m: string | null, flags: string[]): ConfidenceResult {
    const missing: string[] = [];
    if (!brand && !p.brand) missing.push("brand");
    if (p.type == null && p.capacity == null) missing.push("discriminator");
    let conf = Math.round(((2 - missing.length) / 2) * 100);
    if (m) conf = Math.min(100, conf + 10);
    if (flags.length) conf = Math.max(0, conf - 5);
    return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 0 };
  }

  const typeLabel = (label: string) => label.replace(/_/g, " ");
  function names(key: string): { nameAr: string; nameEn: string } {
    const modelMatch = key.match(/^([^|]+)\|MODEL:(.+)$/);
    if (modelMatch) {
      const [, b, model] = modelMatch;
      return {
        nameAr: `${cfg.nounAr} ${b} ${model}`.replace(/\s+/g, " ").trim(),
        nameEn: `${b} ${model} ${cfg.nounEn}`.replace(/\s+/g, " ").trim(),
      };
    }
    const [b, ty, cap] = key.split("|");
    const tyS = ty !== "NA" ? typeLabel(ty) : "";
    const capAr = cap !== "NA" ? `${cap}${cfg.metricAr ? " " + cfg.metricAr : ""}` : "";
    const capEn = cap !== "NA" ? `${cap}${cfg.metricEn ? " " + cfg.metricEn : ""}` : "";
    return {
      nameAr: `${cfg.nounAr} ${b} ${tyS} ${capAr}`.replace(/\s+/g, " ").trim(),
      nameEn: `${b} ${tyS ? tyS + " " : ""}${cfg.nounEn}${capEn ? " " + capEn : ""}`.replace(/\s+/g, " ").trim(),
    };
  }
  function attrs(key: string, rep?: Record<string, unknown>): Record<string, unknown> {
    const modelMatch = key.match(/^([^|]+)\|MODEL:(.+)$/);
    const a: Record<string, unknown> = modelMatch
      ? { appliance_type: null, capacity: null, capacity_unit: cfg.metricEn ?? null, model_number: modelMatch[2] }
      : (() => {
          const [, ty, cap] = key.split("|");
          return { appliance_type: ty === "NA" ? null : ty, capacity: cap === "NA" ? null : Number(cap), capacity_unit: cfg.metricEn ?? null };
        })();
    for (const [f] of techs) if (rep && f in rep) a[f] = rep[f];
    return a;
  }

  const plugin: CategoryPlugin = { category: cfg.category, version: cfg.version, detect, normalize, buildIdentityKey, scoreConfidence };
  return { plugin, names: cfg.namesOverride ?? names, attrs, config: cfg };
}
