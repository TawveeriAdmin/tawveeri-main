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
  // ADR-350 (2026-09-13): "sound tower" — Samsung's own party-speaker product-line name
  // (samsung.com/sa_en, MX-T70/ZN and MX-ST50B/SA), which never says "speaker" or
  // "soundbar" in its title. Verified as appearing on exactly these 2 genuine speaker
  // SKUs platform-wide before adding — no false-positive risk found.
  "sound tower",
];
const ACCESSORY_SIGNALS = [
  "charger", "شاحن", "charging case for", "case for", "كفر", "cover for", "غطاء",
  "ear tips", "eartips", "tips", "cushion", "ear pads", "earpads", "pads",
  "cable", "كابل", "كيبل", "stand", "حامل", "adapter", "محول", "replacement",
  "بديل", "mount", "holder", "strap", "حزام", "sticker", "ملصق", "skin",
  "protector", "واقي", "belt clip", "clip holder", "carrying case", "hard case",
];
// A merchandising bundle (a TV + a soundbar sold as one hard-bundle SKU, e.g. Samsung's own
// "TV Hard Bundle 27 F-FA01COMBO27") is a multi-item listing, never a single speaker — same
// doctrine as vacuum (ADR-350), TV and monitor (ADR-356). Proven live (2026-09-13, Phase 1
// execution): this exact bundle's real soundbar component satisfied AUDIO_SIGNALS.
const BUNDLE_SIGNALS = ["bundle", "combo", "f-fa01combo", "حزمة", "طقم"];
// ADR-070: monitors and TVs advertise "Built-in Dual Speaker", which matched the
// bare "speaker" signal — BenQ and Asus MONITORS were being claimed as audio.
const WRONG_DEVICE = ['smartphone', 'laptop', 'لابتوب', 'tablet', 'تابلت', 'smartwatch', 'ساعة',
  'monitor', 'شاشة', 'تلفزيون', 'television', 'built-in speaker', 'built-in dual speaker',
  'مكبر صوت مدمج', 'projector', 'بروجكتر'];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (BUNDLE_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (!AUDIO_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (WRONG_DEVICE.some((s) => text.includes(s.toLowerCase()))) return false;
  return true;
}
