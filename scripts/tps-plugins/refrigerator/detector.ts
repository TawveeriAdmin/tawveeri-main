// scripts/tps-plugins/refrigerator/detector.ts — precision-first.
const SIGNALS = ["ثلاجة", "refrigerator", "fridge", "بردة"];
// PROVEN LIVE (2026-09-13, Official Gateway Closure mission): bare "mount" wrongly rejected
// "Top Mount Freezer Refrigerator 583L..." (RT58K7110BS/ZA) — "Top Mount"/"Bottom Mount" are
// standard refrigerator door-configuration terms (freezer-on-top vs. freezer-on-bottom
// layout), not a mounting-bracket accessory. Narrowed to "wall mount" (matching the same
// phrase TV/monitor's own accessory exclusion already uses) so a genuine wall-bracket
// accessory is still excluded without rejecting a real refrigerator's own layout name.
const ACCESSORY = ["water filter", "فلتر", "ice maker part", "shelf", "رف", "cover", "غطاء", "handle", "مقبض", "wall mount", "حامل", "deodorizer", "معطر", "thermometer", "car fridge", "cooler box", "صندوق"];
const WRONG = ["freezer only", "chest freezer", "مجمد فقط", "wine cooler", "دولاب نبيذ"];
export function detect(nameAr: string, nameEn: string): boolean {
  const t = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY.some((s) => t.includes(s))) return false;
  if (WRONG.some((s) => t.includes(s))) return false;
  return SIGNALS.some((s) => t.includes(s));
}
