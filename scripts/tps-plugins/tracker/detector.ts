// scripts/tps-plugins/tracker/detector.ts
// ─────────────────────────────────────────────────────────────────────────────
// Bluetooth item-finder detector — precision-first (ADR-351, 2026-09-13). New
// category, generic across brands (Samsung SmartTag, Apple AirTag, Tile, Aukey
// Track Mate, generic "item finder" tags) — not a Samsung-only carve-out.
// Multi-merchant evidence checked before building: Jarir, Noon and Almanea all
// carry real, priced Bluetooth-tracker SKUs, distinct from Samsung's own.
//
// Overlaps with the mobile category's accessory-reject list ("smarttag"/"airtag"
// are already excluded THERE, correctly — a tracker is never a phone) and with
// generic "smart"-prefixed wearable-sounding titles, so hard-reject anything
// that is actually a phone, watch, ring, or earbud rather than a standalone tag.
// Unknown beats incorrect.
const NAMED_LINES = [
  "smarttag", "smart tag", "سمارت تاج", "airtag", "آيتاج",
  "tile mate", "tile pro", "tile sticker", "track mate", "item finder", "bluetooth tracker",
  "item locator", "key finder", "لوكيتور", "multi-function item locator",
];
const WRONG_DEVICE = /\bwatch\b|ساعة|ساعه|smartwatch|\bring\b|خاتم|earbuds|headphone|سماعة|\bphone\b|جوال|هاتف|\btablet\b/i;
const ACCESSORY_SIGNALS = ["case for", "cover for", "strap for", "replacement band", "charging cable for"];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s))) return false;
  if (WRONG_DEVICE.test(text)) return false;
  return NAMED_LINES.some((s) => text.includes(s));
}
