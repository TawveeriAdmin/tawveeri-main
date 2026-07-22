// src/lib/agent/decision-engine.ts
// E15.5 — Stage-1 Decision Agent (deterministic core). Takes a SHOPPING TASK (not
// a keyword) and returns an explainable, NEUTRAL, total-cost-aware recommendation
// over the TPS canonical graph + Product DNA. Deterministic engine decides; an LLM
// may later only phrase the reasons (ADR-002). Ranking is RANKING-BLIND: it uses
// suitability + trust (corroboration) + total cost ONLY — never commission.
// Saudi Context First: KSA-hot BTU sizing, total cost incl. installation + est.
// electricity. v1 category: air_conditioner (the flagship journey); the shape is
// category-generic so tv/tablet/etc. plug in later.

export interface ShoppingTask {
  category: string;
  room_size_m2?: number;
  city?: string;
  priorities?: string[]; // e.g. ["quiet","low_electricity","heating"]
  budget_total?: number | null;
}

export interface CanonicalRow {
  canonical_id: string; tps_identity_key: string;
  display_name_ar: string | null; display_name_en: string | null;
  brand: string | null; category: string | null; image_url: string | null;
  lowest_price: number | null; store_count: number | null; has_comparison: boolean | null;
  identity_confidence: number | null; attributes?: Record<string, unknown> | null;
}

export interface ProductDNA {
  brand: string | null;
  capacity_btu: number | null;
  inverter: boolean | null;
  cooling_mode: string | null;       // cool_only | hot_cold
  ac_type: string | null;
  recommended_room_m2: number | null; // derived, KSA-hot
  energy_efficiency: "high" | "standard" | null;
  installation_class: string | null;
}

export interface Recommendation {
  canonical_id: string; tps_identity_key: string;
  title_ar: string | null; title_en: string | null; brand: string | null;
  unit_price: number | null;
  total_cost_estimate: number | null; // unit + install + est. annual electricity
  cost_breakdown: { unit: number | null; installation: number | null; annual_electricity: number | null };
  store_count: number | null; comparison_available: boolean;
  suitability_score: number;          // 0..1 deterministic
  confidence: number;                 // 0..100, never fabricated
  is_smart_pick: boolean;
  reasons_ar: string[];
  dna: ProductDNA;
  go_offer_hint: string;              // canonical_id; the route attaches the measured-exit go_url
}

// ── KSA-hot BTU sizing: hotter climate needs more BTU/m² than temperate tables. ──
export function requiredBtuForRoom(roomM2: number): number {
  const perM2 = 700; // KSA-hot heuristic (temperate ~500); conservative for Riyadh summers
  const raw = Math.max(18000, roomM2 * perM2);
  const standards = [18000, 24000, 30000, 36000, 48000, 60000];
  // round UP to the nearest standard capacity (never undersize in KSA heat)
  return standards.find((s) => s >= raw) ?? standards[standards.length - 1];
}

// ── Derive Product DNA (AC) deterministically from canonical attributes. ──
export function deriveAcDna(row: CanonicalRow): ProductDNA {
  const a = row.attributes ?? {};
  const btu = typeof a.capacity_btu === "number" ? a.capacity_btu : (a.capacity_btu ? Number(a.capacity_btu) : null);
  const tech = (a.technology as string) ?? null;
  const inverter = tech ? /inverter/i.test(tech) : null;
  return {
    brand: row.brand,
    capacity_btu: btu,
    inverter,
    cooling_mode: (a.cooling_mode as string) ?? null,
    ac_type: (a.ac_type as string) ?? null,
    recommended_room_m2: btu ? Math.round(btu / 700) : null, // inverse of the sizing heuristic
    energy_efficiency: inverter == null ? null : inverter ? "high" : "standard",
    installation_class: (a.ac_type as string) === "split" ? "split_professional" : "standard",
  };
}

// ── Total cost of ownership (Saudi Context): unit + installation + est. annual electricity. ──
function estimateTotalCost(unit: number | null, dna: ProductDNA): Recommendation["cost_breakdown"] & { total: number | null } {
  if (unit == null) return { unit: null, installation: null, annual_electricity: null, total: null };
  const installation = dna.installation_class === "split_professional" ? 350 : 0; // SAR, typical split install
  // Rough annual electricity: BTU→kW (÷3412) × ~1800 cooling h/yr × 0.18 SAR/kWh, inverter ~30% less.
  const kw = dna.capacity_btu ? dna.capacity_btu / 3412 : 2.5;
  const base = kw * 1800 * 0.18;
  const annual_electricity = Math.round(base * (dna.inverter ? 0.7 : 1));
  return { unit, installation, annual_electricity, total: Math.round(unit + installation + annual_electricity) };
}

// ── Deterministic AC decision. Returns ranked recommendations. RANKING-BLIND. ──
export function decideAc(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const wantsQuiet = (task.priorities ?? []).includes("quiet");
  const wantsLowElec = (task.priorities ?? []).includes("low_electricity");
  const wantsHeating = (task.priorities ?? []).includes("heating");
  const requiredBtu = task.room_size_m2 ? requiredBtuForRoom(task.room_size_m2) : null;

  const scored = rows.map((row) => {
    const dna = deriveAcDna(row);
    const reasons: string[] = [];
    let score = 0.5; // neutral base

    // 1. BTU fit (the dominant suitability signal for AC)
    if (requiredBtu && dna.capacity_btu) {
      const rel = Math.abs(dna.capacity_btu - requiredBtu) / requiredBtu;
      const fit = Math.max(0, 1 - rel * 1.5); // penalize mis-size
      score += (fit - 0.5) * 0.5;
      if (rel <= 0.12) reasons.push(`مناسب لغرفة ~${task.room_size_m2}م² (السعة ${dna.capacity_btu} وحدة تطابق المطلوب)`);
      else if (dna.capacity_btu < requiredBtu) reasons.push(`⚠️ السعة ${dna.capacity_btu} أقل من المطلوب (~${requiredBtu} وحدة) لغرفة ${task.room_size_m2}م²`);
      else reasons.push(`السعة ${dna.capacity_btu} وحدة (أكبر من ~${requiredBtu} المطلوب — تبريد أسرع، استهلاك أعلى)`);
    }
    // 2. Inverter for low electricity
    if (dna.inverter) { score += wantsLowElec ? 0.18 : 0.06; reasons.push(wantsLowElec ? "إنفرتر — أوفر في فاتورة الكهرباء (أولويتك)" : "إنفرتر — كفاءة أعلى في الكهرباء"); }
    else if (wantsLowElec) { score -= 0.1; reasons.push("عادي (غير إنفرتر) — استهلاك كهرباء أعلى"); }
    // 3. Cooling mode fit
    if (wantsHeating && dna.cooling_mode === "hot_cold") { score += 0.08; reasons.push("حار وبارد — يدفّئ شتاءً"); }
    if (!wantsHeating && dna.cooling_mode === "cool_only") { reasons.push("بارد فقط — مناسب لأغلب أجواء المملكة"); }
    // 4. Trust: cross-store corroboration
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.push(`سعر موثوق — متوفر ومُقارَن في ${row.store_count} متاجر`); }
    else reasons.push("متوفر في متجر واحد — المقارنة غير متاحة");

    const cost = estimateTotalCost(row.lowest_price, dna);
    // 5. Total cost within budget (suitability, not commission)
    if (task.budget_total && cost.total) {
      if (cost.total <= task.budget_total) { score += 0.06; reasons.push(`ضمن ميزانيتك — التكلفة الإجمالية ~${cost.total} ريال`); }
      else { score -= 0.12; reasons.push(`أعلى من ميزانيتك — التكلفة الإجمالية ~${cost.total} ريال`); }
    } else if (cost.total) {
      reasons.push(`التكلفة الإجمالية التقديرية ~${cost.total} ريال (الجهاز ${cost.unit} + تركيب ${cost.installation} + كهرباء سنوية ~${cost.annual_electricity})`);
    }

    const confidence = Math.min(95, Math.round(((row.identity_confidence ?? 70) + (row.store_count ?? 0) * 8) / 1.2));
    score = Math.max(0, Math.min(1, score));
    return { row, dna, score, reasons, cost, confidence };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i): Recommendation => ({
    canonical_id: s.row.canonical_id, tps_identity_key: s.row.tps_identity_key,
    title_ar: s.row.display_name_ar, title_en: s.row.display_name_en, brand: s.row.brand,
    unit_price: s.row.lowest_price,
    total_cost_estimate: s.cost.total,
    cost_breakdown: { unit: s.cost.unit, installation: s.cost.installation, annual_electricity: s.cost.annual_electricity },
    store_count: s.row.store_count, comparison_available: !!s.row.has_comparison,
    suitability_score: Math.round(s.score * 100) / 100, confidence: s.confidence,
    is_smart_pick: i === 0,
    reasons_ar: s.reasons,
    dna: s.dna,
    go_offer_hint: s.row.canonical_id,
  }));
}
