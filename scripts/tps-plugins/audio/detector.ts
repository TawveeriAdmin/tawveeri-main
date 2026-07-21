// scripts/tps-plugins/audio/detector.ts
// Audio category detector — precision-first (headphones / earbuds / portable
// speakers). Audio keywords are heavily contaminated by accessories: chargers
// (a Promate MagSafe charger matched "AirPods Pro" in the audit), ear tips,
// cushions, cases, cables, stands. Accessory + wrong-device signals HARD-REJECT.
// Note: bare "clip" is NOT an accessory word here — "JBL Clip 5" is a speaker;
// only accessory phrases (belt clip, clip holder) reject. Unknown beats incorrect.
const AUDIO_SIGNALS = [
  "headphone", "headphones", "سماعة", "سماعات", "earbuds", "earbud", "earphone",
  "airpods", "ايربودز", "ايربود", "speaker", "مكبر صوت", "buds", "soundbar",
  "ساوند بار", "headset", "in-ear", "over-ear", "on-ear", "freebuds",
];
const ACCESSORY_SIGNALS = [
  "charger", "شاحن", "charging case for", "case for", "كفر", "cover for", "غطاء",
  "ear tips", "eartips", "tips", "cushion", "ear pads", "earpads", "pads",
  "cable", "كابل", "كيبل", "stand", "حامل", "adapter", "محول", "replacement",
  "بديل", "mount", "holder", "strap", "حزام", "sticker", "ملصق", "skin",
  "protector", "واقي", "belt clip", "clip holder", "carrying case", "hard case",
];
const WRONG_DEVICE = ["smartphone", "laptop", "لابتوب", "tablet", "تابلت", "smartwatch", "ساعة"];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (!AUDIO_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (WRONG_DEVICE.some((s) => text.includes(s.toLowerCase()))) return false;
  return true;
}
