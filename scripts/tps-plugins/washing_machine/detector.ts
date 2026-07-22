// scripts/tps-plugins/washing_machine/detector.ts — precision-first.
const SIGNALS = ["غسالة", "washing machine", "washer/dryer", "washer dryer", "front load", "top load"];
const WRONG = ["car washer", "pressure washer", "high-pressure", "غسيل سيارات", "dishwasher", "غسالة صحون", "غسالة أطباق", "hand wash", "vacuum"];
const ACCESSORY = ["cover", "غطاء", "hose", "خرطوم", "filter", "فلتر", "stand", "قاعدة", "magnesium", "detergent", "منظف", "trolley"];
export function detect(nameAr: string, nameEn: string): boolean {
  const t = (nameAr + " " + nameEn).toLowerCase();
  if (WRONG.some((s) => t.includes(s))) return false;
  if (ACCESSORY.some((s) => t.includes(s))) return false;
  // "washer" alone is ambiguous (car washer handled above); require a laundry cue
  if (SIGNALS.some((s) => t.includes(s))) return true;
  return /\bwasher\b/.test(t) && /(kg|كجم|كيلو|load|حمل|laundry|غسيل)/.test(t);
}
