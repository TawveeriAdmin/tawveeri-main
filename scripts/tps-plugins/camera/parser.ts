// scripts/tps-plugins/camera/parser.ts
// Deterministic camera normalization (Camera Identity Contract v1). IDENTITY:
// brand, model (line + variant, e.g. EOS R50 ≠ R50 V), config (kit-lens focal
// range vs body — a body and a lens kit are different SKUs/prices). COMMERCIAL:
// colour, extra bundles, warranty, region. "لا نخمّن — نقرأ".
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

function extractModel(text: string): string | null {
  const x = text.toLowerCase();
  // Canon EOS (RF mirrorless Rxx[ V], DSLR xxxxD, EOS M) + optional Mark
  const canon = x.match(/eos\s*(r\d{1,3})\s*(v|c)?\s*(mark\s*[iv]+|ii|iii)?/) || x.match(/eos\s*(\d{3,4}d)/) || x.match(/eos\s*(m\d{1,2})/);
  if (canon) { const v = canon[2] ? " " + canon[2] : ""; const mk = canon[3] ? " " + canon[3].replace(/\s+/g, "") : ""; return "eos " + canon[1] + v + mk; }
  const powershot = x.match(/powershot\s*([a-z]?\d{1,3}[a-z]?)/); if (powershot) return "powershot " + powershot[1];
  const nikon = x.match(/\b(z\s*\d{1,2}|d\d{3,4})\b/); if (nikon) return nikon[1].replace(/\s+/g, "");
  const sony = x.match(/(?:alpha|\ba)\s*(7\s*[rsc]?\s*[iv]{0,3}|\d{4}|6\d{3})/); if (sony) return "a" + sony[1].replace(/\s+/g, "");
  const fuji = x.match(/x-?([a-z]\d{1,2}|t\d{1,2}|s\d{2})/); if (fuji) return "x-" + fuji[1];
  const gopro = x.match(/hero\s*(\d{1,2})/); if (gopro) return "hero " + gopro[1];
  return null;
}
// Kit-lens focal range distinguishes a kit from a body (and different kits).
function extractConfig(text: string): string {
  const m = text.match(/(\d{2,3})\s*-\s*(\d{2,4})\s*mm/);
  if (m) return `${m[1]}-${m[2]}`;
  if (/body\s*only|\(body\)|هيكل فقط|بدون عدسة/i.test(text)) return "body";
  const single = text.match(/\b(\d{2,3})\s*mm\b/);
  if (single) return single[1] + "mm";
  return "body";
}
function extractColor(text: string): string | null {
  const x = text.toLowerCase();
  if (/black|أسود|اسود/.test(x)) return "black"; if (/silver|فضي/.test(x)) return "silver"; if (/white|أبيض/.test(x)) return "white";
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();
  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/canon|كانون|eos|nikon|نيكون|sony|سوني|alpha|fujifilm|fuji|فوجي|lumix|panasonic|gopro|dji/);
    if (guess) brand = canonicalizeBrand(guess[0]);
  }
  if (!["canon", "nikon", "sony", "fujifilm", "panasonic", "gopro", "dji"].includes(brand) && /\beos\b/.test(combined)) brand = "canon";

  const model = extractModel(fullText);
  const config = extractConfig(fullText);
  const color = extractColor(fullText);

  const ambiguity_flags: string[] = [];
  if (!model) ambiguity_flags.push("model_missing");

  return {
    model_number: model,
    color,
    payload: { brand: brand === "unknown" ? null : brand, model, config, color },
    ignored_terms: [],
    ambiguity_flags,
  };
}
