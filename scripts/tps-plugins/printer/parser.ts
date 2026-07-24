// scripts/tps-plugins/printer/parser.ts
// Deterministic printer normalization (Printer Identity Contract v1). A printer
// is identified by its brand + product line + model number (HP LaserJet 1602w,
// Canon PIXMA G3410). The model number is store-stable, so it corroborates well.
// Function (single vs multifunction) and connectivity are NON-identity — the
// model number already implies them. Bilingual: Almanea writes the line in Arabic
// (ليزرجت, بيكسما) while the model number stays Latin (M141W, G3410).
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
import { normalizeArabic } from "../../tps-core/text";

// Product line → [bilingual detector, canonical line token]. Order: specific first.
const LINES: [RegExp, string][] = [
  [/laserjet|ليزر\s*جيت|ليزرجت/, "laserjet"],
  [/officejet|اوفيس\s*جيت/, "officejet"],
  [/deskjet|ديسك\s*جيت|ديسكجت/, "deskjet"],
  // HP "Ink Advantage" is a DeskJet sub-line; map it to deskjet so a store that
  // drops "DeskJet" ("HP Ink Advantage 2978") still corroborates with one that keeps it.
  [/ink\s*advantage|انك\s*ادفانتج|حبر\s*ادفانتج/, "deskjet"],
  [/smart\s*tank|سمارت\s*تانك/, "smart tank"],
  [/neverstop|نيفر\s*ستوب/, "neverstop"],
  [/\benvy\b|انفي/, "envy"],
  [/pixma|بيكسما|بيكسيما/, "pixma"],
  [/imageclass|اماج\s*كلاس/, "imageclass"],
  [/maxify/, "maxify"],
  [/selphy|سيلفي/, "selphy"],
  [/ecotank|ايكو\s*تانك|ايكوتانك/, "ecotank"],
  [/workforce/, "workforce"],
  [/expression/, "expression"],
  // Brother/Pantum series prefixes ARE the line (DCP-T420W, MFC-L2710, HL-L2375).
  [/\b(dcp|mfc|hl)\b/, "brother-series"],
];

// A printer model number: an optional 1-3 letter prefix, 3-4 digits, optional
// 1-3 letter suffix — M141W, 1602w, 2320, G3410, TS3640, L3250, CP1500, T420W.
const MODEL = "([a-z]{0,3}\\d{3,4}[a-z]{0,3})";
const FILLER = "(?:\\s+(?:tank|mfp|pro|plus|ultra|wireless|ink\\s*advantage|advantage|واي\\s*فاي|اللاسلكيه|the|series|a))*";

function extractModel(x: string): string | null {
  for (const [re, line] of LINES) {
    const m = re.exec(x);
    if (!m) continue;
    // Brother-style: the prefix + number is the whole model (dcp-t420w → "dcp t420w").
    if (line === "brother-series") {
      const b = new RegExp(`\\b(dcp|mfc|hl)[-\\s]?${MODEL}`, "i").exec(x);
      if (b) return `${b[1].toLowerCase()} ${b[2].toLowerCase()}`;
      continue;
    }
    // Model number searched AFTER the line word, tolerating filler (tank, mfp, …).
    // re.source is wrapped so its `|` alternation binds the whole line, not the tail.
    const after = new RegExp("(?:" + re.source + ")" + FILLER + "\\s*" + MODEL, "i").exec(x);
    if (after && after[1]) return `${line} ${after[1].toLowerCase()}`;
  }
  return null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null, rawPayload?: Record<string, unknown>): NormalizeResult {
  void rawPayload;
  const x = normalizeArabic(`${nameAr} ${nameEn}`);

  let brand = canonicalizeBrand(rawBrand);
  if (brand === "unknown" || brand === "other") {
    const guess = x.match(/\bhp\b|اتش\s*بي|hewlett|canon|كانون|epson|ابسون|إبسون|ايبسون|brother|براذر|pantum|بانتوم|xerox|زيروكس|ricoh|ريكو|lexmark|لكسمارك|samsung|سامسونج/);
    if (guess) brand = canonicalizeBrand(guess[0].trim());
  }
  // The line words themselves imply the brand when the store published none.
  if (brand === "unknown" || brand === "other") {
    if (/laserjet|deskjet|officejet|smart\s*tank|neverstop|ليزرجت|ديسك\s*جيت/.test(x)) brand = "hp";
    else if (/pixma|بيكسما|maxify|selphy|imageclass/.test(x)) brand = "canon";
    else if (/ecotank|workforce|ايكوتانك/.test(x)) brand = "epson";
  }

  const model = extractModel(x);
  const multifunction = /multi.?function|all.?in.?one|\bmfp\b|طباعه\s*نسخ|نسخ\s*مسح|متعدده?\s*الوظائف/.test(x);
  const tech = /\blaser\b|ليزر/.test(x) ? "laser" : /ink\s*tank|tank|تانك/.test(x) ? "tank" : /inkjet|نافثه?\s*للحبر/.test(x) ? "inkjet" : null;

  const ambiguity_flags: string[] = [];
  if (!model) ambiguity_flags.push("model_missing");

  return {
    model_number: null, // line token lives in the identity key; keeps model_number out of the unique index
    color: null,
    payload: {
      brand: brand === "unknown" ? null : brand,
      model,
      // NON-identity (display/quality only):
      multifunction, tech,
    },
    ignored_terms: [],
    ambiguity_flags,
  };
}
