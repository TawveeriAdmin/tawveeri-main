// scripts/tps-plugins/laptop/detector.ts
// Laptop category detector — precision-first.
// A row is a laptop ONLY if it carries a laptop-defining signal AND is NOT an
// accessory. The laptop keyword space overlaps heavily with accessories
// ("laptop bag", "power bank for laptops", "portable monitor", "docking
// station"), so accessory signals HARD-REJECT even when a laptop keyword is
// present. Audit evidence: Extra ~34% and Amazon ~54% of laptop-keyword rows are
// accessories. Unknown beats incorrect (Constitution).

const LAPTOP_SIGNALS = [
  "لابتوب", "لاب توب", "laptop", "notebook", "نوت بوك", "نوتبوك",
  "macbook", "ماك بوك", "حاسوب محمول", "حاسب محمول", "ultrabook",
];

// Any of these → this row is an accessory / peripheral, never a laptop canonical.
const ACCESSORY_SIGNALS = [
  "cable", "كابل", "كيبل", "power bank", "بور بانك", "باور بانك",
  "charger", "شاحن", "adapter", "محول", "docking", "dock station", " dock",
  "hub", "موزع", "stand", "حامل", "cooling pad", "قاعدة تبريد", "مبرد",
  "bag", "backpack", "حقيبة", "حقيبه", "شنطة", "sleeve", "كفر", "غطاء",
  "case for", "keyboard", "لوحة مفاتيح", "كيبورد", "mouse", "ماوس", "فأرة",
  "screen protector", "واقي شاشة", "protector", "skin", "ملصق", "sticker",
  "portable monitor", "شاشة محمولة", "external monitor", "webcam", "كاميرا ويب",
  "ram module", "ذاكرة عشوائية بطاقة", "memory card", "بطاقة ذاكرة",
  "external ssd", "external hard", "قرص صلب خارجي", "فلاش",
  "usb", "type-c cable", "headset", "سماعة", "speaker", "مكبر صوت",
  // MEASURED DEFECT (2026-08-22): 8 rows in production `canonical_products` were
  // laptop accessories, not laptops — their raw titles carry NO laptop keyword
  // collision with the list above, just a plain accessory word this list never
  // covered. Evidenced, narrow phrases only (bare "cooling"/"holder"/"lock"/"table"
  // are NOT added — each collides with a genuine laptop spec phrase: "advanced
  // cooling system", "card holder" bundled feature, "Kensington lock slot", a spec
  // "table" in a listing — so the phrase must include "laptop"/"notebook" itself):
  "laptop cooling", "notebook holder", "laptop holder", "laptop lock", "laptop table",
];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  return LAPTOP_SIGNALS.some((s) => text.includes(s.toLowerCase()));
}
