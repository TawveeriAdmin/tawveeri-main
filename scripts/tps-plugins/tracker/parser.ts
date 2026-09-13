// scripts/tps-plugins/tracker/parser.ts
// Bluetooth tracker identity contract (ADR-351): brand | family | variant.
// Colour IS kept as part of identity here (unlike ring's material staying purely
// commercial-neutral by convention) because trackers observed in production carry
// GENUINELY DIFFERENT official model codes per colour (Samsung's own
// EI-T5600BBEGWW/black vs EI-T5600KWEGWW/white) and a measured, real price
// difference between them — collapsing them would risk merging two SKUs that may
// legitimately be priced differently, exactly the "UNKNOWN > WRONG" case the
// founder's mandate warns about. Pack count (Aukey's "(1 PC)") is folded into the
// same variant slot since it is the analogous real-price-affecting axis for that line.
import type { NormalizeResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

const BRAND_FROM_TITLE: [RegExp, string][] = [
  [/smarttag|smart tag|سمارت تاج|samsung|سامسونج/i, "samsung"],
  [/airtag|آيتاج|\bapple\b/i, "apple"],
  [/\btile\b/i, "tile"],
  [/aukey|اوكي|أوكي/i, "aukey"],
];

const FAMILY_FROM_TITLE: [RegExp, string][] = [
  [/smarttag\s*2|smart tag\s*2/i, "SmartTag2"],
  [/smarttag|smart tag|سمارت تاج/i, "SmartTag"],
  [/airtag|آيتاج/i, "AirTag"],
  [/tile\s*mate/i, "Tile Mate"],
  [/tile\s*pro/i, "Tile Pro"],
  [/tile\s*sticker/i, "Tile Sticker"],
  [/track\s*mate\s*(\d)?/i, "Track Mate"],
];

function readVariant(text: string): string | null {
  const colorMatch = text.match(/\b(black|white|gray|grey|silver|gold|blue|pink)\b/i);
  const packMatch = text.match(/\((\d+)\s*pc[s]?\)|(\d+)\s*-?\s*pack/i);
  const parts: string[] = [];
  if (colorMatch) parts.push(colorMatch[1][0].toUpperCase() + colorMatch[1].slice(1).toLowerCase());
  if (packMatch) parts.push(`${packMatch[1] || packMatch[2]}pc`);
  return parts.length ? parts.join(" ") : null;
}

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const text = `${nameAr} ${nameEn}`;
  let brand = canonicalizeBrand(rawBrand);
  if (!brand || brand === "unknown" || brand === "other") {
    for (const [re, b] of BRAND_FROM_TITLE) if (re.test(text)) { brand = b; break; }
  }

  let family: string | null = null;
  for (const [re, f] of FAMILY_FROM_TITLE) if (re.test(text)) { family = f; break; }

  const variant = readVariant(text);

  const ambiguity_flags: string[] = [];
  if (!family) ambiguity_flags.push("family_missing");

  return {
    model_number: null,
    color: null,
    payload: { brand, family, variant: variant ?? "Standard" },
    ignored_terms: [],
    ambiguity_flags,
  };
}
