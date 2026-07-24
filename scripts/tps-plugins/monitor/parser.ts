// scripts/tps-plugins/monitor/parser.ts
// Deterministic monitor normalization (Monitor Identity Contract v1). IDENTITY:
// brand, screen_size, resolution, refresh_rate, panel. NON-identity (display /
// quality only): line/series (Odyssey G5, UltraGear), curved, ultrawide, colour.
// Adapted from the TV plugin — the closest analogue — but refresh rate is central
// (gaming monitors are defined by it) and text is Arabic-folded, since Almanea/
// Extra write size ("32 بوصة") and refresh ("180 هرتز") in Arabic.
// "لا نخمّن — نقرأ": every attribute is read from the text, never inferred.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { normalizeArabic } from "../../tps-core/text";

// Monitors are 17"–57" (ultrawide/superwide reach 49"/57"). Decimals like 24.5,
// 31.5 are real. Reject anything outside the physical range.
function extractSize(x: string): number | null {
  const m = x.match(/\b(1[7-9]|[2-4]\d|5[0-7])(\.\d)?\s*(?:inch|"|”|بوصه|انش|انس)/);
  if (m) { const n = parseFloat(m[1] + (m[2] ?? "")); if (n >= 17 && n <= 57) return n; }
  return null;
}

// Resolution — most specific first. Ultrawide widths (2560x1080, 3440x1440) get
// their own tokens so a 27" QHD flat and a 34" UWQHD ultrawide never merge.
function extractResolution(x: string): string | null {
  if (/\b8k\b|7680\s*x\s*4320/.test(x)) return "8k";
  if (/\b5k\b|5120\s*x\s*2880/.test(x)) return "5k";
  if (/\b4k\b|uhd|3840\s*x\s*2160/.test(x)) return "4k";
  if (/3440\s*x\s*1440|uwqhd/.test(x)) return "uwqhd";
  if (/2560\s*x\s*1080|\bwfhd\b/.test(x)) return "wfhd";
  if (/2560\s*x\s*1440|wqhd|\bqhd\b|\b2k\b|1440p/.test(x)) return "qhd";
  if (/1920\s*x\s*1200|wuxga/.test(x)) return "wuxga";
  if (/1920\s*x\s*1080|full\s*hd|\bfhd\b|1080p/.test(x)) return "fhd";
  if (/1366\s*x\s*768|1280\s*x\s*720|\bhd\b|720p/.test(x)) return "hd";
  return null;
}

function extractRefresh(x: string): number | null {
  const m = x.match(/\b(60|75|85|100|120|144|160|165|170|180|200|240|280|300|360|380|500)\s*(?:hz|هرتز)/);
  return m ? Number(m[1]) : null;
}

// Panel is a real identity axis (OLED ≠ IPS ≠ VA ≠ TN). Order: most specific first.
function extractPanel(x: string): string | null {
  if (/\boled\b|qd[-\s]?oled/.test(x)) return "oled";
  if (/fast\s*ips|nano\s*ips|\bips\b/.test(x)) return "ips";
  if (/\bva\b|\bmva\b|\bpva\b|vertical\s*alignment/.test(x)) return "va";
  if (/\btn\b/.test(x)) return "tn";
  return null;
}

// Marketing line + generation — NON-identity (stores are inconsistent), carried
// for display/quality. Distinct series (Odyssey G5 vs G6) usually differ in
// refresh/panel anyway, which ARE in the key.
function extractLine(x: string): string | null {
  const samsung = x.match(/odyssey\s*(neo\s*)?(g\d)|smart\s*monitor\s*(m\d)|viewfinity|essential/);
  if (samsung) return samsung[0].replace(/\s+/g, " ").trim();
  const lg = x.match(/ultragear|ultrawide|ultrafine|dualup|myview/);
  if (lg) return lg[0];
  const acer = x.match(/nitro|predator/);
  if (acer) return acer[0];
  const asus = x.match(/\brog\b|\btuf\b|proart/);
  if (asus) return asus[0];
  return null;
}

function extractColor(x: string): string | null {
  if (/black|اسود|أسود/.test(x)) return "black";
  if (/white|ابيض|أبيض/.test(x)) return "white";
  if (/silver|فضي/.test(x)) return "silver";
  if (/gr[ae]y|رمادي/.test(x)) return "gray";
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  // Preserve the inch mark BEFORE folding: normalizeArabic strips " ” ″ '', so a
  // size written 27" (very common for monitors) would otherwise lose its unit.
  const x = normalizeArabic(fullText.replace(/(\d)\s*(?:["”″“]|'')/g, "$1 inch"));

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = x.match(/samsung|سامسون|\blg\b|ال جي|acer|ايسر|\bhp\b|اتش بي|asus|اسوس|\bdell\b|ديل|\baoc\b|dahua|داهوا|lenovo|لينوفو|xiaomi|شاومي|\bmsi\b|viewsonic|\bbenq\b|gigabyte|philips|فيليبس|huawei|هواوي|gameon|koorui/);
    if (guess) brand = canonicalizeBrand(guess[0].trim());
  }

  const screen_size = extractSize(x);
  const resolution = extractResolution(x);
  const refresh_rate = extractRefresh(x);
  const panel = extractPanel(x);
  const line = extractLine(x);
  const curved = /curved|منحني|منحنيه|منحنيه|مقوس/.test(x);
  const ultrawide = /ultra\s*wide|ultrawide|الترا\s*وايد|21:9|32:9/.test(x);
  const color = extractColor(x);
  void payload; // structured store fields unused; monitor identity is spec-only (see identity.ts)

  const ambiguity_flags: string[] = [];
  if (!screen_size) ambiguity_flags.push("size_missing");
  if (!resolution) ambiguity_flags.push("resolution_missing");
  if (!refresh_rate) ambiguity_flags.push("refresh_missing");

  return {
    model_number: null,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      screen_size, resolution, refresh_rate, panel,
      // NON-identity (display/quality only):
      line, curved, ultrawide, color,
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
