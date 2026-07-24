// scripts/tps-plugins/tv/detector.ts
// TV category detector — precision-first. A row is a TV only if it carries a TV
// signal AND is not a TV accessory (mount, stand, remote, receiver, soundbar,
// antenna, cable). "شاشة" (screen) is a TV signal but also matches monitors, so
// monitor signals reject. Unknown beats incorrect.
const TV_SIGNALS = ["tv", "تلفزيون", "television", "smart tv", "led tv", "قوقل تي في", "google tv", "شاشة تلفزيون", "تليفزيون"];
const SCREEN_WORDS = ["شاشة", "شاشه"]; // TV only if paired with a size + a TV/panel cue, not a monitor
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
  // "شاشة" only counts as a TV when a size + a TV/panel cue is present.
  if (SCREEN_WORDS.some((s) => text.includes(s))) {
    const hasSize = /\b(3[2-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|”|بوصة|انش|إنش)/.test(text);
    const hasTvCue = /(4k|uhd|8k|qled|oled|nanocell|qned|neo qled|smart|led)/.test(text);
    return hasSize && hasTvCue;
  }
  return false;
}
