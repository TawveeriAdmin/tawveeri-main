// scripts/tps-plugins/laptop/parser.ts
// Deterministic laptop normalization (Laptop Identity Contract v1).
// Extracts IDENTITY attributes (family, cpu, ram, storage, screen, gpu, model)
// and keeps COMMERCIAL attributes (color, os_edition) strictly separate — never
// in the identity key. "لا نخمّن — نقرأ": every attribute is read from the text,
// never inferred. Ambiguity is flagged, not resolved by guessing.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { extractManufacturerModel, extractManufacturerModelFromName } from "../../../src/lib/identity/store-identifiers";
import { normalizeArabic } from "../../tps-core/text";

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
  [/alienware/i, "alienware"], [/precision/i, "precision"],
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
  // Last-resort: a bare "G15/G16/G17" is Dell's gaming line ONLY when no branded
  // line matched above. Kept last so an Asus ROG Strix G16 / other brand's "G16"
  // is not mislabelled "dell g-series" (ADR-072 exposed this via new Arabic IDs).
  [/\bg1[567]\b/i, "dell g-series"],
];

// Series number that follows a family (e.g., IdeaPad Slim "3", Yoga Pro "7",
// Vivobook "16"). Captured to sharpen identity when present.
//
// ADR-058 key-stability rule: a number that merely restates the SCREEN SIZE is
// not a series and must never enter the family token. Measured defect — Jarir
// "Acer Aspire Lite 15 Laptop, 15.6\"" yielded family `aspire 15` while Extra's
// "Acer aspire lite laptop with 15.6\" fhd" yielded `aspire`, so the same
// product could never match. Screen sizes are dropped unless the text states a
// DIFFERENT screen size, which proves the digit is a real series number.
const SCREEN_LIKE = new Set([11, 12, 13, 14, 15, 16, 17]);
function familyWithSeries(text: string, family: string): string {
  const fam = family.split(" ")[0];
  const m = text.match(new RegExp(fam + "\\s*(?:lite|slim|pro|air|book|gaming)?\\s*(\\d{1,2})\\b", "i"));
  if (!m) return family;
  const n = Number(m[1]);
  if (SCREEN_LIKE.has(n)) {
    // Accept only if the stated screen size clearly differs from this digit.
    const screen = text.match(/(\d{2}(?:\.\d)?)\s*(?:"|inch|بوصة)/i);
    const stated = screen ? Math.floor(Number(screen[1])) : null;
    if (stated === null || stated === n) return family;
  }
  return `${family} ${m[1]}`;
}

function intelGen(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length >= 5) return d.slice(0, 2);           // 13620 -> 13
  if (d.length === 4) return d[0] === "1" ? d.slice(0, 2) : d[0]; // 1235->12, 8250->8
  if (d.length === 3) return d.slice(0, 2);           // ultra 155 -> 15 (rare)
  return d;
}

// Qualcomm Snapdragon ARM laptop chips (Surface, ASUS Vivobook/ProArt/Zenbook, HP
// OmniBook, Lenovo, ...). P4 (2026-08-21): entirely unrecognized before this — every
// Snapdragon-CPU laptop failed the spec triple and fell through to the model-number
// name-rescue, which is how bad slash-spec strings got minted as `MODEL:` identities
// in the first place. Order matters: the X2 tiers are checked before the bare "X" so
// "Snapdragon X2 Elite" is never collapsed into generic "X" — they are different real
// chips and must stay distinct identities.
function extractSnapdragonCpu(t: string): string | null {
  if (!/snapdragon/.test(t)) return null;
  if (/snapdragon\s*x\s*2\s*elite/.test(t)) return "sdx2elite";
  if (/snapdragon\s*x\s*2\s*plus/.test(t)) return "sdx2plus";
  if (/snapdragon\s*x\s*elite/.test(t)) return "sdxelite";
  if (/snapdragon\s*x\s*plus/.test(t)) return "sdxplus";
  if (/snapdragon\s*8cx/.test(t)) return "sd8cx";
  const m = t.match(/snapdragon\s*m\s*(10|12)\b/);
  if (m) return `sdm${m[1]}`;
  // Bare "Snapdragon X" and the older SKU-suffixed form ("X1 26 100" / "X1-26-100")
  // name the SAME base tier across different retailers — collapsing them is correct,
  // not a loss of precision.
  if (/snapdragon\s*x\b/.test(t) || /snapdragon\s*x1\b/.test(t)) return "sdx";
  return null;
}

function extractCpu(text: string): string | null {
  const t = text.toLowerCase();
  // Apple silicon (also Arabic "معالج M5")
  const apple = t.match(/\bm([1-5])\s*(pro|max|ultra)?\b/);
  if (apple && /macbook|ماك\s*بوك|apple|ابل/.test(t)) return `m${apple[1]}${apple[2] ? apple[2] : ""}`;
  const snapdragon = extractSnapdragonCpu(t);
  if (snapdragon) return snapdragon;
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

// P4 (2026-08-21): 192GB is a real, if rare, workstation-class laptop RAM configuration
// (measured: Acer Helios 18AI, 4x48GB) — was outside both the tier whitelist and the
// <=128 range cap, so a stated, unit-correct "192GB RAM" was silently discarded.
function extractRam(text: string, payloadRam: unknown): number | null {
  const valid = (n: number) => n >= 2 && n <= 192 && [2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192].includes(n);
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
  // P4 (2026-08-21): a decimal point is sometimes scraped as a plain space
  // ("15.6\"" -> "15 6 inch"), silently losing the screen size. Checked BEFORE the
  // plain-integer form so "15 6 inch" is read as 15.6, not a bare "15" (which would
  // also be wrong — 15 alone is not the stated size).
  const spaced = text.match(/\b(1[0-8])\s(\d)\s*(?:inch|["”″]|بوصة|انش|إنش)/i);
  if (spaced) { const n = parseFloat(`${spaced[1]}.${spaced[2]}`); if (n >= 10 && n <= 18) return n; }
  // P4: a hyphen instead of a space before the unit word ("15.6-Inch", "16-Inch") —
  // measured across several stores' titles. `[\s-]*` also covers the plain-space form.
  const m = text.match(/\b(1[0-8](?:\.\d)?)[\s-]*(?:inch|["”″]|بوصة|انش|إنش)/i) || text.match(/\b(1[0-8](?:\.\d)?)["”]/);
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

// ── Bilingual FILL extractors (ADR-072) ──────────────────────────────────────
// The v1 extractors above are Latin-only and adjacency-strict, so Arabic
// listings and the 2024 "Core 7/5/3" naming silently produced null cpu/ram/
// storage — the three identity-critical fields. A null in any of them makes the
// identity INVALID (see identity.ts), so these functions run ONLY as a fallback
// for a field the v1 pass left null. They can therefore never change the key of
// an already-identified laptop (its trio was non-null): strictly additive, zero
// churn. All operate on `normalizeArabic`-folded text so one pattern matches
// every spelling and Arabic-Indic digits (٥١٢) are read.
const RAM_TIERS_LAPTOP = new Set([2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192]);
const STORAGE_TIERS_LAPTOP = [128, 256, 320, 500, 512, 1000, 1024, 2000, 2048];

function enhCpu(nt: string): string | null {
  if (/macbook|ماك بوك|apple|ابل/.test(nt)) {
    // Apple silicon: Latin "m5" or Arabic "ام 5" ("شيب ام 2 -8 كور").
    const m = nt.match(/(?:^|[^a-z])(?:m|ام)\s*([1-5])\s*(pro|max|ultra|برو|ماكس)?/);
    if (m) { const s = m[2] ? (/برو/.test(m[2]) ? "pro" : /ماكس/.test(m[2]) ? "max" : m[2]) : ""; return `m${m[1]}${s}`; }
    // Apple A-series (A18 Pro) — the 2026 MacBook Neo carries an A-series chip.
    const a = nt.match(/\ba(1[0-9]|[2-9])\s*(pro|max)?/);
    if (a) return `a${a[1]}${a[2] ? a[2] : ""}`;
  }
  // Intel Core Ultra (Latin/Arabic): "core ultra 7", "كور الترا 9".
  const ultra = nt.match(/(?:core|كور)\s*(?:ultra|الترا)\s*([3579])/);
  if (ultra) return `ultra${ultra[1]}`;
  // Intel Core iX — MUST be anchored to a core/intel word so "wifi 5" can never
  // read as "i5". Handles Arabic "كور اي 7-1355u" and Latin "core i5-13420h".
  const core = nt.match(/(?:core|كور|intel|انتل)\s+(?:i|اي)\s*([3579])[\s-]*(\d{3,5})?[a-z]{0,2}(?![0-9])/);
  if (core) return core[2] ? `i${core[1]}-${intelGen(core[2])}` : `i${core[1]}`;
  // Intel Core N (2024 Series-1, no "i"): "core 7-150u", "كور 7", "core 5 120u".
  const coreN = nt.match(/(?:core|كور)\s*([3579])(?![a-z0-9])/);
  if (coreN) return `core${coreN[1]}`;
  // AMD Ryzen (Latin/Arabic), tolerant of an "AI" tier word.
  const ryzen = nt.match(/(?:ryzen|رايزن)\s*(?:ai\s*)?([3579])\s*(\d{4})?/);
  if (ryzen) return ryzen[2] ? `ryzen${ryzen[1]}-${ryzen[2][0]}` : `ryzen${ryzen[1]}`;
  return null;
}

// RAM figure adjacent (within two filler tokens) to a RAM keyword, in either
// word order. Every candidate is tier-validated, so a storage figure caught by a
// loose pattern is discarded rather than mistaken for RAM.
const RAM_PATTERNS = [
  /(\d{1,3})\s*(?:gb|جيجا\S*)(?:\s+\S+){0,2}?\s*(?:ram|memory|ddr|lpddr|رام)/g,
  /(?:الرامات|رام|ram|memory|ذاكره وصول عشوايي)(?:\s+\S+){0,2}?\s*(\d{1,3})\s*(?:gb|جيجا)/g,
  // P4 (2026-08-21): the RAM figure with NO unit, stated before a DDR-generation
  // token — "8 ddr4 ram" (= 8GB DDR4 RAM). Checked before the loose digit+ram
  // pattern below so the DDR generation digit is never mistaken for the RAM figure.
  /(\d{1,3})\s*(?:ddr\d|lpddr\d)\s*ram\b/g,
  // A number directly followed by "ram" with no unit at all. Excludes a number
  // immediately preceded by "ddr"/"lpddr" (a generation digit, e.g. the "4" in
  // "ddr4 ram") — measured live: this pattern read `ddr4 ram` as RAM=4 while the
  // listing's real, stated RAM figure (8) sat one token earlier and unmatched.
  /(?<!ddr)(?<!lpddr)(\d{1,3})\s*ram(?![a-z])/g,
];
function enhRam(nt: string): number | null {
  for (const re of RAM_PATTERNS) for (const m of nt.matchAll(re)) { const n = Number(m[1]); if (RAM_TIERS_LAPTOP.has(n)) return n; }
  return null;
}

function enhStorage(nt: string): number | null {
  const tb = nt.match(/(\d(?:\.\d)?)\s*(?:tb|تيرا\S*)/);
  if (tb) { const gb = Math.round(parseFloat(tb[1]) * 1024); if (gb >= 128) return gb; }
  let best: number | null = null;
  const consider = (raw: string) => { const n = Number(raw); if (STORAGE_TIERS_LAPTOP.includes(n) && (best === null || n > best)) best = n; };
  for (const m of nt.matchAll(/(\d{3,4})\s*(?:gb|جيجا\S*)/g)) consider(m[1]);
  for (const m of nt.matchAll(/(?:جيجا\S*|gb)\s*(\d{3,4})/g)) consider(m[1]);
  for (const m of nt.matchAll(/(?:تخزين|سعه|ssd|hdd|nvme|emmc|storage)\s*(\d{3,4})/g)) consider(m[1]);
  // P4 (2026-08-21): the storage figure with NO unit at all — "512 ssd" (Extra's
  // scraped format drops "GB" outright). Tier-validated like every other candidate
  // here, so a stray 3-4 digit number can't be mistaken for a capacity.
  for (const m of nt.matchAll(/(\d{3,4})\s*(?:ssd|hdd|nvme|emmc)\b/g)) consider(m[1]);
  return best;
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

// Model-number extraction is delegated to the single key-integrity authority
// (ADR-058). It previously lived here as a local `isRetailerSku` copy that did
// not know Noon's `N70382194V` format and fell back to the `sku` field, which
// made every Noon laptop a store-unique identity that could never corroborate.

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

  // v1 pass (unchanged) decides identity for everything it already handled.
  let cpu = extractCpu(fullText);
  let ram = extractRam(fullText, payload.ram);
  let storage = extractStorage(fullText, payload.storage);
  // Fill-only bilingual fallback (ADR-072): runs solely for a null identity-
  // critical field, so it can only rescue a listing v1 left unidentified — the
  // key of an already-identified laptop is never touched.
  if (cpu === null || ram === null || storage === null) {
    const nt = normalizeArabic(fullText);
    if (cpu === null) cpu = enhCpu(nt);
    if (ram === null) ram = enhRam(nt);
    if (storage === null) storage = enhStorage(nt);
  }
  const screen = extractScreen(fullText);
  const { gpu, discrete } = extractGpu(fullText);
  // RESCUE-ONLY name-derived model (ADR-175). Payload keeps absolute precedence.
  //
  // The title is read ONLY when the payload has no model AND the spec triple is
  // incomplete — i.e. only for a listing that would otherwise get NO identity at all.
  //
  // WHY IT IS GATED THIS WAY, measured not assumed. Wiring the name fallback in
  // unconditionally raised valid identities on a fixed window (88 -> 96) while DROPPING
  // corroborated canonicals (23 -> 18). A `MODEL:` key outranks the spec key, so two
  // listings that used to merge across stores on brand|cpu|ram|storage split apart the
  // moment one merchant writes `X1504VA` and another writes `X1504VA-BQ575W`. Precision
  // rose and comparison coverage fell — and comparison is the product.
  //
  // Gated on an incomplete spec triple, the rescue is zero-churn by construction: an
  // already-identifiable laptop keeps the exact key it had, so no existing comparison
  // can break. Same discipline as the ADR-072 fill-only extractors above.
  const specTripleComplete = cpu !== null && ram !== null && storage !== null;
  const model_number =
    extractManufacturerModel(payload) ??
    (specTripleComplete ? null : extractManufacturerModelFromName(fullText));
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
