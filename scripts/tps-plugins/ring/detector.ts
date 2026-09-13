// scripts/tps-plugins/ring/detector.ts
// ─────────────────────────────────────────────────────────────────────────────
// Smart-ring detector — precision-first (ADR-351, 2026-09-13). New category:
// generic across brands (Samsung Galaxy Ring, Oura, RingConn, Circular,
// Ultrahuman), not a Samsung-only carve-out. Proven multi-merchant before
// building: Galaxy Ring is listed on both samsung.com and Amazon SA.
//
// "Smart ring" text is genuinely ambiguous — a real Islamic-prayer-counter
// "Tasbih Smart Ring" and a bare "Smart Ring Fitness Tracker" with no
// established brand both matched a naive "smart ring" signal in production
// evidence but are not the health/fitness-tracking ring this category means.
// Require either a named health/fitness-ring product line, OR "smart ring"/
// "خاتم ذكي" combined with a genuine health/fitness cue and NOT a
// religious/counter cue. Unknown beats incorrect.
const NAMED_LINES = [
  "galaxy ring", "oura ring", "oura", "ringconn", "circular ring", "ultrahuman ring",
];
const GENERIC_SIGNALS = ["smart ring", "خاتم ذكي"];
const HEALTH_CUE = /health|fitness|heart rate|sleep|oximetry|activity track|معدل ضربات|نبض|صحي|لياقه|نوم/i;
const RELIGIOUS_OR_UNRELATED = /tasbih|tasbeeh|prayer|zikr|dhikr|counter|تسبيح|مسبحه|ذكر/i;
const ACCESSORY_SIGNALS = [
  "sizing kit", "size kit", "charging cable for ring", "charger for ring",
  "replacement band", "ring case", "ring dock",
];
const WRONG_DEVICE = /\bwatch\b|ساعة|ساعه|\bband\b(?!\s*ring)|smartwatch|earbuds|headphone|سماعة/i;

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s))) return false;
  if (RELIGIOUS_OR_UNRELATED.test(text)) return false;
  if (NAMED_LINES.some((s) => text.includes(s))) return true;
  if (WRONG_DEVICE.test(text)) return false;
  if (GENERIC_SIGNALS.some((s) => text.includes(s)) && HEALTH_CUE.test(text)) return true;
  return false;
}
