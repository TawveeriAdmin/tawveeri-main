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
  dna: Record<string, unknown>;       // category-specific Product DNA (AC/TV/tablet/…)
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
    dna: s.dna as unknown as Record<string, unknown>,
    go_offer_hint: s.row.canonical_id,
  }));
}

// ── Shared assembly: turn scored rows into ranked Recommendations. ──
function assemble(scored: { row: CanonicalRow; dna: Record<string, unknown>; score: number; reasons: string[]; total: number | null; breakdown: Recommendation["cost_breakdown"] }[]): Recommendation[] {
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i): Recommendation => ({
    canonical_id: s.row.canonical_id, tps_identity_key: s.row.tps_identity_key,
    title_ar: s.row.display_name_ar, title_en: s.row.display_name_en, brand: s.row.brand,
    unit_price: s.row.lowest_price, total_cost_estimate: s.total, cost_breakdown: s.breakdown,
    store_count: s.row.store_count, comparison_available: !!s.row.has_comparison,
    suitability_score: Math.round(Math.max(0, Math.min(1, s.score)) * 100) / 100,
    confidence: Math.min(95, Math.round(((s.row.identity_confidence ?? 70) + (s.row.store_count ?? 0) * 8) / 1.2)),
    is_smart_pick: i === 0, reasons_ar: s.reasons, dna: s.dna, go_offer_hint: s.row.canonical_id,
  }));
}

// ── TV: derive DNA + decide. Suitability = use-fit (gaming→refresh, movies→panel,
//    sports→refresh+size) + size + trust + budget. Ranking-blind. ──
const PANEL_QUALITY: Record<string, number> = { oled: 1.0, neo_qled: 0.9, qled: 0.8, qned: 0.75, nanocell: 0.7, mini_led: 0.85, crystal: 0.6, led: 0.5 };
export function deriveTvDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, screen_size: a.screen_size ?? null, resolution: a.resolution ?? null,
    panel: a.panel ?? null, refresh_rate: a.refresh_rate ?? null,
    gaming_ready: typeof a.refresh_rate === "number" ? a.refresh_rate >= 120 : null,
    movie_quality: a.panel ? (PANEL_QUALITY[String(a.panel)] ?? 0.5) >= 0.8 : null };
}
export function decideTv(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const pr = task.priorities ?? [];
  const wantGaming = pr.includes("gaming"), wantMovies = pr.includes("movies"), wantSports = pr.includes("sports"), wantBright = pr.includes("bright_room");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveTvDna(row); const reasons: string[] = [];
    let score = 0.5;
    const rr = typeof a.refresh_rate === "number" ? a.refresh_rate : null;
    const pq = a.panel ? (PANEL_QUALITY[String(a.panel)] ?? 0.5) : null;
    if ((wantGaming || wantSports) && rr != null) { if (rr >= 120) { score += 0.18; reasons.push(`معدل تحديث ${rr}Hz — ممتاز للألعاب/الرياضة`); } else { score -= 0.05; reasons.push(`معدل تحديث ${rr}Hz — منخفض للألعاب`); } }
    if (wantMovies && pq != null) { score += (pq - 0.5) * 0.4; reasons.push(pq >= 0.8 ? `شاشة ${a.panel} — جودة عالية للأفلام` : `شاشة ${a.panel} — جودة متوسطة`); }
    if (wantBright && pq != null && pq >= 0.8) { score += 0.06; reasons.push(`لوحة ${a.panel} — سطوع جيد للغرف المضيئة`); }
    if (a.resolution === "4k" || a.resolution === "8k") { score += 0.04; reasons.push(`دقة ${String(a.resolution).toUpperCase()}`); }
    if (typeof a.screen_size === "number") reasons.push(`${a.screen_size} بوصة`);
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.push(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.push("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.push(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.push(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Tablet: derive DNA + decide. Suitability = use-fit + connectivity + storage +
//    size + trust + budget. Ranking-blind. ──
export function deriveTabletDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, line: a.line ?? null, storage: a.storage ?? null,
    connectivity: a.connectivity ?? null, screen_size: a.screen_size ?? null,
    cellular: a.connectivity ? a.connectivity !== "wifi" : null };
}
export function decideTablet(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { use?: string[]; connectivity_needed?: string; storage_min?: number };
  const use = t.use ?? task.priorities ?? [];
  const wantProductivity = use.includes("productivity"), wantReading = use.includes("reading"), wantGaming = use.includes("gaming");
  const needCell = t.connectivity_needed && t.connectivity_needed !== "wifi";
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveTabletDna(row); const reasons: string[] = [];
    let score = 0.5;
    const storage = typeof a.storage === "number" ? a.storage : null;
    const size = typeof a.screen_size === "number" ? a.screen_size : null;
    const conn = a.connectivity as string | null;
    if (needCell) { if (conn && conn !== "wifi") { score += 0.15; reasons.push(`اتصال ${conn.toUpperCase()} — يدعم الشريحة`); } else { score -= 0.15; reasons.push("واي فاي فقط — لا يدعم الشريحة (تحتاج خلوي)"); } }
    else if (conn) reasons.push(conn === "wifi" ? "واي فاي" : `${conn.toUpperCase()}`);
    if (t.storage_min && storage != null) { if (storage >= t.storage_min) { score += 0.1; reasons.push(`تخزين ${storage}GB (يكفي)`); } else { score -= 0.12; reasons.push(`⚠️ تخزين ${storage}GB أقل من المطلوب (${t.storage_min}GB)`); } }
    else if (storage != null) reasons.push(`تخزين ${storage}GB`);
    if (wantProductivity && size != null) { if (size >= 11) { score += 0.1; reasons.push(`شاشة ${size}" — مناسبة للإنتاجية`); } else reasons.push(`شاشة ${size}" — صغيرة للإنتاجية`); }
    if (wantReading && size != null && size <= 11) { score += 0.05; reasons.push(`شاشة ${size}" — خفيفة للقراءة`); }
    if (wantGaming && storage != null && storage >= 128) { score += 0.06; reasons.push(`تخزين ${storage}GB — مناسب للألعاب`); }
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.push(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.push("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.push(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.push(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Mobile: derive DNA + decide. Suitability = variant tier (camera/battery),
//    generation recency, storage fit, trust, budget. Ranking-blind. ──
const VARIANT_TIER: Record<string, number> = { "ultra": 1.0, "pro max": 1.0, "pro": 0.85, "plus": 0.7, "fe": 0.6, "standard": 0.5 };
function variantTier(v: unknown): number { const s = String(v ?? "standard").toLowerCase(); return VARIANT_TIER[s] ?? 0.5; }
function genNumber(g: unknown): number | null { const m = String(g ?? "").match(/(\d{1,3})/); return m ? Number(m[1]) : null; }
export function deriveMobileDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, family: a.family ?? null, generation: a.generation ?? null,
    variant: a.variant ?? null, storage: a.storage != null ? Number(a.storage) : null,
    ram: Array.isArray(a.ram_values) && a.ram_values.length ? a.ram_values[0] : null };
}
export function decideMobile(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { storage_min?: number };
  const pr = task.priorities ?? [];
  const wantCamera = pr.includes("camera"), wantGaming = pr.includes("gaming"), wantBattery = pr.includes("battery"), wantLatest = pr.includes("latest");
  const maxGen = Math.max(0, ...rows.map((r) => genNumber((r.attributes ?? {}).generation) ?? 0));
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveMobileDna(row); const reasons: string[] = [];
    let score = 0.5;
    const tier = variantTier(a.variant); const storage = a.storage != null ? Number(a.storage) : null; const gen = genNumber(a.generation);
    if (wantCamera) { score += (tier - 0.5) * 0.3; if (tier >= 0.85) reasons.push(`إصدار ${a.variant} — كاميرا أفضل`); }
    if (wantGaming) { score += (tier - 0.5) * 0.2; if (storage && storage >= 256) { score += 0.05; reasons.push(`تخزين ${storage}GB — مناسب للألعاب`); } }
    if (wantBattery && /ultra|pro max|plus/i.test(String(a.variant))) { score += 0.08; reasons.push(`إصدار ${a.variant} — بطارية أكبر`); }
    if (wantLatest && gen != null && maxGen > 0) { const rec = gen / maxGen; score += (rec - 0.5) * 0.3; if (gen === maxGen) reasons.push(`الجيل ${gen} — الأحدث`); }
    if (t.storage_min && storage != null) { if (storage >= t.storage_min) { score += 0.08; reasons.push(`تخزين ${storage}GB (يكفي)`); } else { score -= 0.12; reasons.push(`⚠️ تخزين ${storage}GB أقل من المطلوب (${t.storage_min}GB)`); } }
    else if (storage != null) reasons.push(`تخزين ${storage}GB`);
    reasons.unshift(`${a.family ?? row.brand} ${a.generation ?? ""} ${a.variant && a.variant !== "Standard" ? a.variant : ""}`.replace(/\s+/g, " ").trim());
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.push(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.push("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.push(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.push(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Laptop: derive DNA + decide. Suitability = use-fit (gaming→discrete GPU+RAM,
//    productivity→RAM+CPU, portability→screen), storage, trust, budget. Ranking-blind.
//    Note: laptops are structurally single-store in KSA (ADR-032) — most results are
//    resolved-single (comparison_available:false), surfaced honestly. ──
export function deriveLaptopDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  const gpu = (a.gpu as string) ?? null;
  return { brand: row.brand, family: a.family ?? null, cpu: a.cpu ?? null,
    ram: a.ram != null ? Number(a.ram) : null, storage: a.storage != null ? Number(a.storage) : null,
    screen: a.screen != null ? Number(a.screen) : null, gpu,
    discrete_gpu: gpu ? gpu !== "igpu" : null };
}
export function decideLaptop(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { storage_min?: number; ram_min?: number };
  const pr = task.priorities ?? [];
  const wantGaming = pr.includes("gaming"), wantProductivity = pr.includes("productivity"), wantPortability = pr.includes("portability");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveLaptopDna(row); const reasons: string[] = [];
    let score = 0.5;
    const ram = a.ram != null ? Number(a.ram) : null; const storage = a.storage != null ? Number(a.storage) : null;
    const screen = a.screen != null ? Number(a.screen) : null; const gpu = (a.gpu as string) ?? null; const discrete = gpu ? gpu !== "igpu" : false;
    if (wantGaming) { if (discrete) { score += 0.15; reasons.push(`كرت شاشة منفصل (${gpu?.toUpperCase()}) — مناسب للألعاب`); } else { score -= 0.08; reasons.push("كرت مدمج — ضعيف للألعاب"); } if (ram && ram >= 16) { score += 0.06; reasons.push(`رام ${ram}GB`); } }
    if (wantProductivity) { if (ram && ram >= 16) { score += 0.1; reasons.push(`رام ${ram}GB — مناسب للإنتاجية`); } else if (ram) reasons.push(`رام ${ram}GB — متوسط للإنتاجية`); if (a.cpu) reasons.push(`معالج ${String(a.cpu).toUpperCase()}`); }
    if (wantPortability && screen != null) { if (screen <= 14) { score += 0.08; reasons.push(`شاشة ${screen}" — خفيف ومحمول`); } else reasons.push(`شاشة ${screen}" — أكبر (أثقل)`); }
    if (t.ram_min && ram != null) { if (ram >= t.ram_min) score += 0.06; else { score -= 0.1; reasons.push(`⚠️ رام ${ram}GB أقل من المطلوب (${t.ram_min}GB)`); } }
    if (t.storage_min && storage != null && storage < t.storage_min) { score -= 0.08; reasons.push(`⚠️ تخزين ${storage}GB أقل من المطلوب`); }
    else if (storage != null) reasons.push(`تخزين ${storage}GB`);
    reasons.unshift(`${row.brand ?? ""} ${a.family ?? ""} ${a.cpu ? String(a.cpu).toUpperCase() : ""}`.replace(/\s+/g, " ").trim());
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.push(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.push("متوفر في متجر واحد — المقارنة غير متاحة");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.push(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.push(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Category dispatcher. Deterministic per-category deciders; neutral trust+price
//    fallback for categories without a bespoke decider yet (no fabrication). ──
export function decide(task: ShoppingTask, rows: CanonicalRow[]): { supported: boolean; recommendations: Recommendation[] } {
  switch (task.category) {
    case "air_conditioner": return { supported: true, recommendations: decideAc(task, rows) };
    case "tv": return { supported: true, recommendations: decideTv(task, rows) };
    case "tablet": return { supported: true, recommendations: decideTablet(task, rows) };
    case "mobile": return { supported: true, recommendations: decideMobile(task, rows) };
    case "laptop": return { supported: true, recommendations: decideLaptop(task, rows) };
    default: {
      const scored = rows.map((row) => ({ row, dna: {}, score: 0.5 + ((row.store_count ?? 0) >= 2 ? 0.08 : 0),
        reasons: [(row.store_count ?? 0) >= 2 ? `سعر موثوق — متوفر في ${row.store_count} متاجر` : "متوفر في متجر واحد"],
        total: row.lowest_price ?? null, breakdown: { unit: row.lowest_price ?? null, installation: null, annual_electricity: null } }));
      return { supported: false, recommendations: assemble(scored) };
    }
  }
}
