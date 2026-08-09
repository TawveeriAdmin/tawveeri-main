// src/lib/agent/category-contracts.ts
// CATEGORY DECISION CONTRACTS (2026-08-09, Unified Intelligence mission, Phase 3 · Section 9).
//
// Section 9's own worked example: *"'خفيف' requires verified weight evidence; unknown weight
// ≠ lightweight."* This file makes that rule checkable instead of tribal knowledge. For each
// category it separates:
//
//   IDENTITY dimensions — what the product IS. Corroborating these across stores is how TPS
//   proves two listings are the same product (`tps_identity_key`). Getting these wrong means
//   two DIFFERENT products get compared as one.
//
//   DECISION dimensions — what a shopper actually weighs when choosing. Each is tagged:
//     - 'verified'  — real, extracted, per-product data exists in `attributes` today
//                     (decideAc/decideMobile/decideLaptop already read and score it).
//     - 'inferred'  — no direct measurement exists, but a documented, named proxy is used
//                     (e.g. screen size standing in for portability). The proxy's honest
//                     limitation MUST be surfaced to the shopper, never silently upgraded to
//                     a stated fact.
//     - 'unknown'   — the shopper may care about this, but nothing in the pipeline provides
//                     it yet. Naming it here is itself the point: it turns a silent gap into
//                     a tracked one, and is what a future extraction pass should target first.
//
// This module does NOT replace `decision-engine.ts`'s deciders (decideAc/decideMobile/
// decideLaptop) — those already implement the scoring; this documents and can be QUERIED for
// what each dimension's evidence status is, so a decider's wording can be checked against it
// rather than drifting. Scope: AC, phones (mobile), laptops FIRST (mission's mandated
// execution order) — TV/tablet/refrigerator/washing_machine already have deciders with
// entirely 'verified' decision dimensions (BTU/inverter/panel/refresh_rate/capacity_liters/
// capacity_kg are all real extracted attributes), so they do not need a contract to correct
// anything today; a contract gets added for a category only when its data quality actually
// changes what can honestly be claimed (Section 9's own scoping rule).
export type EvidenceStatus = 'verified' | 'inferred' | 'unknown';

export interface DecisionDimension {
  key: string;
  labelAr: string;
  labelEn: string;
  status: EvidenceStatus;
  /** For 'inferred' dimensions: the real attribute standing in, and why it is NOT the same
   *  thing as what the shopper asked about. Required when status === 'inferred'. */
  proxyNote?: string;
}

export interface CategoryContract {
  category: string;
  identityDimensions: string[];
  decisionDimensions: DecisionDimension[];
}

export const CATEGORY_CONTRACTS: Record<string, CategoryContract> = {
  air_conditioner: {
    category: 'air_conditioner',
    identityDimensions: ['brand', 'ac_type', 'capacity_btu', 'technology', 'cooling_mode'],
    decisionDimensions: [
      { key: 'capacity_btu', labelAr: 'السعة (BTU) للغرفة', labelEn: 'Room BTU fit', status: 'verified' },
      { key: 'inverter', labelAr: 'إنفرتر (كهرباء أوفر)', labelEn: 'Inverter (lower electricity)', status: 'verified' },
      { key: 'cooling_mode', labelAr: 'حار وبارد / بارد فقط', labelEn: 'Hot+cold vs cool-only', status: 'verified' },
      // Annual electricity IS scored (estimateTotalCost) but is a MODELLED KSA heuristic, never
      // a measurement — decide/route.ts already labels it 'estimate' kind, consistent here.
      { key: 'annual_electricity_cost', labelAr: 'تكلفة الكهرباء السنوية', labelEn: 'Annual electricity cost', status: 'inferred', proxyNote: 'modelled from BTU + inverter class (KSA heuristic), never a measured bill' },
      { key: 'installation_cost', labelAr: 'تكلفة التركيب', labelEn: 'Installation cost', status: 'inferred', proxyNote: 'flat estimate by AC type, never a quoted/measured price' },
      { key: 'noise_level_db', labelAr: 'مستوى الضجيج', labelEn: 'Noise level', status: 'unknown' },
    ],
  },
  mobile: {
    category: 'mobile',
    identityDimensions: ['brand', 'family', 'generation', 'variant', 'storage'],
    decisionDimensions: [
      { key: 'storage', labelAr: 'سعة التخزين', labelEn: 'Storage', status: 'verified' },
      { key: 'generation_recency', labelAr: 'الجيل / الأحدث', labelEn: 'Generation / latest', status: 'verified' },
      // Camera/battery quality is scored via the variant name (Ultra/Pro/Plus/Standard), not a
      // measured spec (megapixels, sensor size, mAh) — the variant tier IS part of the product's
      // real identity/naming, but "better camera" is the manufacturer's own marketing claim for
      // that tier, not something TPS measured independently.
      { key: 'camera_quality', labelAr: 'جودة الكاميرا', labelEn: 'Camera quality', status: 'inferred', proxyNote: 'inferred from the variant tier (Ultra/Pro/Plus/Standard), not a measured spec (megapixels, sensor size)' },
      { key: 'battery_capacity', labelAr: 'سعة البطارية', labelEn: 'Battery capacity', status: 'inferred', proxyNote: 'inferred from the variant tier, not a measured mAh figure' },
      { key: 'ram', labelAr: 'الذاكرة العشوائية (RAM)', labelEn: 'RAM', status: 'unknown' },
    ],
  },
  laptop: {
    category: 'laptop',
    identityDimensions: ['brand', 'family', 'cpu', 'ram', 'storage', 'screen', 'gpu'],
    decisionDimensions: [
      { key: 'ram', labelAr: 'الذاكرة العشوائية (RAM)', labelEn: 'RAM', status: 'verified' },
      { key: 'storage', labelAr: 'سعة التخزين', labelEn: 'Storage', status: 'verified' },
      { key: 'gpu_class', labelAr: 'كرت الشاشة (منفصل/مدمج)', labelEn: 'Discrete vs integrated GPU', status: 'verified' },
      { key: 'cpu', labelAr: 'المعالج', labelEn: 'CPU', status: 'verified' },
      // THE NAMED DEFECT (Section 9's own example). No weight extraction exists anywhere in
      // the scraping/spec pipeline — grep-verified 2026-08-09, zero `weight_kg`/`weight_grams`
      // attribute in the codebase. Screen size is a REAL, extracted attribute and a genuine,
      // named correlate of portability, but it is not weight, and a small-screen laptop is not
      // guaranteed to be light. Any decider wording here must say what IS known (screen size)
      // and must NEVER assert "خفيف" (light) as if it were a verified spec.
      { key: 'weight', labelAr: 'الوزن', labelEn: 'Weight', status: 'unknown' },
      { key: 'portability', labelAr: 'قابلية الحمل', labelEn: 'Portability', status: 'inferred', proxyNote: 'inferred from screen size only — actual weight is unverified (unknown, see the weight dimension above)' },
      { key: 'battery_life_hours', labelAr: 'عمر البطارية', labelEn: 'Battery life', status: 'unknown' },
    ],
  },
};

/** True when a dimension's current wording is allowed to assert it as a plain fact — 'inferred'
 *  and 'unknown' dimensions must be phrased with their limitation stated, never as a bare claim. */
export function isVerifiedDimension(category: string, key: string): boolean {
  return CATEGORY_CONTRACTS[category]?.decisionDimensions.find((d) => d.key === key)?.status === 'verified';
}

export function getCategoryContract(category: string): CategoryContract | null {
  return CATEGORY_CONTRACTS[category] ?? null;
}
