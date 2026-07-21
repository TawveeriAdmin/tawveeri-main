// scripts/tps-plugins/tv/parser.ts
// Deterministic TV normalization (TV Identity Contract v1). IDENTITY attributes:
// brand, screen_size, resolution, panel, (manufacturer) model_number. NON-identity
// attributes carried for display/quality only: refresh_rate, series, color, year.
// "لا نخمّن — نقرأ": every attribute read from the text, never inferred.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

function extractSize(text: string): number | null {
  const m = text.match(/\b(3[2-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|”|بوصة|انش|إنش)/i);
  if (m) { const n = Number(m[1]); if (n >= 19 && n <= 120) return n; }
  return null;
}
function extractResolution(text: string): string | null {
  const x = text.toLowerCase();
  if (/\b8k\b/.test(x)) return "8k";
  if (/\b4k\b|uhd|ultra\s*hd/.test(x)) return "4k";
  if (/full\s*hd|\bfhd\b|1080p?/.test(x)) return "fhd";
  if (/\bhd\b|720p?/.test(x)) return "hd";
  return null;
}
// Panel is an identity axis (OLED ≠ QLED ≠ LED). Order: most specific first.
function extractPanel(text: string): string | null {
  const x = text.toLowerCase();
  if (/neo\s*qled/.test(x)) return "neo_qled";
  if (/\boled\b/.test(x)) return "oled";
  if (/\bqned\b/.test(x)) return "qned";
  if (/nano\s*cell|nanocell/.test(x)) return "nanocell";
  if (/mini\s*led/.test(x)) return "mini_led";
  if (/\bqled\b/.test(x)) return "qled";
  if (/crystal/.test(x)) return "crystal";
  if (/\bled\b/.test(x)) return "led";
  return null;
}
function extractRefresh(text: string): number | null {
  const m = text.match(/\b(60|75|100|120|144|165|240)\s*hz/i);
  return m ? Number(m[1]) : null;
}
function extractSeries(text: string): string | null {
  // partial series/model code often present in Jarir titles (Q71Q, QNED70, P7L,
  // QN1EF). NON-identity (stores are inconsistent) — carried for display only.
  const m = text.match(/\b(Q[N]?\d[A-Z0-9]{1,4}|QNED\d{2}|P\d{1,2}[A-Z]|U\d[A-Z]\d?|C\d{3,4}|G\d)\b/);
  return m ? m[1].toUpperCase() : null;
}
function extractColor(text: string): string | null {
  const x = text.toLowerCase();
  if (/black|أسود|اسود/.test(x)) return "black";
  if (/silver|فضي/.test(x)) return "silver";
  if (/grey|gray|رمادي/.test(x)) return "gray";
  return null;
}
function isRetailerSku(s: string): boolean {
  if (/^B0[A-Z0-9]{8}$/i.test(s)) return true;   // Amazon ASIN
  if (/^\d{5,8}$/.test(s)) return true;           // numeric retailer SKU
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return true;
  return false;
}
function extractModelNumber(payload: Record<string, unknown>): string | null {
  for (const c of [payload.mpn, payload.model, payload.sku]) {
    const s = typeof c === "string" ? c.trim() : "";
    if (s && /^[A-Za-z0-9][A-Za-z0-9\-\/.]{4,18}$/.test(s) && !/\s/.test(s) && !isRetailerSku(s)) return s.toUpperCase();
  }
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/samsung|سامسون|\blg\b|ال جي|sony|سوني|\btcl\b|تي سي|hisense|هايسنس|toshiba|توشيبا|nikai|نيكاي|panasonic|philips|فيليبس|dansat|دان ?سات|skyworth|haier|هاير|vision/);
    if (guess) brand = canonicalizeBrand(guess[0].trim());
  }

  const screen_size = extractSize(fullText);
  const resolution = extractResolution(fullText);
  const panel = extractPanel(fullText);
  const refresh_rate = extractRefresh(fullText);
  const series = extractSeries(fullText);
  const color = extractColor(fullText);
  const model_number = extractModelNumber(payload);

  const ambiguity_flags: string[] = [];
  if (!screen_size) ambiguity_flags.push("size_missing");
  if (!resolution) ambiguity_flags.push("resolution_missing");
  if (!panel) ambiguity_flags.push("panel_missing");

  return {
    model_number,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      screen_size, resolution, panel,
      // NON-identity (display/quality only):
      refresh_rate, series, color, smart: /smart|google tv|android tv|webos|tizen/.test(combined),
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
