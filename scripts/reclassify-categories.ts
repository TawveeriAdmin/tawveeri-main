#!/usr/bin/env tsx
/**
 * Stand-alone product category reclassifier.
 *
 * Reads every active product from the DB, runs a tight keyword-based
 * classifier over `name_en || name_ar`, and writes back a corrected
 * `products.category`.
 *
 * Intentionally does NOT import from `src/lib/scraping/**` so it's safe to
 * run while the Amazon enrichment script is active (enrichment only reads
 * `category`, doesn't write it).
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/reclassify-categories.ts
 *     → show proposed changes only, no writes
 *   npx tsx scripts/reclassify-categories.ts
 *     → apply
 *   LIMIT=5000 npx tsx scripts/reclassify-categories.ts
 *     → cap how many rows to process (useful for testing)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local first (dev overrides), then .env.
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

type Category =
  | 'smartphone'
  | 'laptop'
  | 'tablet'
  | 'tv'
  | 'audio'
  | 'camera'
  | 'gaming'
  | 'monitor'
  | 'printer'
  | 'networking'
  | 'smart_home'
  | 'wearable'
  | 'appliance'
  | 'kitchen'
  | 'personal_care'
  | 'accessories';

const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;
const BATCH = 100;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supa = createClient(URL, KEY, { auth: { persistSession: false } });

/** Accessory indicator keywords — a title containing any of these should be
 *  classified as 'accessories' no matter what else matches ("iPhone case"
 *  should not be smartphone). Whole-word boundaries applied at match time. */
const ACCESSORY_KEYWORDS = [
  'case', 'cover', 'sleeve', 'pouch', 'protector', 'tempered glass', 'screen guard',
  'charger', 'charging cable', 'usb cable', 'lightning cable', 'usb-c cable',
  'adapter', 'dongle', 'hub', 'power bank', 'powerbank',
  'mount', 'stand', 'holder', 'grip', 'bracket', 'popsocket', 'selfie stick',
  'tripod', 'gimbal', 'cleaning kit', 'lens filter', 'skin for', 'replacement band',
  // Arabic
  'جراب', 'كفر', 'غطاء', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'كابل',
  'حامل', 'حزام', 'ستراب', 'مشبك',
];

/** Ordered rules: (regex, category). First match wins. Uses \b or (?:^|\s) for
 *  whole-word matches so "display" inside "displayport" still matches display
 *  but "screenprint" won't match "print". */
const RULES: Array<[RegExp, Category]> = [
  // --- Highly specific product categories first ---
  [/\b(refrigerator|fridge|freezer|washing machine|washer|dryer|dishwasher|microwave|oven range|air conditioner|split ac|ac unit|water heater|vacuum cleaner|water dispenser)\b/i, 'appliance'],
  [/(ثلاجة|غسالة|نشافة|غسالة صحون|فرن|ميكروويف|مكيف|مكيف سبليت|سخان ماء|مكنسة كهربائية)/i, 'appliance'],
  [/\b(blender|food processor|juicer|mixer|kettle|toaster|air fryer|coffee (?:maker|machine)|espresso (?:maker|machine)|rice cooker|slow cooker|pressure cooker|induction cooker|sandwich maker|waffle maker|stand mixer|stick blender)\b/i, 'kitchen'],
  [/(خلاط|عصارة|غلاية|محمصة|قلاية هوائية|صانعة قهوة|ماكينة قهوة|طباخ أرز|قدر ضغط)/i, 'kitchen'],
  [/\b(hair dryer|hairdryer|hair straightener|curling iron|electric shaver|electric razor|beard trimmer|hair clipper|electric toothbrush|epilator|facial cleanser brush|body scale|blood pressure monitor|humidifier|dehumidifier)\b/i, 'personal_care'],
  [/(مجفف شعر|مكواة شعر|ماكينة حلاقة|فرشاة أسنان كهربائية|ميزان حمام|ميزان جسم)/i, 'personal_care'],
  [/\b(playstation|ps5|ps4|xbox( series [sx])?|xbox one|nintendo switch|steam deck|rog ally|handheld console|gaming chair|gaming keyboard|gaming mouse|gaming headset|gaming mice|dualsense|dualshock)\b/i, 'gaming'],
  [/(بلايستيشن|اكس بوكس|إكس بوكس|نينتندو)/i, 'gaming'],
  [/\b(smartwatch|smart watch|apple watch|galaxy watch|garmin|fitbit|amazfit|fitness (?:tracker|band)|sports? watch|activity tracker)\b/i, 'wearable'],
  [/(ساعة ذكية|ساعات ذكية|سوار رياضي)/i, 'wearable'],
  [/\b(smart bulb|smart plug|smart lock|smart doorbell|video doorbell|ring doorbell|alexa|echo dot|echo show|google home|google nest|nest hub|philips hue|smart speaker|smart thermostat|smart lighting|smart sensor|smart camera|security camera|cctv)\b/i, 'smart_home'],
  [/(جرس ذكي|مصباح ذكي|سماعة ذكية|كاميرا مراقبة|كاميرا أمنية)/i, 'smart_home'],
  [/\b(wifi router|wi-fi router|\brouter\b|mesh (?:router|system|wifi)|wifi extender|wi-fi extender|range extender|access point|\bwap\b|network switch|ethernet switch|powerline adapter|\bmodem\b|raspberry pi|fiber modem)\b/i, 'networking'],
  [/(راوتر|موزع شبكة|شبكة منزلية|واي فاي منزلي)/i, 'networking'],
  [/\b(inkjet printer|laser printer|laserjet|inkjet|all[- ]in[- ]one printer|multifunction printer|printer(?: with scanner)?|photo printer|label printer|ink tank|laser mfp|ink cartridge|toner cartridge)\b/i, 'printer'],
  [/(طابعة|طابعات|حبر طابعة|طابعة ليزر|طابعة نفث)/i, 'printer'],
  [/\b(laptop|notebook|ultrabook|macbook(?: air| pro)?|chromebook|gaming laptop|2[- ]in[- ]1 laptop|convertible laptop|business laptop)\b/i, 'laptop'],
  [/(لابتوب|حاسوب محمول|كمبيوتر محمول|ماك بوك)/i, 'laptop'],
  [/\b(tablet|ipad(?: air| pro| mini)?|galaxy tab|kindle(?: oasis| paperwhite)?|surface (?:pro|go)|e[- ]reader)\b/i, 'tablet'],
  [/(تابلت|آيباد|ايباد|كيندل)/i, 'tablet'],
  [/\b(smartphone|mobile phone|cell phone|iphone(?: \d+)?|galaxy s\d+|galaxy z flip|galaxy z fold|google pixel|redmi|oneplus|oppo reno|vivo|honor|\bnothing phone\b)\b/i, 'smartphone'],
  [/(هاتف|هواتف|هواتف ذكية|جوال|موبايل|ايفون|آيفون)/i, 'smartphone'],
  [/\b(smart tv|android tv|google tv|apple tv|4k (?:uhd |qled |oled |led |)tv|oled tv|qled tv|led tv|uhd tv|\btv\b|television|plasma tv|neo qled)\b/i, 'tv'],
  [/(تلفزيون|تلفاز|شاشة تلفاز|شاشة سمارت)/i, 'tv'],
  [/\b(computer monitor|gaming monitor|4k monitor|curved monitor|ultrawide monitor|ips monitor|led monitor|oled monitor|display port monitor|\bmonitor\b(?!ing)|portable monitor|external display)\b/i, 'monitor'],
  [/(شاشة كمبيوتر|شاشة حاسوب|شاشة مكتب|مونيتور)/i, 'monitor'],
  [/\b(dslr camera|mirrorless camera|action cam|action camera|gopro|dji pocket|instax|polaroid camera|camcorder|vlog camera|point and shoot|digital camera|webcam|security camera|ip camera|trail camera|dash cam|body cam)\b/i, 'camera'],
  [/(كاميرا رقمية|كاميرا dslr|كاميرا احترافية)/i, 'camera'],
  [/\b(headphone|headset|earbud|earbuds|earphone|airpods|airpods pro|airpods max|pods pro|beats studio|over[- ]ear|in[- ]ear|true wireless|anc headphone|anc headset|soundbar|bluetooth speaker|portable speaker|studio monitor speaker|home theater|dj headphone|gaming headphone|speaker system|wireless speaker|microphone|condenser mic|xlr mic|usb mic|mixer console|pa speaker)\b/i, 'audio'],
  [/(سماعة|سماعات|مكبر صوت|سماعة بلوتوث|سماعة لاسلكية|ميكروفون)/i, 'audio'],
  // accessories is the fall-through
];

/** Direct accessory heuristic — if the title screams "accessory for X", force
 *  the accessories bucket. Word-boundary match so "bookcase" doesn't match "case". */
function isAccessory(title: string): boolean {
  const t = ` ${title.toLowerCase()} `;
  for (const kw of ACCESSORY_KEYWORDS) {
    // Loose contains for Arabic (no word boundaries), \b-style for English.
    if (/[A-Za-z]/.test(kw)) {
      const re = new RegExp(`(?:^|[^a-zA-Z])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:[^a-zA-Z]|$)`, 'i');
      if (re.test(t)) return true;
    } else if (t.includes(kw)) {
      return true;
    }
  }
  return false;
}

export function classify(title: string): Category {
  if (!title || !title.trim()) return 'accessories';
  if (isAccessory(title)) return 'accessories';
  for (const [re, cat] of RULES) {
    if (re.test(title)) return cat;
  }
  return 'accessories';
}

async function sampleMode(category: string) {
  const { data, error } = await supa
    .from('products')
    .select('id, name_en, name_ar, category')
    .eq('is_active', true)
    .eq('category', category)
    .limit(30);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`[sample] 30 products currently in category="${category}":`);
  (data ?? []).forEach((p: { id: string; name_en: string; name_ar: string }) => {
    console.log(`  ${p.id.slice(0, 8)}  ${(p.name_en || p.name_ar || '').slice(0, 100)}`);
  });
}

async function main() {
  const sample = process.env.SAMPLE;
  if (sample) {
    await sampleMode(sample);
    return;
  }
  console.log(`[reclassify] ${DRY_RUN ? 'DRY RUN' : 'APPLY'}${LIMIT ? ` · limit=${LIMIT}` : ''}`);

  // Stream paginated. We don't need all rows in memory at once — process + update in batches.
  let from = 0;
  const pageSize = 1000;
  const diffs: Record<string, number> = {};
  let processed = 0;
  let changed = 0;
  const pending: Array<{ id: string; category: Category }> = [];

  while (true) {
    const q = supa
      .from('products')
      .select('id, name_en, name_ar, category')
      .eq('is_active', true)
      .range(from, from + pageSize - 1)
      .order('id', { ascending: true });
    const { data, error } = await q;
    if (error) {
      console.error('[reclassify] read error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const p of data as Array<{ id: string; name_en: string; name_ar: string; category: string | null }>) {
      processed++;
      const title = p.name_en || p.name_ar || '';
      const next = classify(title);
      if (next !== p.category) {
        changed++;
        const key = `${p.category ?? 'null'} → ${next}`;
        diffs[key] = (diffs[key] ?? 0) + 1;
        pending.push({ id: p.id, category: next });
      }
      if (LIMIT && processed >= LIMIT) break;
    }

    if (pending.length >= BATCH) {
      await flush(pending);
    }

    if (data.length < pageSize) break;
    if (LIMIT && processed >= LIMIT) break;
    from += pageSize;
  }

  if (pending.length) await flush(pending);

  console.log(`[reclassify] processed ${processed} · changed ${changed}`);
  console.log('[reclassify] top changes:');
  Object.entries(diffs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(6)}  ${k}`));
}

async function flush(buffer: Array<{ id: string; category: Category }>): Promise<void> {
  if (DRY_RUN) {
    buffer.length = 0;
    return;
  }
  // Supabase JS doesn't support bulk per-row conditional upsert cheaply,
  // but we can group by target category and issue one UPDATE per category.
  const byCat = new Map<Category, string[]>();
  for (const { id, category } of buffer) {
    if (!byCat.has(category)) byCat.set(category, []);
    byCat.get(category)!.push(id);
  }
  for (const [cat, ids] of byCat) {
    const { error } = await supa.from('products').update({ category: cat }).in('id', ids);
    if (error) console.error(`[reclassify] update ${cat} failed:`, error.message);
  }
  buffer.length = 0;
}

main().catch((err) => {
  console.error('[reclassify] fatal:', err);
  process.exit(1);
});
