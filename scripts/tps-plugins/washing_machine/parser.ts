// scripts/tps-plugins/washing_machine/parser.ts — deterministic (Washer Identity v1).
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
function extractType(x: string): string | null {
  if (/front\s*load|أمامي|تحميل أمامي|فرونت/.test(x)) return "front_load";
  if (/top\s*load|علوي|تحميل علوي|توب/.test(x)) return "top_load";
  return null;
}
function extractKg(x: string): number | null {
  // Washer/dryer combos print "13/8 kg" (wash/dry) — take the wash (first) capacity.
  const combo = x.match(/(\d{1,2}(?:\.\d)?)\s*\/\s*\d{1,2}(?:\.\d)?\s*(?:kg|كجم|كيلو|كغم)/i);
  const m = combo ?? x.match(/(\d{1,2}(?:\.\d)?)\s*(?:kg|كجم|كيلو|كغم)/i);
  if (m) { const n = parseFloat(m[1]); if (n >= 4 && n <= 25) return Math.round(n * 2) / 2; }
  return null;
}
export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const full = `${nameAr} ${nameEn}`; const x = full.toLowerCase();
  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") { const g = x.match(/samsung|سامسون|\blg\b|ال جي|hisense|هايسنس|toshiba|توشيبا|panasonic|باناسونيك|classpro|كلاس برو|haier|هاير|midea|ميديا|bosch|بوش|beko|بيكو|daewoo|دايو|denx|نيكاي|nikai|white ?westinghouse/); if (g) brand = canonicalizeBrand(g[0].trim()); }
  const washer_type = extractType(x); const capacity_kg = extractKg(full);
  const inverter = /inverter|انفرتر|إنفرتر/.test(x); const has_dryer = /washer\s*\/?\s*dryer|غسالة ونشافة|مع نشاف|dryer/.test(x);
  const flags: string[] = []; if (!washer_type) flags.push("type_missing"); if (!capacity_kg) flags.push("capacity_missing");
  return { model_number: null, color: null, payload: { brand: brand === "unknown" ? null : brand, washer_type, capacity_kg, inverter, has_dryer }, ignored_terms: [], ambiguity_flags: flags };
}
