// Single source of truth for the browsable categories (used by the index page and by
// the /categories/<slug> landing route).
//
// WHY the slug route exists: `/categories` linked only to `/search?q=…`, so any guessed
// or externally-linked `/categories/<slug>` URL 404'd — an external reviewer hit exactly
// that. A 404 on a live site is worse than no link, so every plausible category slug now
// resolves to that category's results instead of dead-ending. `aliases` carries the
// spellings people and crawlers actually try (phones/mobiles/smartphone, tv/tvs, ac…).

export type Cat = {
  e: string;
  ar: string;
  en: string;
  q: string;
  slug: string;
  aliases: string[];
};

export const CATS: Cat[] = [
  { e: '📱', ar: 'جوالات', en: 'Phones', q: 'جوال', slug: 'phones', aliases: ['phone', 'mobiles', 'mobile', 'smartphone', 'smartphones', 'جوالات', 'جوال'] },
  { e: '💻', ar: 'لابتوب', en: 'Laptops', q: 'لابتوب', slug: 'laptops', aliases: ['laptop', 'notebooks', 'notebook', 'computers', 'لابتوب'] },
  { e: '🖥️', ar: 'شاشات', en: 'Monitors', q: 'شاشة', slug: 'monitors', aliases: ['monitor', 'displays', 'display', 'شاشات', 'شاشة'] },
  { e: '📺', ar: 'تلفزيونات', en: 'TVs', q: 'تلفزيون', slug: 'tvs', aliases: ['tv', 'television', 'televisions', 'تلفزيون', 'تلفزيونات'] },
  { e: '🎧', ar: 'سماعات', en: 'Audio', q: 'سماعات', slug: 'audio', aliases: ['headphones', 'earbuds', 'speakers', 'سماعات'] },
  { e: '❄️', ar: 'مكيفات', en: 'Air conditioners', q: 'مكيف', slug: 'air-conditioners', aliases: ['ac', 'air-conditioner', 'aircon', 'مكيف', 'مكيفات'] },
  { e: '🧺', ar: 'غسالات', en: 'Washers', q: 'غسالة', slug: 'washers', aliases: ['washer', 'washing-machine', 'washing-machines', 'غسالة', 'غسالات'] },
  { e: '🧊', ar: 'ثلاجات', en: 'Refrigerators', q: 'ثلاجة', slug: 'refrigerators', aliases: ['refrigerator', 'fridge', 'fridges', 'ثلاجة', 'ثلاجات'] },
  { e: '🍳', ar: 'أجهزة مطبخ', en: 'Kitchen', q: 'قلاية هوائية', slug: 'kitchen', aliases: ['kitchen-appliances', 'air-fryer', 'مطبخ'] },
  { e: '📷', ar: 'كاميرات', en: 'Cameras', q: 'كاميرا', slug: 'cameras', aliases: ['camera', 'كاميرا', 'كاميرات'] },
  { e: '🎮', ar: 'ألعاب', en: 'Gaming', q: 'بلايستيشن', slug: 'gaming', aliases: ['games', 'playstation', 'ps5', 'consoles', 'ألعاب'] },
  { e: '⌚', ar: 'ساعات ذكية', en: 'Smartwatches', q: 'ساعة ذكية', slug: 'smartwatches', aliases: ['smartwatch', 'watches', 'watch', 'ساعات'] },
];

/** Resolve a URL slug (or a known alias) to its category. Case/space tolerant. */
export function findCategory(slug: string): Cat | null {
  const key = decodeURIComponent(slug).trim().toLowerCase().replace(/\s+/g, '-');
  return (
    CATS.find((c) => c.slug === key) ??
    CATS.find((c) => c.aliases.some((a) => a.toLowerCase() === key)) ??
    null
  );
}
