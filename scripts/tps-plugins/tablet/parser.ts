// scripts/tps-plugins/tablet/parser.ts
// Deterministic tablet normalization (Tablet Identity Contract v1). IDENTITY:
// brand, line (incl. variant Plus/FE/Ultra/Pro/Air/Mini + series number),
// generation/chip, storage, connectivity (wifi/5g/4g/cellular), screen_size,
// ram. COMMERCIAL (never in identity): color, bundle (case/pen/keyboard),
// warranty, region, year, seller extras, model_number-encoded colour.
// "لا نخمّن — نقرأ": every attribute read from text, never inferred.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { extractManufacturerModel } from "../../../src/lib/identity/store-identifiers";

// ── Line + variant (canonical token). Order: most specific first. ──
function extractLine(text: string): string | null {
  const x = text.toLowerCase();
  // Apple iPad family
  if (/ipad|ايباد|آيباد/.test(x)) {
    if (/ipad\s*pro|ايباد\s*برو/.test(x)) return "ipad pro";
    if (/ipad\s*air|ايباد\s*اير/.test(x)) return "ipad air";
    if (/ipad\s*mini|ايباد\s*ميني/.test(x)) return "ipad mini";
    return "ipad";
  }
  // Samsung Galaxy Tab S / A + series number + variant
  const sm = x.match(/galaxy\s*tab\s*(s|a)\s*(\d{1,2})\s*(ultra|plus|\+|fe)?/) || x.match(/تاب\s*(s|a|اس|ايه)\s*(\d{1,2})\s*(ألترا|بلس|\+|اف اي)?/);
  if (sm) {
    const fam = /s|اس/i.test(sm[1]) ? "s" : "a";
    const v = sm[3] ? (/ultra|ألترا/.test(sm[3]) ? " ultra" : /fe|اف اي/.test(sm[3]) ? " fe" : " plus") : (/\btab\s*a\s*\d{1,2}\s*\+|a\d{1,2}\+/.test(x) ? " plus" : "");
    return `galaxy tab ${fam}${sm[2]}${v}`;
  }
  if (/galaxy\s*tab|جالكسي\s*تاب/.test(x)) return "galaxy tab";
  // Huawei MatePad
  if (/matepad|mate\s*pad|ماتباد/.test(x)) {
    if (/matepad\s*pro/.test(x)) return "matepad pro";
    if (/matepad\s*air/.test(x)) return "matepad air";
    if (/matepad\s*se/.test(x)) return "matepad se";
    return "matepad";
  }
  if (/idea\s*tab/.test(x)) return "idea tab";
  if (/honor\s*pad/.test(x)) { const m = x.match(/honor\s*pad\s*([a-z0-9]{1,4})/); return "honor pad" + (m ? " " + m[1] : ""); }
  if (/redmi\s*pad|mi\s*pad/.test(x)) { const m = x.match(/(redmi|mi)\s*pad\s*(pro|se|\d)?/); return "xiaomi pad" + (m && m[2] ? " " + m[2] : ""); }
  return null;
}

// ── Apple chip / generation (identity for iPad: Air M2 ≠ Air M4) ──
function extractGen(text: string): string | null {
  const x = text.toLowerCase();
  const chip = x.match(/\b(m[1-5])\b/);
  if (chip) return chip[1];
  const a = x.match(/\bipad\s*(a\d{2})\b|\b(a1[0-9])\s*chip/); // iPad A16
  if (a) return (a[1] || a[2]);
  const gen = x.match(/\b(\d{1,2})(?:th|st|nd|rd|)\s*gen(?:eration)?/);
  if (gen) return "gen" + gen[1];
  return null;
}

function extractStorage(text: string): number | null {
  const x = text.toLowerCase();
  const tb = x.match(/\b(\d)\s*tb\b/); if (tb) return Number(tb[1]) * 1024;
  // storage in tablets: prefer a "NNN GB" not immediately preceded by "ram/RAM"
  const m = [...x.matchAll(/(\d{2,4})\s*gb/g)].map((mm) => Number(mm[1])).filter((n) => [16, 32, 64, 128, 256, 512, 1024].includes(n));
  if (!m.length) return null;
  // If two GB numbers (e.g. "6GB RAM 128GB"), storage is the larger typical value.
  return Math.max(...m);
}
function extractRam(text: string): number | null {
  const x = text.toLowerCase();
  const m = x.match(/(\d{1,2})\s*gb\s*(?:ram|ذاكرة)/) || x.match(/(\d{1,2})\s*\+\s*\d{2,4}\s*gb/) || x.match(/ram[:\s]*(\d{1,2})/);
  if (m) { const n = Number(m[1]); if ([2, 3, 4, 6, 8, 12, 16].includes(n)) return n; }
  return null;
}
function extractSize(text: string): number | null {
  const m = text.match(/\b(7|8(?:\.\d)?|9(?:\.\d)?|10(?:\.\d)?|11(?:\.\d)?|12(?:\.\d)?|13(?:\.\d)?|14(?:\.\d)?)\s*(?:inch|["”]|بوصة|انش)/i);
  if (m) { const n = parseFloat(m[1]); if (n >= 7 && n <= 15) return n; }
  return null;
}
// Connectivity is identity: Wi-Fi-only vs cellular are different SKUs/prices.
function extractConnectivity(text: string): string | null {
  const x = text.toLowerCase();
  if (/\b5g\b|خامس/.test(x)) return "5g";
  if (/\b4g\b|\blte\b/.test(x)) return "4g";
  if (/cellular|خلوي|sim|شريحة/.test(x)) return "cellular";
  if (/wi-?fi|واي\s*فاي/.test(x)) return "wifi";
  return null;
}
function extractColor(text: string): string | null {
  const x = text.toLowerCase();
  const map: [RegExp, string][] = [[/space\s*gr[ae]y|رمادي فلكي/, "space gray"], [/gr[ae]y|رمادي/, "gray"], [/silver|فضي/, "silver"], [/black|أسود|اسود/, "black"], [/blue|أزرق|ازرق/, "blue"], [/starlight/, "starlight"], [/gold|ذهبي/, "gold"], [/purple|بنفسج/, "purple"], [/green|أخضر|اخضر/, "green"]];
  for (const [re, v] of map) if (re.test(x)) return v;
  return null;
}
// Model-number extraction delegated to the single key-integrity authority
// (ADR-058) — see src/lib/identity/store-identifiers.ts.

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/apple|ابل|ايباد|ipad|samsung|سامسون|galaxy tab|huawei|هواوي|matepad|lenovo|لينوفو|idea tab|honor|هونر|xiaomi|شاومي|redmi|nokia|نوكيا/);
    if (guess) brand = canonicalizeBrand(guess[0]);
  }
  // iPad implies Apple even if the brand token is absent or the guess resolved
  // to a non-brand token ("ipad").
  const KNOWN = ["apple", "samsung", "huawei", "lenovo", "honor", "xiaomi", "nokia"];
  if (!KNOWN.includes(brand) && /\bipad\b|ايباد|آيباد/.test(combined)) brand = "apple";

  let line = extractLine(fullText);
  // Kids/Education editions are distinct products (ruggedized) — keep them from
  // merging with the base line. Evidence: MatePad SE Kids (749) vs SE 11 (699).
  if (line && /\bkids\b|kids\s*edition|للأطفال|الاطفال/i.test(combined)) line = `${line} kids`;
  const gen = extractGen(fullText);
  const storage = extractStorage(fullText);
  const ram = extractRam(fullText);
  let screen_size = extractSize(fullText);
  // Apple: the number after Air/Pro IS the screen size (often unitless, e.g.
  // "iPad Air 11 M4"); iPad mini is 8.3". Derive when the generic size regex
  // missed it.
  if (screen_size == null && brand === "apple") {
    const ap = combined.match(/ipad\s*(?:air|pro)\s*(1[0-3](?:\.\d)?)\b/);
    if (ap) screen_size = parseFloat(ap[1]);
    else if (/ipad\s*mini/.test(combined)) screen_size = 8.3;
  }
  const connectivity = extractConnectivity(fullText);
  const color = extractColor(fullText);
  const model_number = extractManufacturerModel(payload);
  const bundle = /with\s+(folio|case|cover|pen|pencil|keyboard|stylus)|مع\s+(قلم|كفر|غطاء|لوحة)/i.test(fullText);

  const ambiguity_flags: string[] = [];
  if (!line) ambiguity_flags.push("line_missing");
  if (!storage) ambiguity_flags.push("storage_missing");
  if (!connectivity) ambiguity_flags.push("connectivity_missing");
  if (!screen_size) ambiguity_flags.push("screen_missing");

  return {
    model_number,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      line, gen, storage, ram, screen_size, connectivity,
      // Commercial (never in identity):
      color, bundle, year: (combined.match(/\b(202[0-9])\b/) || [])[1] ?? null,
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
