// scripts/tps-plugins/washing_machine/detector.ts — precision-first.
const SIGNALS = ["غسالة", "washing machine", "washer/dryer", "washer dryer", "front load", "top load", "laundry combo"];
const WRONG = ["car washer", "pressure washer", "high-pressure", "غسيل سيارات", "dishwasher", "غسالة صحون", "غسالة أطباق", "hand wash", "vacuum", "hair dryer", "مجفف شعر", "مجفف يدين", "hand dryer"];
const ACCESSORY = ["cover", "غطاء", "hose", "خرطوم", "filter", "فلتر", "stand", "قاعدة", "magnesium", "detergent", "منظف", "trolley"];
export function detect(nameAr: string, nameEn: string): boolean {
  const t = (nameAr + " " + nameEn).toLowerCase();
  if (WRONG.some((s) => t.includes(s))) return false;
  if (ACCESSORY.some((s) => t.includes(s))) return false;
  // "washer" alone is ambiguous (car washer handled above); require a laundry cue
  if (SIGNALS.some((s) => t.includes(s))) return true;
  if (/\bwasher\b/.test(t) && /(kg|كجم|كيلو|load|حمل|laundry|غسيل)/.test(t)) return true;
  // ADR-350 (2026-09-13): standalone clothes dryers (no washer at all) — e.g. Samsung's own
  // "Bespoke AI Dryer with Hybrid Heat Pump...17kg", "16kg Inverter Heatpump Dryer" — never
  // say "washer"/"غسالة" anywhere, only "dryer"/"نشاف"/"مجفف ملابس", so the washer-anchored
  // signals above can never fire. Bare "dryer" is genuinely ambiguous on its own (hair dryer,
  // hand dryer — both already hard-rejected above), so this still requires a laundry/capacity
  // cue, mirroring the existing bare-"washer" fallback exactly.
  return /\bdryer\b|نشاف|مجفف ملابس/.test(t) && /(kg|كجم|كيلو|load|حمل|laundry|غسيل)/.test(t);
}
