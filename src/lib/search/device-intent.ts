// src/lib/search/device-intent.ts — a query that NAMES a device wants the device, not its accessories (2026-10-06).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED (production, external review 2026-10-06): «ps5», «PlayStation 5» and «Nintendo Switch» return 48/48/41 results that are ALL
// headsets, controllers and games — the catalogue holds no console, and nothing said so. The shopper reads a grid of «for PS5» items as the
// answer to «ps5». The honest state is «we do not carry the device itself; these are accessories for it». This module only recognises the
// device named by the query; deciding whether the results contain it stays in the search route (it owns the accessory detectors).
//
// A small closed dictionary of high-intent consumer devices — extend it with evidence, never with a guess. Tokens are matched as whole
// words (script-aware: JS `\b` never matches beside Arabic letters).
import { normalizeArabic } from './arabic-normalize';

export interface DeviceIntent {
  /** Stable id (also the analytics label). */
  id: string;
  /** What to call it to the shopper. */
  labelAr: string;
  labelEn: string;
  /** Normalized, lower-cased phrases that name the device itself (a title containing one of them, and not an accessory, is the device). */
  phrases: string[];
}

export const DEVICE_INTENTS: DeviceIntent[] = [
  { id: 'ps5', labelAr: 'بلايستيشن 5', labelEn: 'PlayStation 5', phrases: ['ps5', 'ps 5', 'playstation 5', 'playstation5', 'بلايستيشن 5', 'بلاي ستيشن 5', 'بلستيشن 5'] },
  { id: 'ps4', labelAr: 'بلايستيشن 4', labelEn: 'PlayStation 4', phrases: ['ps4', 'ps 4', 'playstation 4', 'playstation4', 'بلايستيشن 4', 'بلاي ستيشن 4'] },
  { id: 'xbox', labelAr: 'إكس بوكس', labelEn: 'Xbox', phrases: ['xbox', 'اكس بوكس', 'إكس بوكس'] },
  { id: 'switch', labelAr: 'نينتندو سويتش', labelEn: 'Nintendo Switch', phrases: ['nintendo switch', 'نينتندو سويتش', 'نينتندو سوتش'] },
];

const tokens = (text: string): string[] => normalizeArabic(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** True when `phrase` (one or more words) occurs in `text` as whole words. */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = tokens(text);
  const p = tokens(phrase);
  if (!p.length || p.length > t.length) return false;
  for (let i = 0; i <= t.length - p.length; i++) {
    if (p.every((w, j) => t[i + j] === w)) return true;
  }
  return false;
}

/** The device a query names, or null. A query that names two different devices is ambiguous and returns null. */
export function deviceIntentOf(query: string): DeviceIntent | null {
  const hits = DEVICE_INTENTS.filter((d) => d.phrases.some((ph) => containsPhrase(query, ph)));
  return hits.length === 1 ? hits[0] : null;
}

/** Does a product title name the device itself (necessary, not sufficient — the caller still rejects accessories)? */
export function titleNamesDevice(title: string, intent: DeviceIntent): boolean {
  return intent.phrases.some((ph) => containsPhrase(title, ph));
}

// Words that make a title an accessory / software item OF the device rather than the device (closed list, both scripts).
const NOT_THE_DEVICE = new Set([
  'controller', 'controllers', 'dualsense', 'joycon', 'joy', 'headset', 'headsets', 'headphone', 'headphones', 'gamepad', 'charger', 'charging', 'dock',
  'stand', 'case', 'cover', 'cable', 'game', 'games', 'skin', 'stylus', 'grip', 'bag', 'holder', 'adapter', 'cooling', 'fan', 'remote',
  'لعبة', 'العاب', 'سماعة', 'سماعات', 'كونترولر', 'يد', 'ذراع', 'شاحن', 'حافظة', 'جراب', 'غطاء', 'كيبل', 'حامل',
]);

/**
 * Is this title the DEVICE ITSELF? It must name the device within its first five words («Sony PlayStation 5 Console Slim», «Nintendo Switch
 * OLED Model») and carry no accessory/software word anywhere («… Controller for PS5», «Mario Kart 8 – Nintendo Switch» fails the head test).
 * Conservative on purpose: wrongly saying «no device found» costs a banner; wrongly saying «found» hides the truth.
 */
export function isDeviceItself(title: string, intent: DeviceIntent): boolean {
  const all = tokens(title);
  if (all.some((w) => NOT_THE_DEVICE.has(w))) return false;
  const head = all.slice(0, 5).join(' ');
  return intent.phrases.some((ph) => containsPhrase(head, ph));
}
