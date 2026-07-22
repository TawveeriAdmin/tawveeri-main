// scripts/tps-plugins/refrigerator/detector.ts — precision-first.
const SIGNALS = ["ثلاجة", "refrigerator", "fridge", "بردة"];
const ACCESSORY = ["water filter", "فلتر", "ice maker part", "shelf", "رف", "cover", "غطاء", "handle", "مقبض", "mount", "حامل", "deodorizer", "معطر", "thermometer", "car fridge", "cooler box", "صندوق"];
const WRONG = ["freezer only", "chest freezer", "مجمد فقط", "wine cooler", "دولاب نبيذ"];
export function detect(nameAr: string, nameEn: string): boolean {
  const t = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY.some((s) => t.includes(s))) return false;
  if (WRONG.some((s) => t.includes(s))) return false;
  return SIGNALS.some((s) => t.includes(s));
}
