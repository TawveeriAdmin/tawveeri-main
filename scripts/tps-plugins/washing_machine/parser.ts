// scripts/tps-plugins/washing_machine/parser.ts — deterministic (Washer Identity v1).
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
function extractType(x: string): string | null {
  if (/front\s*load|أمامي|تحميل أمامي|فرونت/.test(x)) return "front_load";
  if (/top\s*load|علوي|تحميل علوي|توب/.test(x)) return "top_load";
  return null;
}
function extractKg(x: string): number | null {
  // Washer/dryer combos print "13/8 kg" or "25kg + 18kg" (wash + dry) — take the wash
  // (first, larger) capacity, since that is the discriminating spec buyers compare on.
  const combo = x.match(/(\d{1,2}(?:\.\d)?)\s*(?:\/|\+)\s*\d{1,2}(?:\.\d)?\s*(?:kg|كجم|كيلو|كغم)/i);
  const m = combo ?? x.match(/(\d{1,2}(?:\.\d)?)\s*(?:kg|كجم|كيلو|كغم)/i);
  if (m) { const n = parseFloat(m[1]); if (n >= 4 && n <= 25) return Math.round(n * 2) / 2; }
  return null;
}
export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const full = `${nameAr} ${nameEn}`; const x = full.toLowerCase();
  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") { const g = x.match(/samsung|سامسون|\blg\b|ال جي|hisense|هايسنس|toshiba|توشيبا|panasonic|باناسونيك|classpro|كلاس برو|haier|هاير|midea|ميديا|bosch|بوش|beko|بيكو|daewoo|دايو|denx|نيكاي|nikai|white ?westinghouse/); if (g) brand = canonicalizeBrand(g[0].trim()); }
  const capacity_kg = extractKg(full);
  const inverter = /inverter|انفرتر|إنفرتر/.test(x);
  const has_dryer = /washer\s*\/?\s*dryer|غسالة ونشافة|مع نشاف|dryer|نشاف|مجفف ملابس/.test(x);
  // ADR-350 (2026-09-13): a title that mentions "dryer"/"نشاف" but NEVER mentions a washer
  // at all ("غسالة"/"washer"/"washing machine") is a STANDALONE dryer, not a washer or a
  // washer/dryer combo — it has no washing function whatsoever. Conflating it with "washer"
  // or "combo" would mislabel the product to the customer (a real, disclosed product-truth
  // risk, not a cosmetic one). Proven cases: Samsung's own "Bespoke AI Dryer with Hybrid Heat
  // Pump...17kg" and "16kg Inverter Heatpump Dryer" never say "washer" anywhere.
  const mentionsWasher = /غسالة|\bwasher\b|washing machine/.test(x);
  const is_dryer_only = has_dryer && !mentionsWasher;
  // Standalone dryers are never described as "front load"/"top load" (that is
  // washer-drum terminology) — extractType would always return null for them, which must
  // not be conflated with "type genuinely unknown for a real washer". It gets its own type
  // value instead, both here and at the identity layer.
  const washer_type = is_dryer_only ? "dryer_only" : extractType(x);
  const flags: string[] = []; if (!washer_type) flags.push("type_missing"); if (!capacity_kg) flags.push("capacity_missing");
  return { model_number: null, color: null, payload: { brand: brand === "unknown" ? null : brand, washer_type, capacity_kg, inverter, has_dryer, is_dryer_only }, ignored_terms: [], ambiguity_flags: flags };
}
