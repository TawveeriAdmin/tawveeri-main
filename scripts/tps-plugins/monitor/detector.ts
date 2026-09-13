// scripts/tps-plugins/monitor/detector.ts
// Computer-monitor detector — precision-first. Monitors overlap heavily with TVs
// (both are "شاشة"), so a row is a monitor only if it carries a monitor cue AND
// is NOT a TV / laptop / tablet / phone / projector, and is not an accessory
// (arm, mount, screen protector). The TV detector already rejects monitor
// signals, so the two categories partition cleanly. Unknown beats incorrect.
const MONITOR_SIGNALS = [
  "monitor", "مونيتور", "شاشة كمبيوتر", "شاشة حاسوب", "شاشة مكتب",
  "شاشة قيمنج", "شاشة العاب", "شاشة ألعاب", "شاشة الألعاب",
  "gaming monitor", "curved monitor", "ultrawide monitor", "portable monitor",
  // ADR-350 (2026-09-13): "monintor" — a confirmed Samsung KSA source-side title typo
  // (samsung.com/sa_en, model LS22A336NHMXUE: "22\" FHD Flat Monintor..."), verified as the
  // ONLY occurrence of this spelling platform-wide before adding — not a guessed pattern.
  "monintor",
];
const ACCESSORY_SIGNALS = [
  "monitor arm", "monitor stand", "حامل شاشة", "ذراع شاشة", "desk mount",
  "wall mount", "screen protector", "واقي شاشة", "dust cover", "غطاء شاشة",
  "privacy filter", "cleaning", "منظف",
];
// A monitor is never any of these. `شاشة تلفزيون`/`smart tv` are TVs; a laptop or
// tablet has a built-in screen but is its own category.
const WRONG_DEVICE =
  /\btv\b|television|تلفزيون|تلفاز|تليفزيون|smart\s*tv|شاشة تلفزيون|\blaptop\b|لابتوب|لاب توب|notebook|نوت ?بوك|\btablet\b|تابلت|ايباد|\bipad\b|smartphone|\bجوال\b|هاتف|\bprojector\b|بروجكتر|بروجيكتر/;
// "monitor" also names wearables/health devices (blood-pressure monitor, fitness
// tracker) — never a computer screen. Reject them so they never enter the pool.
const WEARABLE_HEALTH =
  /\bwatch\b|ساعة|ساعه|smart\s*watch|smartwatch|\bband\b|fitness|tracker|سوار|blood\s*pressure|ضغط الدم|heart\s*rate|معدل ضربات|نبض|baby\s*monitor|مراقبة الطفل/;

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s))) return false;
  if (WRONG_DEVICE.test(text)) return false;
  if (WEARABLE_HEALTH.test(text)) return false;
  if (MONITOR_SIGNALS.some((s) => text.includes(s))) return true;
  // Gaming/spec screen with no explicit "monitor" word — e.g. Samsung's own "Odyssey
  // Neo G9"/"Odyssey OLED G6/G9" gaming-monitor line names carry no "monitor"/"screen"
  // word at all, just the model line + a gaming cue + hz/inch spec. A device with a
  // gaming cue and a size, or both a refresh rate and a size, is a monitor — UNLESS it
  // was already caught above as a TV/laptop/tablet/phone/projector/wearable/accessory.
  // ADR-350 (2026-09-13): this used to require the Arabic word "شاشة" ("screen") to
  // appear before even checking gaming/hz/inch at all — but Samsung KSA's English-locale
  // (sa_en) scrape duplicates name_en into name_ar verbatim (proven: raw_observations
  // for "Odyssey Neo G9" has name_ar === name_en, no Arabic characters), so that gate
  // structurally could never fire for an English-only title. The gate applied an
  // Arabic-only evidentiary bar to an English-sourced store; removing it makes the same
  // hz/inch/gaming evidence available in both languages, not a new, looser bar.
  const gaming = /العاب|ألعاب|قيمنج|gaming/.test(text);
  const hz = /\d{2,3}\s*(?:hz|هرتز)/.test(text);
  const inch = /\d{2}(?:\.\d)?\s*(?:inch|"|”|بوصة|انش|إنش)/.test(text);
  if ((gaming && (hz || inch)) || (hz && inch)) return true;
  return false;
}
