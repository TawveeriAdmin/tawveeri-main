// scripts/tps-plugins/tv/detector.ts
// TV category detector — precision-first. A row is a TV only if it carries a TV
// signal AND is not a TV accessory (mount, stand, remote, receiver, soundbar,
// antenna, cable). "شاشة" (screen) is a TV signal but also matches monitors, so
// monitor signals reject. Unknown beats incorrect.
//
// MEASURED DEFECT (2026-08-20, Waffar TV P0): bare "tv" was an UNCONDITIONAL signal,
// matched by naive substring — it is not a false substring collision (word-boundary
// matching does not fix this), it is a genuinely ambiguous WHOLE WORD: Funko's own
// "Pop! TV" product-line branding ("this figure is themed from a TV show") contains
// the standalone word "TV" with a different meaning than "this is a television".
// Reproduced in production: 8 Funko Pop figures and 3 Oraimo smartwatches were
// written to canonical_products as category='tv'. Moved "tv" out of the unconditional
// TV_SIGNALS list into WEAK_TV_SIGNALS below, alongside "شاشة" — both require a real
// size + panel/tech cue before counting, exactly like the existing "شاشة" rule already
// did for monitors. A second, independent bug compounded the Oraimo case: the size
// regex read the "93" in "1.93 بوصة" (a 1.93-inch watch screen) as a 93-inch TV size —
// fixed below by rejecting a digit pair immediately preceded by a decimal point.
const TV_SIGNALS = ["تلفزيون", "television", "smart tv", "led tv", "قوقل تي في", "google tv", "شاشة تلفزيون", "تليفزيون"];
const WEAK_TV_SIGNALS = ["tv", "شاشة", "شاشه"]; // ambiguous alone — require a size + a TV/panel cue too
const ACCESSORY_SIGNALS = [
  "mount", "حامل", "bracket", "قاعدة", "stand for", "wall mount", "تثبيت",
  "remote", "ريموت", "ريموات", "cable", "كابل", "كيبل", "protector", "واقي",
  "receiver", "رسيفر", "ريسيفر", "antenna", "هوائي", "soundbar", "مكبر",
  "سماعة", "box tv", "tv box", "media player", "chromecast", "شاحن", "adapter",
];
// ADR-074: also the Arabic computer-screen phrases, so a monitor written only in
// Arabic (e.g. "شاشة كمبيوتر ... 4K") is claimed by the monitor plugin alone and
// never double-detected as a TV. No real television carries these phrases.
const MONITOR_SIGNALS = ["monitor", "مونيتور", "gaming monitor", "curved monitor", "portable monitor",
  "شاشة كمبيوتر", "شاشة حاسوب", "شاشة قيمنج", "شاشة العاب", "شاشة ألعاب", "شاشة الألعاب", "شاشة مكتب"];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (MONITOR_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (TV_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return true;
  // Weak/ambiguous signals only count as a TV when a size + a TV/panel cue is present
  // too. The size digits must not be preceded by a decimal point or another digit —
  // otherwise "1.93 بوصة" (a watch's 1.93-inch screen) reads its "93" as a 93-inch TV.
  if (WEAK_TV_SIGNALS.some((s) => text.includes(s))) {
    const hasSize = /(?<![.\d])(3[2-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|”|بوصة|انش|إنش)/.test(text);
    const hasTvCue = /(4k|uhd|8k|qled|oled|nanocell|qned|neo qled|smart|led)/.test(text);
    return hasSize && hasTvCue;
  }
  return false;
}
