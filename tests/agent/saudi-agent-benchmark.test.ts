/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SAUDI AGENT BENCHMARK — the permanent quality moat & anti-regression guarantee
 * (Strategic Brief §5.11). Representative Saudi shopping TASKS (not keywords) run
 * end-to-end through the deterministic pipeline (parseShoppingTask → decide →
 * explainChoice) against controlled fixtures, graded on Constitutional rubrics:
 *
 *   R1 parse        — the task's category/constraints are extracted
 *   R2 neutrality   — ranking is suitability/trust/total-cost, NOT price alone
 *                     (a cheap-but-unfit option never wins)
 *   R3 total-cost   — Saudi TCO (AC: unit + installation + est. electricity)
 *   R4 suitability  — Saudi-context fit (KSA-hot BTU sizing; inverter for bills)
 *   R5 no-fabricate — single-store labelled; undersize flagged; unresolved reported
 *   R6 honesty      — no fabricated comparison when there is no real alternative
 *   R7 reasoned     — "why A over B" when there IS a clear winner (§5.5)
 *
 * Every change to the agent is graded here. A regression fails CI loudly.
 * Deterministic & DB-free (synthetic fixtures) → reproducible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { parseShoppingTask } from "../../src/lib/agent/task-parser";
import { decide, explainChoice, type CanonicalRow, type Recommendation } from "../../src/lib/agent/decision-engine";

// ── compact fixture builders ──
let n = 0;
const base = (over: Partial<CanonicalRow>): CanonicalRow => ({
  canonical_id: over.canonical_id ?? `c${++n}`, tps_identity_key: "k", display_name_ar: over.display_name_ar ?? "منتج",
  display_name_en: "product", brand: "brand", category: "x", image_url: null, lowest_price: 1000, store_count: 1,
  has_comparison: false, identity_confidence: 80, attributes: {}, ...over,
});
const ac = (o: { btu: number; tech: string; cool?: string; price: number; stores: number; id?: string }) =>
  base({ canonical_id: o.id, category: "air_conditioner", brand: "gree", display_name_ar: `مكيف ${o.btu}`, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, attributes: { capacity_btu: o.btu, technology: o.tech, cooling_mode: o.cool ?? "cool_only", ac_type: "split" } });
const tv = (o: { size: number; res: string; panel: string; hz: number; price: number; stores: number; id?: string }) =>
  base({ canonical_id: o.id, category: "tv", brand: "samsung", display_name_ar: `تلفزيون ${o.panel}`, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, attributes: { screen_size: o.size, resolution: o.res, panel: o.panel, refresh_rate: o.hz } });
const laptop = (o: { cpu: string; ram: number; gpu: string; screen: number; price: number; stores: number; id?: string }) =>
  base({ canonical_id: o.id, category: "laptop", brand: "hp", display_name_ar: `لابتوب`, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, attributes: { family: "pavilion", cpu: o.cpu, ram: o.ram, storage: 512, screen: o.screen, gpu: o.gpu } });
const fridge = (o: { type: string; liters: number; inverter: boolean; price: number; stores: number; id?: string }) =>
  base({ canonical_id: o.id, category: "refrigerator", brand: "lg", display_name_ar: `ثلاجة`, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, attributes: { fridge_type: o.type, capacity_liters: o.liters, inverter: o.inverter } });
const appl = (cat: string, o: { type?: string; cap?: number; price: number; stores: number; id?: string; flags?: Record<string, boolean> }) =>
  base({ canonical_id: o.id, category: cat, brand: "midea", display_name_ar: cat, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, attributes: { appliance_type: o.type ?? null, capacity: o.cap ?? null, ...(o.flags ?? {}) } });

interface Rubric { name: string; pass: boolean; detail?: string }
type Out = { supported: boolean; recommendations: Recommendation[] };
const smart = (o: Out) => o.recommendations.find((r) => r.is_smart_pick);

interface Task { id: string; text: string; expectCategory: string; rows: CanonicalRow[]; grade: (o: Out, parsedCat: string) => Rubric[] }

const TASKS: Task[] = [
  {
    id: "ac-riyadh-30m-quiet-saving", text: "أبغى مكيف لغرفة 30 متر في الرياض، هادئ وموفر للكهرباء، تحت 4000",
    expectCategory: "air_conditioner",
    rows: [ac({ btu: 18000, tech: "Inverter", price: 1800, stores: 1, id: "under" }), ac({ btu: 24000, tech: "Inverter", price: 2600, stores: 2, id: "fit-inv" }), ac({ btu: 24000, tech: "Standard", price: 2300, stores: 1, id: "fit-std" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse", pass: pc === "air_conditioner" },
        { name: "R2 neutrality (not the cheapest)", pass: s.canonical_id !== "under", detail: `picked ${s.canonical_id}` },
        { name: "R3 total-cost (unit+install+elec)", pass: (s.total_cost_estimate ?? 0) > (s.unit_price ?? 0) },
        { name: "R4 saudi-suitability (≥24k for 30m², inverter)", pass: Number(s.dna.capacity_btu) >= 24000 && s.dna.inverter === true },
        { name: "R7 reasoned comparison", pass: !!explainChoice(s, o.recommendations.find((r) => !r.is_smart_pick)) },
      ];
    },
  },
  {
    id: "ac-undersize-flagged", text: "مكيف لغرفة 40 متر موفر للكهرباء",
    expectCategory: "air_conditioner",
    rows: [ac({ btu: 18000, tech: "Inverter", price: 1700, stores: 1, id: "small" })],
    grade: (o) => {
      const s = smart(o)!;
      return [
        { name: "R5 no-fabricate (undersize flagged)", pass: s.reasons_ar.some((r) => /أقل من المطلوب|⚠️/.test(r)), detail: s.reasons_ar.join("|") },
        { name: "R6 honesty (no fake comparison, 1 option)", pass: explainChoice(s, o.recommendations.find((r) => !r.is_smart_pick)) === null },
      ];
    },
  },
  {
    id: "ac-room-size-unresolved", text: "مكيف موفر للكهرباء",
    expectCategory: "air_conditioner", rows: [ac({ btu: 24000, tech: "Inverter", price: 2400, stores: 1 })],
    grade: (_o, _pc) => {
      const p = parseShoppingTask("مكيف موفر للكهرباء");
      return [{ name: "R5 no-fabricate (room size unresolved reported)", pass: (p.unresolved ?? []).includes("room_size_m2") }];
    },
  },
  {
    id: "tv-gaming-movies", text: "تلفزيون للألعاب والأفلام تحت 3000",
    expectCategory: "tv",
    rows: [tv({ size: 55, res: "4k", panel: "led", hz: 60, price: 1500, stores: 1, id: "cheap-led" }), tv({ size: 55, res: "4k", panel: "qled", hz: 120, price: 2600, stores: 2, id: "qled-120" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse", pass: pc === "tv" },
        { name: "R2 neutrality (gaming→120Hz beats cheaper 60Hz)", pass: s.canonical_id === "qled-120", detail: `picked ${s.canonical_id}` },
        { name: "R7 reasoned comparison", pass: !!explainChoice(s, o.recommendations.find((r) => !r.is_smart_pick)) },
      ];
    },
  },
  {
    id: "laptop-gaming-portable", text: "لابتوب للألعاب خفيف 16 جيجا رام تحت 5000",
    expectCategory: "laptop",
    rows: [laptop({ cpu: "i5", ram: 8, gpu: "igpu", screen: 15, price: 2500, stores: 1, id: "igpu" }), laptop({ cpu: "i7", ram: 16, gpu: "rtx4060", screen: 14, price: 4800, stores: 1, id: "discrete" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse (ram_min=16)", pass: (parseShoppingTask("لابتوب للألعاب خفيف 16 جيجا رام تحت 5000") as { ram_min?: number }).ram_min === 16 },
        { name: "R2 neutrality (gaming→discrete GPU beats cheaper iGPU)", pass: s.canonical_id === "discrete", detail: `picked ${s.canonical_id}` },
        { name: "R4 suitability (discrete gpu)", pass: s.dna.discrete_gpu === true },
      ];
    },
  },
  {
    id: "fridge-family-saving", text: "ثلاجة كبيرة للعائلة موفرة للكهرباء تحت 6000",
    expectCategory: "refrigerator",
    rows: [fridge({ type: "top_mount", liters: 300, inverter: false, price: 1800, stores: 1, id: "small-std" }), fridge({ type: "side_by_side", liters: 600, inverter: true, price: 4200, stores: 1, id: "big-inv" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse", pass: pc === "refrigerator" },
        { name: "R2 neutrality (family+saving beats cheaper small)", pass: s.canonical_id === "big-inv", detail: `picked ${s.canonical_id}` },
        { name: "R3 total-cost (24/7 electricity)", pass: (s.total_cost_estimate ?? 0) > (s.unit_price ?? 0) },
      ];
    },
  },
  {
    id: "dishwasher-family", text: "غسالة صحون كبيرة للعائلة",
    expectCategory: "dishwasher",
    rows: [appl("dishwasher", { type: "built_in", cap: 8, price: 1200, stores: 1, id: "small" }), appl("dishwasher", { type: "built_in", cap: 16, price: 1600, stores: 2, id: "large" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse (dishwasher not washing_machine)", pass: pc === "dishwasher" },
        { name: "R2 neutrality (family→larger capacity)", pass: s.canonical_id === "large", detail: `picked ${s.canonical_id}` },
      ];
    },
  },
  {
    id: "single-store-honest", text: "قلاية هوائية 8 لتر",
    expectCategory: "air_fryer",
    rows: [appl("air_fryer", { cap: 8, price: 400, stores: 1, id: "solo" })],
    grade: (o, pc) => {
      const s = smart(o)!;
      return [
        { name: "R1 parse", pass: pc === "air_fryer" },
        { name: "R5 no-fabricate (single-store labelled)", pass: s.comparison_available === false && s.reasons_ar.some((r) => /متجر واحد/.test(r)) },
        { name: "R6 honesty (no fake comparison)", pass: explainChoice(s, o.recommendations.find((r) => !r.is_smart_pick)) === null },
      ];
    },
  },
  {
    id: "trust-corroboration", text: "تلفزيون 55 بوصة",
    expectCategory: "tv",
    rows: [tv({ size: 55, res: "4k", panel: "qled", hz: 120, price: 2500, stores: 1, id: "single" }), tv({ size: 55, res: "4k", panel: "qled", hz: 120, price: 2500, stores: 3, id: "corrob" })],
    grade: (o) => {
      const s = smart(o)!;
      return [
        { name: "R2 trust (identical specs → corroborated wins)", pass: s.canonical_id === "corrob", detail: `picked ${s.canonical_id}` },
        { name: "R2 comparison_available true", pass: s.comparison_available === true },
      ];
    },
  },
];

describe("Saudi Agent Benchmark (permanent quality moat, §5.11)", () => {
  const scored: { task: string; rubrics: Rubric[] }[] = [];
  for (const task of TASKS) {
    it(`grades: ${task.id}`, () => {
      const parsed = parseShoppingTask(task.text);
      const taskObj = { ...parsed, category: parsed.category || task.expectCategory };
      const out = decide(taskObj, task.rows);
      const rubrics = task.grade(out, parsed.category || "");
      scored.push({ task: task.id, rubrics });
      const failed = rubrics.filter((r) => !r.pass);
      if (failed.length) throw new Error(`${task.id} failed: ${failed.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ""}`).join("; ")}`);
      expect(failed).toHaveLength(0);
    });
  }
  afterAll(() => {
    const all = scored.flatMap((s) => s.rubrics);
    const pass = all.filter((r) => r.pass).length;
    const byRubric: Record<string, { pass: number; total: number }> = {};
    for (const r of all) { const k = r.name.split(" ")[0]; (byRubric[k] ??= { pass: 0, total: 0 }); byRubric[k].total++; if (r.pass) byRubric[k].pass++; }
    /* eslint-disable no-console */
    console.log(`\n╭─ SAUDI AGENT BENCHMARK ─ ${TASKS.length} tasks, ${all.length} graded rubrics`);
    console.log(`│  overall: ${pass}/${all.length} (${Math.round((pass / all.length) * 100)}%)`);
    for (const [k, v] of Object.entries(byRubric).sort()) console.log(`│  ${k}: ${v.pass}/${v.total}`);
    console.log(`╰─ deterministic · ranking-blind · no-fabrication enforced\n`);
  });
});
