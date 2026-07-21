// scripts/tps-plugins/audio/parser.ts
// Deterministic audio normalization (Audio Identity Contract v1). IDENTITY:
// brand, type (earbuds/over_ear/speaker), model-line INCLUDING generation
// (AirPods Pro 2 ≠ Pro 3; JBL Flip 6 ≠ Flip 7; WH-1000XM4 ≠ XM5). COMMERCIAL
// (never in identity): colour, bundle, warranty, region. "لا نخمّن — نقرأ".
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

function extractType(text: string): string | null {
  const x = text.toLowerCase();
  if (/speaker|مكبر صوت|soundbar|partybox|boombox|flip|charge\s*\d|xtreme|clip\s*\d|\bgo\s*\d/.test(x)) return "speaker";
  if (/over-ear|over ear|headphone|سماعة رأس|airpods max|wh-?\d{4}|quietcomfort|studio/.test(x)) return "over_ear";
  if (/earbuds|earbud|in-ear|buds|airpods|ايربودز|wf-?\d{4}|freebuds/.test(x)) return "earbuds";
  if (/headset|سماعة/.test(x)) return "over_ear";
  return null;
}

// Model line + generation. Returns a normalized token or null.
function extractModel(text: string): string | null {
  const x = text.toLowerCase();
  // ── Apple ──
  if (/airpods\s*max/.test(x)) return "airpods max";
  if (/airpods\s*pro/.test(x)) { const g = x.match(/airpods\s*pro\s*(\d)/) || (/(2nd|gen\s*2|الجيل\s*الثاني)/.test(x) ? [null, "2"] as any : (/(3rd|gen\s*3|الجيل\s*الثالث)/.test(x) ? [null, "3"] as any : null)); return "airpods pro" + (g ? " " + g[1] : ""); }
  if (/airpods/.test(x)) {
    const g = x.match(/airpods\s*(\d)/) || (/(4th|gen\s*4)/.test(x) ? [null, "4"] as any : (/(3rd|gen\s*3)/.test(x) ? [null, "3"] as any : null));
    // ANC is identity-relevant for AirPods 4 (a distinct base vs ANC SKU).
    const anc = /\banc\b|active\s*noise|إلغاء\s*الضوضاء|الغاء\s*الضوضاء/.test(x) ? " anc" : "";
    return "airpods" + (g ? " " + g[1] : "") + anc;
  }
  const beats = x.match(/beats\s*(studio\s*pro|studio\s*buds\+?|studio|solo\s*\d?|fit\s*pro|flex)/); if (beats) return "beats " + beats[1].replace(/\s+/g, " ").trim();
  // ── Sony WH/WF ── (WH-1000XM5 / WF-1000XM5)
  const sony = x.match(/\b(w[hf])[-\s]?(\d{3,4})(xm\d)?\b/); if (sony) return `${sony[1]}-${sony[2]}${sony[3] ?? ""}`;
  // ── JBL portable speakers ──
  const jbl = x.match(/\b(flip|charge|clip|go|tune|boombox|xtreme|wave|live|partybox|quantum|vibe)\s*(\d{1,3})\b/); if (jbl) return `${jbl[1]} ${jbl[2]}`;
  // ── Bose ──
  if (/quietcomfort\s*ultra|qc\s*ultra/.test(x)) return "qc ultra";
  const bose = x.match(/quietcomfort\s*(\d{1,2})|qc\s*(\d{1,2})|soundlink\s*(flex|mini|revolve|max)/); if (bose) return bose[1] || bose[2] ? "qc" + (bose[1] || bose[2]) : "soundlink " + bose[3];
  // ── Samsung Galaxy Buds ──
  const gb = x.match(/galaxy\s*buds\s*(\d|fe|live|plus|pro)?\s*(pro|fe)?/); if (gb) { const parts = [gb[1], gb[2]].filter(Boolean); return "galaxy buds" + (parts.length ? " " + parts.join(" ") : ""); }
  // ── Anker Soundcore ──
  const sc = x.match(/soundcore\s*([a-z]+\s*\d{0,3}|liberty\s*\d?|space\s*\w+|motion\s*\w+)/); if (sc) return "soundcore " + sc[1].replace(/\s+/g, " ").trim();
  // ── Huawei FreeBuds ── (SE 2 ≠ SE 3 ≠ SE 4: capture the generation after SE)
  const fb = x.match(/freebuds\s*(pro\s*\d?|se\s*\d?|lipstick|\d+i?)/); if (fb) return "freebuds " + fb[1].replace(/\s+/g, " ").trim();
  // ── Jabra Elite ──
  const je = x.match(/elite\s*(\d{1,2}\s*(?:active|pro)?)/); if (je) return "elite " + je[1].replace(/\s+/g, " ").trim();
  return null;
}

function extractColor(text: string): string | null {
  const x = text.toLowerCase();
  const map: [RegExp, string][] = [[/black|أسود|اسود/, "black"], [/white|أبيض|ابيض/, "white"], [/blue|أزرق|ازرق/, "blue"], [/red|أحمر|احمر/, "red"], [/gr[ae]y|رمادي/, "gray"], [/silver|فضي/, "silver"], [/green|أخضر|اخضر/, "green"], [/pink|وردي/, "pink"], [/purple|بنفسج/, "purple"], [/beige|بيج/, "beige"]];
  for (const [re, v] of map) if (re.test(x)) return v;
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  const payload = rawPayload ?? {};
  const fullText = `${nameAr} ${nameEn}`;
  const combined = fullText.toLowerCase();

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = combined.match(/apple|ابل|airpods|beats|sony|سوني|bose|بوز|\bjbl\b|جي بي|samsung|سامسون|galaxy buds|anker|soundcore|انكر|huawei|هواوي|freebuds|sennheiser|marshall|jabra/);
    if (guess) brand = canonicalizeBrand(guess[0]);
  }
  if (!["apple", "sony", "bose", "jbl", "samsung", "anker", "huawei", "sennheiser", "marshall", "jabra", "beats"].includes(brand)) {
    if (/airpods|beats/.test(combined)) brand = "apple";
  }

  const type = extractType(fullText);
  const model = extractModel(fullText);
  const color = extractColor(fullText);

  const ambiguity_flags: string[] = [];
  if (!model) ambiguity_flags.push("model_missing");
  if (!type) ambiguity_flags.push("type_missing");

  return {
    model_number: model,
    color,
    payload: {
      brand: brand === "unknown" ? null : brand,
      type, model,
      color, // commercial, never in identity
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
