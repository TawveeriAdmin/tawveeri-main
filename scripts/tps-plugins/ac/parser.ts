// scripts/tps-plugins/ac/parser.ts
// نقل حرفي 100% من normalizeAC() في write-product-observations.ts
// + بناء ambiguity_flags هنا بنفس الشروط التي كانت في main() الأصلي
// + technology_inferred يُعاد كحقل صريح في NormalizeResult
// + Patch: التقاط On/Off (non-inverter) و Cooling المفردة

import type { NormalizeResult } from "../../tps-core/types";

export function normalize(nameAr: string, nameEn: string, _rawBrand: string | null): NormalizeResult {
  const combined = (nameAr + " " + nameEn).toLowerCase();
  const fullText  = nameAr + " " + nameEn;
  let capacity_btu: number | null = null;
  let technology: string | null = null;
  let technology_inferred = false;
  let compressor_type: string | null = null;
  let series_or_platform: string | null = null;
  let cooling_mode: string | null = null;
  let model_number: string | null = null;

  let ac_type: string | null = null;
  if (combined.includes("شباك")||combined.includes("window"))              ac_type="window";
  else if (combined.includes("نقال")||combined.includes("portable"))       ac_type="portable";
  else if (combined.includes("صحراوي")||combined.includes("evaporative")||combined.includes("air cooler")) ac_type="evaporative";
  else if (combined.includes("دولابي")||combined.includes("cabinet")||combined.includes("floor standing")) ac_type="cabinet";
  else if (combined.includes("كاسيت")||combined.includes("cassette"))      ac_type="cassette";
  else if (combined.includes("مخفي")||combined.includes("ducted")||combined.includes("ceiling")) ac_type="ducted";
  else if (combined.includes("سبليت")||combined.includes("جداري")||combined.includes("split")) ac_type="split";

  const btu = fullText.match(/(\d[\d\s,]*)\s*(?:BTU|وحدة\s*حرارية|وحدة\s*تبريد|وحدة)/i);
  if (btu) capacity_btu = parseInt(btu[1].replace(/[\s,]/g, ""));
  if (!capacity_btu) {
    const short = fullText.match(/\b(\d{2})\s*(?:وحدة\s*حرارية|وحدة\s*تبريد)/);
    if (short) { const v = parseInt(short[1]); if (v >= 9 && v <= 36) capacity_btu = v * 1000; }
  }
  if (!capacity_btu) {
    const direct = fullText.match(/\b(\d{4,5})\b/g);
    if (direct) { for (const n of direct) { const v = parseInt(n); if (v >= 9000 && v <= 60000) { capacity_btu = v; break; } } }
  }

  if (combined.includes("rotary")||combined.includes("روتاري")||combined.includes("راوتري"))
    compressor_type = "Rotary";
  if (combined.includes("windfree")||combined.includes("ويند فري"))
    { series_or_platform = "WindFree"; technology = "Inverter"; }
  if (combined.includes("bespoke") && !series_or_platform)
    series_or_platform = "Bespoke";
  if (!technology) {
    if (combined.includes("triple inverter")) technology = "Triple Inverter";
    else if (
      combined.includes("inverter")||combined.includes("إنفرتر")||
      combined.includes("انفرتر")||combined.includes("كومبرسر انفرتر")||
      combined.includes("ضاغط انفرتر")
    ) technology = "Inverter";
  }
  // ── Patch 1: On/Off (وغير إنفرتر) تعني non-inverter صراحةً — ليست استنتاجاً ──
  if (!technology && (
    combined.includes("on/off")||combined.includes("on / off")||
    combined.includes("on-off")||combined.includes("أون/أوف")||
    combined.includes("غير انفرتر")||combined.includes("غير إنفرتر")||
    combined.includes("non inverter")||combined.includes("non-inverter")
  )) technology = "Standard";
  if (!technology && compressor_type === "Rotary") { technology = "Standard"; technology_inferred = true; }

  if (
    combined.includes("بارد وحار")||combined.includes("حار بارد")||
    combined.includes("بارد / حار")||combined.includes("بارد/حار")||
    combined.includes("حار وبارد")||
    combined.includes("hot and cool")||combined.includes("hot and cold")||
    combined.includes("hot & cold")||combined.includes("heat & cool")||
    combined.includes("heat&cool")||combined.includes("hot/cold")||
    combined.includes("heating and cooling")||combined.includes("heat cool")
  ) cooling_mode = "hot_cold";
  else if (
    combined.includes("بارد فقط")||combined.includes("تبريد فقط")||
    combined.includes("cool only")||combined.includes("cold only")||
    combined.includes("cooling only")
  ) cooling_mode = "cool_only";
  else if (combined.includes("بارد") && !combined.includes("حار")) cooling_mode = "cool_only";
  else if (combined.includes("cold") && !combined.includes("hot") && !combined.includes("heat")) cooling_mode = "cool_only";
  // ── Patch 2: "Cooling" المفردة / "تبريد" / "Turbo Cooling" تعني cool_only ──
  else if (
    combined.includes("cooling")||combined.includes("تبريد")||
    combined.includes("turbo cooling")
  ) cooling_mode = "cool_only";

  const model = fullText.match(/\b([A-Z]{2}\d+[A-Z0-9\/\-]+(?:\/[A-Z]{2})?)\b/);
  if (model) model_number = model[1];

  // ── يُبنى هنا بنفس الشروط التي كانت في main() الأصلي ──────
  const ambiguity_flags: string[] = [];
  if (!series_or_platform) ambiguity_flags.push("no_series_detected");
  if (technology_inferred) ambiguity_flags.push("inferred_standard_from_rotary");

  return {
    model_number,
    payload: { capacity_btu, technology, compressor_type, ac_type, series_or_platform, cooling_mode },
    ambiguity_flags,
    technology_inferred,
  };
}