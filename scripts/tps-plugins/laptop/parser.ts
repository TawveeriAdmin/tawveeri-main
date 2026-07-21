// scripts/tps-plugins/laptop/parser.ts
// Deterministic laptop normalization (Laptop Identity Contract v1).
// Extracts IDENTITY attributes (family, cpu, ram, storage, screen, gpu, model)
// and keeps COMMERCIAL attributes (color, os_edition) strictly separate — never
// in the identity key. "لا نخمّن — نقرأ": every attribute is read from the text,
// never inferred. Ambiguity is flagged, not resolved by guessing.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

// ── Family / series per brand (canonical family token). Order matters: longer /
//    more specific first. Value is the canonical family string used in identity.
const FAMILIES: [RegExp, string][] = [
  // Apple
  [/macbook\s*air|ماك\s*بوك\s*اير/i, "macbook air"],
  [/macbook\s*pro|ماك\s*بوك\s*برو/i, "macbook pro"],
  // Lenovo
  [/thinkpad/i, "thinkpad"], [/thinkbook/i, "thinkbook"],
  [/ideapad\s*(?:gaming|slim\s*\d|slim|\d)?/i, "ideapad"],
  [/legion/i, "legion"], [/\bloq\b/i, "loq"], [/yoga\s*(?:pro|slim|book)?/i, "yoga"],
  // HP
  [/pavilion/i, "pavilion"], [/\benvy\b/i, "envy"], [/\bomen\b/i, "omen"], [/victus/i, "victus"],
  [/elitebook/i, "elitebook"], [/probook/i, "probook"], [/spectre/i, "spectre"], [/zbook/i, "zbook"],
  // Dell
  [/inspiron/i, "inspiron"], [/\bxps\b/i, "xps"], [/latitude/i, "latitude"], [/vostro/i, "vostro"],
  [/alienware/i, "alienware"], [/precision/i, "precision"], [/\bg1[567]\b/i, "dell g-series"],
  // Asus
  [/zenbook/i, "zenbook"], [/vivobook/i, "vivobook"], [/\brog\b/i, "rog"], [/\btuf\b/i, "tuf"],
  [/proart/i, "proart"], [/expertbook/i, "expertbook"],
  // Acer
  [/aspire/i, "aspire"], [/predator/i, "predator"], [/\bnitro\b/i, "nitro"], [/\bswift\b/i, "swift"],
  [/travelmate/i, "travelmate"], [/extensa/i, "extensa"],
  // MSI
  [/katana/i, "katana"], [/cyborg/i, "cyborg"], [/\bmodern\b/i, "modern"], [/prestige/i, "prestige"],
  [/stealth/i, "stealth"], [/raider/i, "raider"], [/\bsword\b/i, "sword"], [/vector/i, "vector"],
  [/\bthin\b/i, "thin"], [/\bbravo\b/i, "bravo"], [/\btitan\b/i, "titan"], [/crosshair/i, "crosshair"],
  // Microsoft
  [/surface\s*laptop/i, "surface laptop"], [/surface\s*pro/i, "surface pro"], [/surface\s*book/i, "surface book"],
];

// Series number that follows a family (e.g., IdeaPad Slim "3", Yoga Pro "7",
// Aspire Lite "15", Vivobook "16"). Captured to sharpen identity when present.
function familyWithSeries(text: string, family: string): string {
  // grab the family word plus an immediately-following small integer
  const fam = family.split(" ")[0];
  const m = text.match(new RegExp(fam + "\\s*(?:lite|slim|pro|air|book|gaming)?\\s*(\\d{1,2})\\b", "i"));
  return m ? `${family} ${m[1]}` : family;
}

function intelGen(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length >= 5) return d.slice(0, 2);           // 13620 -> 13
  if (d.length === 4) return d[0] === "1" ? d.slice(0, 2) : d[0]; // 1235->12, 8250->8
  if (d.length === 3) return d.slice(0, 2);           // ultra 155 -> 15 (rare)
  return d;
}

function extractCpu(text: string): string | null {
  const t = text.toLowerCase();
  // Apple silicon (also Arabic "معالج M5")
  const apple = t.match(/\bm([1-5])\s*(pro|max|ultra)?\b/);
  if (apple && /macbook|ماك\s*بوك|apple|ابل/.test(t)) return `m${apple[1]}${apple[2] ? apple[2] : ""}`;
  // Intel Core Ultra
  const ultra = t.match(/core\s*ultra\s*([3579])/);
  if (ultra) return `ultra${ultra[1]}`;
  // Intel Core iX (with optional model number for generation)
  const core = t.match(/\b(?:core\s*)?i([3579])[\s-]*(\d{3,5})?[a-z]{0,2}\b/);
  if (core) return core[2] ? `i${core[1]}-${intelGen(core[2])}` : `i${core[1]}`;
  // Intel Core N (2024 naming, no i): "Intel Core 7"
  const coreN = t.match(/intel\s*core\s*([3579])\b/);
  if (coreN) return `core${coreN[1]}`;
  // AMD Ryzen
  const ryzen = t.match(/ryzen\s*([3579])\s*(\d{4})?/);
  if (ryzen) return ryzen[2] ? `ryzen${ryzen[1]}-${ryzen[2][0]}` : `ryzen${ryzen[1]}`;
  return null;
}

function extractRam(text: string, payloadRam: unknown): number | null {
  const valid = (n: number) => n >= 2 && n <= 128 && [2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128].includes(n);
  const pr = Number(String(payloadRam ?? "").replace(/\D/g, ""));
  if (valid(pr)) return pr;
  const t = text.toLowerCase();
  const m = t.match(/(\d{1,3})\s*gb\s*(?:ram|memory|ddr\d?)/) ||
            t.match(/(\d{1,3})\s*جيجا\s*(?:رام|ذاكرة)/) ||
            t.match(/رام\s*(\d{1,3})/);
  if (m) { const n = Number(m[1]); if (valid(n)) return n; }
  return null;
}

function extractStorage(text: string, payloadStorage: unknown): number | null {
  const t = text.toLowerCase();
  const ps = String(payloadStorage ?? "").toLowerCase();
  const fromTb = (s: string) => { const m = s.match(/(\d(?:\.\d)?)\s*(?:tb|تيرا)/); return m ? Math.round(parseFloat(m[1]) * 1024) : null; };
  const fromGb = (s: string) => {
    const m = s.match(/(\d{3,4})\s*gb\s*(?:ssd|hdd|nvme|emmc|storage|تخزين)?/) || s.match(/(\d{3,4})\s*جيجا/);
    if (!m) return null; const n = Number(m[1]);
    return [128, 256, 320, 500, 512, 1000, 1024, 2000, 2048].includes(n) ? n : null;
  };
  return fromTb(ps) ?? fromGb(ps) ?? fromTb(t) ?? fromGb(t);
}

function extractScreen(text: string): number | null {
  const m = text.match(/\b(1[0-8](?:\.\d)?)\s*(?:inch|["”″]|بوصة|انش|إنش)/i) || text.match(/\b(1[0-8](?:\.\d)?)["”]/);
  if (m) { const n = parseFloat(m[1]); if (n >= 10 && n <= 18) return n; }
  return null;
}

// GPU is identity-relevant only when DISCRETE (gaming SKUs). Integrated GPUs
// don't distinguish a model, so they collapse to "igpu" (never over-split).
function extractGpu(text: string): { gpu: string; discrete: boolean } {
  const t = text.toLowerCase();
  const d = t.match(/\b(rtx|gtx)\s*(\d{4})\b/) || t.match(/\b(rx)\s*(\d{4})\b/);
  if (d) return { gpu: `${d[1]}${d[2]}`, discrete: true };
  return { gpu: "igpu", discrete: false };
}

function extractColor(text: string): string | null {
  const t = text.toLowerCase();
  const map: [RegExp, string][] = [
    [/space\s*gray|space\s*grey|رمادي فلكي/, "space gray"], [/\bgrey\b|\bgray\b|رمادي/, "gray"],
    [/silver|فضي/, "silver"], [/\bblack\b|أسود|اسود/, "black"], [/\bblue\b|أزرق|ازرق/, "blue"],
    [/\bwhite\b|أبيض|ابيض/, "white"], [/\bgold\b|ذهبي/, "gold"], [/midnight/, "midnight"], [/starlight/, "starlight"],
  ];
  for (const [re, v] of map) if (re.test(t)) return v;
  return null;
}

function extractOs(text: string): string | null {
  const t = text.toLowerCase();
  if (/windows\s*11\s*pro|ويندوز\s*11\s*برو/.test(t)) return "win11 pro";
  if (/windows\s*11|ويندوز\s*11/.test(t)) return "win11";
  if (/windows\s*10/.test(t)) return "win10";
  if (/free\s*dos|\bdos\b|no\s*os|بدون نظام/.test(t)) return "dos";
  if (/mac\s*os|macos/.test(t)) return "macos";
  if (/chrome\s*os/.test(t)) return "chromeos";
  return null;
}

// A true MANUFACTURER model number is corroboration-safe; a RETAILER SKU is not.
// Amazon ASINs (B0XXXXXXXX) and Jarir's pure-numeric SKUs (674123) are
// store-internal identifiers that poison the primary key — every store gets a
// unique one, so they never corroborate. Reject them: a real manufacturer model
// carries BOTH letters and digits (CD7S2EA, 83K100EPAD, MDHH4AB/A) and is never
// an ASIN. When rejected we fall through to the fallback spec identity.
function isRetailerSku(s: string): boolean {
  if (/^B0[A-Z0-9]{8}$/i.test(s)) return true;   // Amazon ASIN
  if (/^\d{5,8}$/.test(s)) return true;           // Jarir / Extra numeric SKU
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return true; // must be mixed alnum
  return false;
}
function extractModelNumber(payload: Record<string, unknown>): string | null {
  for (const c of [payload.mpn, payload.model, payload.sku]) {
    const s = typeof c === "string" ? c.trim() : "";
    if (s && /^[A-Za-z0-9][A-Za-z0-9\-\/.]{3,18}$/.test(s) && !/\s/.test(s) && !isRetailerSku(s)) {
      return s.toUpperCase();
    }
  }
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();

  // Brand: prefer explicit rawBrand, else infer from text via brand-map aliases.
  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/lenovo|لينوفو|\bhp\b|pavilion|victus|omen|dell|inspiron|\bxps\b|asus|zenbook|vivobook|acer|aspire|predator|nitro|\bmsi\b|katana|cyborg|macbook|ماك بوك|apple|ابل|huawei|هواوي|samsung|microsoft|surface|gigabyte|razer|toshiba/);
    if (guess) brand = canonicalizeBrand(guess[0]);
  }

  // Family
  let family: string | null = null;
  for (const [re, canon] of FAMILIES) { if (re.test(fullText)) { family = familyWithSeries(fullText, canon); break; } }

  const cpu = extractCpu(fullText);
  const ram = extractRam(fullText, payload.ram);
  const storage = extractStorage(fullText, payload.storage);
  const screen = extractScreen(fullText);
  const { gpu, discrete } = extractGpu(fullText);
  const model_number = extractModelNumber(payload);
  const color = extractColor(fullText);
  const os_edition = extractOs(fullText);

  const ambiguity_flags: string[] = [];
  if (!cpu) ambiguity_flags.push("cpu_missing");
  if (!ram) ambiguity_flags.push("ram_missing");
  if (!storage) ambiguity_flags.push("storage_missing");
  if (!screen) ambiguity_flags.push("screen_missing");
  if (!family) ambiguity_flags.push("family_missing");

  return {
    model_number,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      family, cpu, ram, storage, screen,
      gpu, gpu_discrete: discrete,
      // Commercial attributes — carried for display/quality, NEVER in identity.
      color, os_edition,
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
