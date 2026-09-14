// scripts/tps-plugins/stylus/detector.ts
// Standalone stylus detector — precision-first (2026-09-14, Samsung KSA official-gateway
// high-value-accessory closure). Generic across brands (Samsung S Pen, any other brand's
// standalone stylus), not a Samsung-only carve-out — mirrors the ring/tracker precedent
// (ADR-351): a real, priced, independently-purchasable product line, not a completeness
// exercise for one merchant.
//
// IDENTITY SAFETY (the exact requirement this category exists to satisfy): mobile's own
// detector already rejects "S Pen" titles with no storage-tier hint (`S_PEN_MENTION &&
// !HAS_STORAGE_TIER_HINT`) so a stylus is never claimed as the phone it is compatible
// with. This detector accepts EXACTLY that same partition — the accessory a phone/tablet
// plugin already correctly refuses — never a phone/tablet's own listing (which states a
// storage tier and is claimed by mobile/tablet first in the registry sweep).
const STYLUS_SIGNAL = /\bs\s?pen\b|\bstylus\b|قلم\s*S|قلم\s*ذكي/i;
const HAS_STORAGE_TIER_HINT = /\b(?:16|32|64|128|256|512|1024|2048)\s?(?:gb|جيجا|تيرا|tb)\b/i;
// Section 2's explicit scope line: high-value standalone units only, never the long tail
// of low-value parts/consumables sold alongside a real stylus.
const LOW_VALUE_PART_SIGNALS = [
  "tip", "nib", "refill", "replacement tip", "tips pack", "nibs pack",
  "case for s pen", "s pen case", "holder", "pouch", "cover for s pen",
];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = `${nameAr} ${nameEn}`.toLowerCase();
  if (LOW_VALUE_PART_SIGNALS.some((s) => text.includes(s))) return false;
  if (!STYLUS_SIGNAL.test(text)) return false;
  if (HAS_STORAGE_TIER_HINT.test(text)) return false; // a real phone/tablet SKU that merely mentions a bundled S Pen
  return true;
}
