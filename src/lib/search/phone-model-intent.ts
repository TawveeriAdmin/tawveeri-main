import { normalizeArabic } from './arabic-normalize';

export interface PhoneModelIntent {
  family: string;
  generation: string;
  tier: string;
  storage: number | null;
  network: string | null;
}

function fold(text: string): string {
  return normalizeArabic(text).toLowerCase()
    .replace(/ايفون/g, 'iphone')
    .replace(/جالاكسي|جالكسي|جلاكسي/g, 'galaxy')
    .replace(/سامسونج/g, 'samsung')
    .replace(/بيكسل|بكسل/g, 'pixel')
    .replace(/ريدمي/g, 'redmi').replace(/نوت/g, 'note')
    .replace(/برو/g, 'pro').replace(/ماكس/g, 'max')
    .replace(/اولترا|الترا/g, 'ultra').replace(/بلس|بلاس|بلص/g, 'plus')
    .replace(/جيجابايت|جيجا/g, 'gb').replace(/تيرابايت|تيرا/g, 'tb')
    .replace(/\s+/g, ' ').trim();
}

// The model, including its suffix, is one contiguous phrase. Compatibility text
// elsewhere in a title cannot supply a missing Pro/Ultra or generation.
const MODEL = /(?<![\p{L}\p{N}])(?:(iphone)\s*(\d{1,2}e?)|(pixel)\s*(\d{1,2}a?)|(redmi\s+note|redmi)\s*(\d{1,2}[a-z]?)|(?:(?:samsung\s+)?galaxy\s*|samsung\s+)([sam])\s*(\d{2}))(?![\p{L}\p{N}])(?:\s*(pro\s*(?:max|plus|\+)|pro|ultra|plus|\+|max|mini|fe|edge|lite)(?![\p{L}\p{N}]))?/u;
const ACCESSORY = /(?<![\p{L}\p{N}])(?:cases?|covers?|chargers?|cables?|adapters?|protectors?|holders?|mounts?|earbuds?|headphones?|anti[\s-]*reflecting\s+film|screen\s+film|protective\s+film|ssd|power\s*bank|كفر|غطاء|جراب|شاحن|كيبل|كابل|واقي|حافظه|حامل|سماعات|سماعه|باور\s*بانك|قرص\s*تخزين)(?![\p{L}\p{N}])/u;

function modelIn(text: string): { model: PhoneModelIntent; before: string; after: string } | null {
  const t = fold(text);
  const m = MODEL.exec(t);
  if (!m) return null;
  const family = m[1] || m[3] || m[5] || `galaxy ${m[7]}`;
  const generation = m[2] || m[4] || m[6] || m[8];
  const after = t.slice(m.index + m[0].length);
  const capacity = [...after.matchAll(/(?<!\d)(\d{1,4})\s*(?:gb|g(?=\s*(?:ram|rom|storage)))\b|(?<!\d)([12])\s*tb\b/g)]
    .find(hit => !/^\s*(?:ram\b|رام(?:\s|$))/.test(after.slice((hit.index ?? 0) + hit[0].length))
      && !/(?:ram|رام)\s*[:=]?\s*$/.test(after.slice(0, hit.index)));
  return {
    model: {
      family, generation,
      tier: (m[9] || 'base').replace(/\+/g, 'plus').replace(/\s+/g, ' ').trim(),
      storage: capacity ? (capacity[1] ? Number(capacity[1]) : Number(capacity[2]) * 1024) : null,
      network: after.match(/\b[45]g\b/)?.[0] ?? null,
    },
    before: t.slice(0, m.index), after,
  };
}

/** Exact phone model requests only; accessory searches and free-form needs retain their own routing. */
export function isPhoneAccessoryTitle(title: string): boolean {
  return ACCESSORY.test(fold(title));
}

/** Bare phone-brand + budget requests in the mobile journey need a category anchor.
 * Explicit appliance/accessory nouns do not match this complete-query grammar. */
export function phoneBudgetSubject(query: string): string {
  return /^(?:samsung|iphone|pixel|redmi|xiaomi)\s+(?:under|below|تحت|اقل من)\s*\d+(?:\s*(?:sar|ريال))?$/i.test(fold(query))
    ? `جوال ${query}` : query;
}

export function phoneModelIntent(query: string): PhoneModelIntent | null {
  const parsed = modelIn(query);
  if (!parsed || ACCESSORY.test(fold(query))) return null;
  const before = parsed.before.replace(/\b(?:apple|google|xiaomi|samsung)\b|ابل|شاومي|جوجل|جوال|هاتف/g, '').trim();
  const after = parsed.after.replace(/\b(?:\d{2,4}\s*gb|[12]\s*tb|[45]g)\b/g, '').trim();
  return !before && !after ? parsed.model : null;
}

/** Positive title evidence only; neither legacy brand nor category labels prove a phone. */
export function matchesPhoneModel(intent: PhoneModelIntent, nameAr?: string | null, nameEn?: string | null): boolean {
  const titles = [nameAr, nameEn].filter((t): t is string => !!t);
  if (titles.some((t) => ACCESSORY.test(fold(t)))) return false;
  const models = titles.map(modelIn).filter((p) => p !== null);
  if (!models.length) return false;
  return models.every(({ model }) => model.family === intent.family && model.generation === intent.generation
    && model.tier === intent.tier
    && (intent.storage === null || intent.storage === model.storage)
    && (intent.network === null || intent.network === model.network));
}

/** A reused merchant URL cannot make two explicitly different phones identical. */
export function conflictingPhoneModels(a: string, b: string): boolean {
  const left = modelIn(a)?.model;
  const right = modelIn(b)?.model;
  if (!left || !right) return false;
  return left.family !== right.family || left.generation !== right.generation || left.tier !== right.tier
    || (left.storage !== null && right.storage !== null && left.storage !== right.storage)
    || (left.network !== null && right.network !== null && left.network !== right.network);
}
