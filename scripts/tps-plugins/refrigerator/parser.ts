// scripts/tps-plugins/refrigerator/parser.ts — deterministic (Fridge Identity v1).
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
function extractType(x: string): string | null {
  if (/french\s*door|فرنش|أربعة أبواب|4\s*door|quad/.test(x)) return "french_door";
  if (/side\s*by\s*side|جنباً|جنبا|باب لباب/.test(x)) return "side_by_side";
  if (/bottom\s*mount|bottom\s*freezer|فريزر سفلي|مجمد سفلي/.test(x)) return "bottom_mount";
  if (/top\s*mount|top\s*freezer|فريزر علوي|مجمد علوي|بابين|2\s*door|double door/.test(x)) return "top_mount";
  if (/single\s*door|باب واحد|باب مفرد|mini|compact|صغيرة|ميني/.test(x)) return "single_door";
  return null;
}
function extractLiters(x: string): number | null {
  const l = x.match(/(\d{2,4})\s*(?:liter|litre|لتر|l\b)/i); if (l) { const n = Number(l[1]); if (n >= 40 && n <= 900) return Math.round(n / 10) * 10; }
  const cf = x.match(/(\d{1,2}(?:\.\d)?)\s*(?:cu\.?\s*ft|قدم|cubic)/i); if (cf) { const n = Math.round(parseFloat(cf[1]) * 28.3 / 10) * 10; if (n >= 40 && n <= 900) return n; }
  return null;
}
export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const full = `${nameAr} ${nameEn}`; const x = full.toLowerCase();
  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") { const g = x.match(/samsung|سامسون|\blg\b|ال جي|hisense|هايسنس|toshiba|توشيبا|panasonic|باناسونيك|classpro|كلاس برو|haier|هاير|midea|ميديا|gree|جري|beko|بيكو|daewoo|دايو|white ?westinghouse|nikai|نيكاي/); if (g) brand = canonicalizeBrand(g[0].trim()); }
  const fridge_type = extractType(x); const capacity_liters = extractLiters(full);
  const inverter = /inverter|انفرتر|إنفرتر/.test(x); const no_frost = /no\s*frost|نو فروست|بدون ثلج/.test(x);
  const flags: string[] = []; if (!fridge_type) flags.push("type_missing"); if (!capacity_liters) flags.push("capacity_missing");
  return { model_number: null, color: null, payload: { brand: brand === "unknown" ? null : brand, fridge_type, capacity_liters, inverter, no_frost }, ignored_terms: [], ambiguity_flags: flags };
}
