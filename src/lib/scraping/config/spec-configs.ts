import type { ProductCategory } from '@/lib/database/types';

export interface SpecFilterOption {
  value: string;
  label_ar: string;
  label_en: string;
}

export interface SpecFilterDefinition {
  key: string;
  label_ar: string;
  label_en: string;
  type: 'checkbox' | 'range';
  options: SpecFilterOption[];
}

export const CATEGORY_SPEC_FILTERS: Partial<Record<ProductCategory, SpecFilterDefinition[]>> = {
  smartphone: [
    {
      key: 'ram_gb',
      label_ar: 'الذاكرة العشوائية',
      label_en: 'RAM',
      type: 'checkbox',
      options: [
        { value: '4', label_ar: '4 جيجابايت', label_en: '4 GB' },
        { value: '6', label_ar: '6 جيجابايت', label_en: '6 GB' },
        { value: '8', label_ar: '8 جيجابايت', label_en: '8 GB' },
        { value: '12', label_ar: '12 جيجابايت', label_en: '12 GB' },
        { value: '16', label_ar: '16 جيجابايت', label_en: '16 GB' },
      ],
    },
    {
      key: 'storage_gb',
      label_ar: 'سعة التخزين',
      label_en: 'Storage',
      type: 'checkbox',
      options: [
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
        { value: '128', label_ar: '128 جيجابايت', label_en: '128 GB' },
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
        { value: '1024', label_ar: '1 تيرابايت', label_en: '1 TB' },
      ],
    },
    {
      key: 'color',
      label_ar: 'اللون',
      label_en: 'Color',
      type: 'checkbox',
      options: [
        { value: 'black', label_ar: 'أسود', label_en: 'Black' },
        { value: 'white', label_ar: 'أبيض', label_en: 'White' },
        { value: 'silver', label_ar: 'فضي', label_en: 'Silver' },
        { value: 'gold', label_ar: 'ذهبي', label_en: 'Gold' },
        { value: 'blue', label_ar: 'أزرق', label_en: 'Blue' },
        { value: 'green', label_ar: 'أخضر', label_en: 'Green' },
        { value: 'red', label_ar: 'أحمر', label_en: 'Red' },
        { value: 'pink', label_ar: 'وردي', label_en: 'Pink' },
        { value: 'purple', label_ar: 'بنفسجي', label_en: 'Purple' },
        { value: 'orange', label_ar: 'برتقالي', label_en: 'Orange' },
        { value: 'titanium', label_ar: 'تيتانيوم', label_en: 'Titanium' },
      ],
    },
    {
      key: 'connectivity',
      label_ar: 'الاتصال',
      label_en: 'Connectivity',
      type: 'checkbox',
      options: [
        { value: '5g', label_ar: '5G', label_en: '5G' },
        { value: '4g', label_ar: '4G LTE', label_en: '4G LTE' },
        { value: 'wifi', label_ar: 'واي فاي فقط', label_en: 'WiFi Only' },
      ],
    },
    {
      key: 'sim_type',
      label_ar: 'نوع الشريحة',
      label_en: 'SIM Type',
      type: 'checkbox',
      options: [
        { value: 'esim_only', label_ar: 'eSIM فقط', label_en: 'eSIM Only' },
        { value: 'esim', label_ar: 'eSIM', label_en: 'eSIM' },
        { value: 'dual_sim', label_ar: 'شريحتين', label_en: 'Dual SIM' },
        { value: 'single_sim', label_ar: 'شريحة واحدة', label_en: 'Single SIM' },
      ],
    },
  ],
  laptop: [
    {
      key: 'ram_gb',
      label_ar: 'الذاكرة العشوائية',
      label_en: 'RAM',
      type: 'checkbox',
      options: [
        { value: '8', label_ar: '8 جيجابايت', label_en: '8 GB' },
        { value: '16', label_ar: '16 جيجابايت', label_en: '16 GB' },
        { value: '32', label_ar: '32 جيجابايت', label_en: '32 GB' },
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
      ],
    },
    {
      key: 'storage_gb',
      label_ar: 'سعة التخزين',
      label_en: 'Storage',
      type: 'checkbox',
      options: [
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
        { value: '1024', label_ar: '1 تيرابايت', label_en: '1 TB' },
        { value: '2048', label_ar: '2 تيرابايت', label_en: '2 TB' },
      ],
    },
    {
      key: 'storage_type',
      label_ar: 'نوع التخزين',
      label_en: 'Storage Type',
      type: 'checkbox',
      options: [
        { value: 'ssd', label_ar: 'SSD', label_en: 'SSD' },
        { value: 'hdd', label_ar: 'HDD', label_en: 'HDD' },
      ],
    },
    {
      key: 'screen_size',
      label_ar: 'حجم الشاشة',
      label_en: 'Screen Size',
      type: 'checkbox',
      options: [
        { value: '13', label_ar: '13 بوصة', label_en: '13"' },
        { value: '14', label_ar: '14 بوصة', label_en: '14"' },
        { value: '15', label_ar: '15 بوصة', label_en: '15"' },
        { value: '16', label_ar: '16 بوصة', label_en: '16"' },
        { value: '17', label_ar: '17 بوصة', label_en: '17"' },
      ],
    },
    {
      key: 'color',
      label_ar: 'اللون',
      label_en: 'Color',
      type: 'checkbox',
      options: [
        { value: 'black', label_ar: 'أسود', label_en: 'Black' },
        { value: 'white', label_ar: 'أبيض', label_en: 'White' },
        { value: 'silver', label_ar: 'فضي', label_en: 'Silver' },
        { value: 'gold', label_ar: 'ذهبي', label_en: 'Gold' },
        { value: 'blue', label_ar: 'أزرق', label_en: 'Blue' },
        { value: 'purple', label_ar: 'بنفسجي', label_en: 'Purple' },
      ],
    },
  ],
  tv: [
    {
      key: 'screen_size',
      label_ar: 'حجم الشاشة',
      label_en: 'Screen Size',
      type: 'checkbox',
      options: [
        { value: '32', label_ar: '32 بوصة', label_en: '32"' },
        { value: '43', label_ar: '43 بوصة', label_en: '43"' },
        { value: '50', label_ar: '50 بوصة', label_en: '50"' },
        { value: '55', label_ar: '55 بوصة', label_en: '55"' },
        { value: '65', label_ar: '65 بوصة', label_en: '65"' },
        { value: '75', label_ar: '75 بوصة', label_en: '75"' },
        { value: '85', label_ar: '85 بوصة', label_en: '85"' },
      ],
    },
    {
      key: 'resolution',
      label_ar: 'الدقة',
      label_en: 'Resolution',
      type: 'checkbox',
      options: [
        { value: 'fhd', label_ar: 'Full HD', label_en: 'Full HD (1080p)' },
        { value: '4k', label_ar: '4K', label_en: '4K UHD' },
        { value: '8k', label_ar: '8K', label_en: '8K' },
      ],
    },
    {
      key: 'panel_type',
      label_ar: 'نوع الشاشة',
      label_en: 'Panel Type',
      type: 'checkbox',
      options: [
        { value: 'led', label_ar: 'LED', label_en: 'LED' },
        { value: 'qled', label_ar: 'QLED', label_en: 'QLED' },
        { value: 'oled', label_ar: 'OLED', label_en: 'OLED' },
      ],
    },
  ],
  tablet: [
    {
      key: 'ram_gb',
      label_ar: 'الذاكرة العشوائية',
      label_en: 'RAM',
      type: 'checkbox',
      options: [
        { value: '4', label_ar: '4 جيجابايت', label_en: '4 GB' },
        { value: '6', label_ar: '6 جيجابايت', label_en: '6 GB' },
        { value: '8', label_ar: '8 جيجابايت', label_en: '8 GB' },
        { value: '12', label_ar: '12 جيجابايت', label_en: '12 GB' },
        { value: '16', label_ar: '16 جيجابايت', label_en: '16 GB' },
      ],
    },
    {
      key: 'storage_gb',
      label_ar: 'سعة التخزين',
      label_en: 'Storage',
      type: 'checkbox',
      options: [
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
        { value: '128', label_ar: '128 جيجابايت', label_en: '128 GB' },
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
        { value: '1024', label_ar: '1 تيرابايت', label_en: '1 TB' },
      ],
    },
    {
      key: 'color',
      label_ar: 'اللون',
      label_en: 'Color',
      type: 'checkbox',
      options: [
        { value: 'black', label_ar: 'أسود', label_en: 'Black' },
        { value: 'white', label_ar: 'أبيض', label_en: 'White' },
        { value: 'silver', label_ar: 'فضي', label_en: 'Silver' },
        { value: 'gold', label_ar: 'ذهبي', label_en: 'Gold' },
        { value: 'blue', label_ar: 'أزرق', label_en: 'Blue' },
        { value: 'purple', label_ar: 'بنفسجي', label_en: 'Purple' },
      ],
    },
    {
      key: 'connectivity',
      label_ar: 'الاتصال',
      label_en: 'Connectivity',
      type: 'checkbox',
      options: [
        { value: '5g', label_ar: '5G', label_en: '5G' },
        { value: '4g', label_ar: '4G LTE', label_en: '4G LTE' },
        { value: 'wifi', label_ar: 'واي فاي فقط', label_en: 'WiFi Only' },
      ],
    },
  ],
  audio: [
    {
      key: 'audio_type',
      label_ar: 'النوع',
      label_en: 'Type',
      type: 'checkbox',
      options: [
        { value: 'over-ear', label_ar: 'فوق الأذن', label_en: 'Over-Ear' },
        { value: 'in-ear', label_ar: 'داخل الأذن', label_en: 'In-Ear' },
        { value: 'speaker', label_ar: 'سماعة خارجية', label_en: 'Speaker' },
      ],
    },
    {
      key: 'wireless',
      label_ar: 'الاتصال',
      label_en: 'Connectivity',
      type: 'checkbox',
      options: [
        { value: 'wireless', label_ar: 'لاسلكي', label_en: 'Wireless' },
        { value: 'wired', label_ar: 'سلكي', label_en: 'Wired' },
      ],
    },
    {
      key: 'anc',
      label_ar: 'إلغاء الضوضاء',
      label_en: 'Noise Cancellation',
      type: 'checkbox',
      options: [
        { value: 'yes', label_ar: 'نعم', label_en: 'Yes' },
        { value: 'no', label_ar: 'لا', label_en: 'No' },
      ],
    },
  ],
  gaming: [
    {
      key: 'platform',
      label_ar: 'المنصة',
      label_en: 'Platform',
      type: 'checkbox',
      options: [
        { value: 'ps5', label_ar: 'بلايستيشن 5', label_en: 'PlayStation 5' },
        { value: 'xbox', label_ar: 'اكس بوكس', label_en: 'Xbox' },
        { value: 'pc', label_ar: 'كمبيوتر', label_en: 'PC' },
        { value: 'switch', label_ar: 'نينتندو سويتش', label_en: 'Nintendo Switch' },
      ],
    },
    {
      key: 'gaming_type',
      label_ar: 'النوع',
      label_en: 'Type',
      type: 'checkbox',
      options: [
        { value: 'console', label_ar: 'جهاز', label_en: 'Console' },
        { value: 'game', label_ar: 'لعبة', label_en: 'Game' },
        { value: 'accessory', label_ar: 'ملحقات', label_en: 'Accessory' },
      ],
    },
  ],
};

// Multi-word colors first, then single-word, then Arabic
const COLOR_KEYWORDS: [RegExp, string][] = [
  // Multi-word (must come first to match before single-word)
  [/cosmic\s*orange/i, 'orange'],
  [/cosmic\s*black/i, 'black'],
  [/space\s*black/i, 'black'],
  [/space\s*gray/i, 'silver'],
  [/space\s*grey/i, 'silver'],
  [/midnight\s*blue/i, 'blue'],
  [/ocean\s*blue/i, 'blue'],
  [/ice\s*blue/i, 'blue'],
  [/sky\s*blue/i, 'blue'],
  [/mint\s*green/i, 'green'],
  [/sage\s*green/i, 'green'],
  [/forest\s*green/i, 'green'],
  [/rose\s*gold/i, 'pink'],
  [/phantom\s*silver/i, 'silver'],
  [/phantom\s*black/i, 'black'],
  [/phantom\s*white/i, 'white'],
  [/natural\s*titanium/i, 'titanium'],
  [/desert\s*titanium/i, 'titanium'],
  [/black\s*titanium/i, 'titanium'],
  [/white\s*titanium/i, 'titanium'],
  [/blue\s*titanium/i, 'titanium'],
  [/starlight/i, 'white'],
  [/midnight/i, 'black'],
  // Single-word English
  [/\btitanium\b/i, 'titanium'],
  [/\bsilver\b/i, 'silver'],
  [/\bgold\b/i, 'gold'],
  [/\bblack\b/i, 'black'],
  [/\bwhite\b/i, 'white'],
  [/\bblue\b/i, 'blue'],
  [/\bgreen\b/i, 'green'],
  [/\bred\b/i, 'red'],
  [/\bpink\b/i, 'pink'],
  [/\bpurple\b/i, 'purple'],
  [/\borange\b/i, 'orange'],
  [/\bgray\b/i, 'silver'],
  [/\bgrey\b/i, 'silver'],
  [/\blavender\b/i, 'purple'],
  [/\bcoral\b/i, 'orange'],
  [/\bcream\b/i, 'white'],
  // Arabic
  [/أسود/i, 'black'],
  [/أبيض/i, 'white'],
  [/فضي/i, 'silver'],
  [/ذهبي/i, 'gold'],
  [/أزرق/i, 'blue'],
  [/أخضر/i, 'green'],
  [/أحمر/i, 'red'],
  [/وردي/i, 'pink'],
  [/بنفسجي/i, 'purple'],
  [/برتقالي/i, 'orange'],
];

// Build a single regex from all color keywords for efficient matching
const COLOR_PATTERN = new RegExp(
  COLOR_KEYWORDS.map(([re]) => re.source).join('|'),
  'i'
);

function normalizeColor(matched: string): string {
  for (const [re, normalized] of COLOR_KEYWORDS) {
    if (re.test(matched)) return normalized;
  }
  return matched.toLowerCase();
}

/**
 * Extract specs from a product title string.
 * Returns key-value pairs matching spec filter keys.
 */
export function extractSpecsFromTitle(title: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const t = title.toLowerCase();

  // --- RAM & Storage disambiguation ---
  // Collect all GB/TB matches
  const allGB: { value: number; index: number }[] = [];
  const allTB: { value: number; index: number }[] = [];
  let gbMatch: RegExpExecArray | null;
  const gbRe = /(\d+)\s*gb/gi;
  while ((gbMatch = gbRe.exec(t)) !== null) {
    allGB.push({ value: parseInt(gbMatch[1]), index: gbMatch.index });
  }
  const tbRe = /(\d+)\s*tb/gi;
  let tbMatch: RegExpExecArray | null;
  while ((tbMatch = tbRe.exec(t)) !== null) {
    allTB.push({ value: parseInt(tbMatch[1]) * 1024, index: tbMatch.index });
  }

  // Check for explicit RAM keyword: "8GB RAM", "RAM 8GB", "8gb memory", "ذاكرة 8"
  const explicitRamMatch = t.match(/(\d+)\s*gb\s*(?:ram|memory|ذاكرة)/i) ||
                           t.match(/(?:ram|memory|ذاكرة)\s*[:.]?\s*(\d+)\s*gb/i);
  if (explicitRamMatch) {
    specs.ram_gb = (explicitRamMatch[1] || explicitRamMatch[2]);
  }

  // Check for explicit storage keyword: "256GB SSD", "storage 512GB", "تخزين 256"
  const explicitStorageMatch = t.match(/(\d+)\s*gb\s*(?:storage|ssd|hdd|rom|internal|تخزين)/i) ||
                               t.match(/(?:storage|ssd|hdd|rom|internal|تخزين)\s*[:.]?\s*(\d+)\s*gb/i);
  if (explicitStorageMatch) {
    specs.storage_gb = (explicitStorageMatch[1] || explicitStorageMatch[2]);
  }

  // TB values without keywords → always storage
  if (!specs.storage_gb && allTB.length > 0) {
    specs.storage_gb = String(allTB[0].value);
  }

  // If no keywords found, use heuristics on bare GB values
  if (!specs.ram_gb && !specs.storage_gb) {
    if (allGB.length === 1) {
      // Single GB value ≥ 32 → storage (phone titles never list bare RAM alone)
      if (allGB[0].value >= 32) {
        specs.storage_gb = String(allGB[0].value);
      }
    } else if (allGB.length >= 2) {
      // Two+ GB values → smaller = RAM, larger = storage ("12GB 256GB")
      const sorted = [...allGB].sort((a, b) => a.value - b.value);
      specs.ram_gb = String(sorted[0].value);
      specs.storage_gb = String(sorted[sorted.length - 1].value);
    }
  }

  // Cross-fill: explicit RAM found but no storage — check remaining GB values ≥ 32
  if (specs.ram_gb && !specs.storage_gb) {
    const ramVal = parseInt(specs.ram_gb);
    const remaining = allGB.filter(g => g.value !== ramVal && g.value >= 32);
    if (remaining.length > 0) {
      specs.storage_gb = String(Math.max(...remaining.map(g => g.value)));
    }
    if (!specs.storage_gb && allTB.length > 0) {
      specs.storage_gb = String(allTB[0].value);
    }
  }

  // Cross-fill: explicit storage found but no RAM — check remaining GB values < storage
  if (specs.storage_gb && !specs.ram_gb) {
    const storageVal = parseInt(specs.storage_gb);
    const remaining = allGB.filter(g => g.value < storageVal && g.value < 32);
    if (remaining.length > 0) {
      specs.ram_gb = String(Math.max(...remaining.map(g => g.value)));
    }
  }

  // Storage type
  if (t.includes('ssd')) specs.storage_type = 'ssd';
  else if (t.includes('hdd')) specs.storage_type = 'hdd';

  // Screen size: "14-inch", "55\"", "15.6 inch", "14 بوصة"
  const screenMatch = t.match(/(\d+(?:\.\d+)?)\s*[-"]?\s*(?:inch|"|بوصة|in\b)/i) ||
                      t.match(/(\d+(?:\.\d+)?)\s*-\s*inch/i);
  if (screenMatch) {
    specs.screen_size = String(Math.round(parseFloat(screenMatch[1])));
  }

  // TV resolution
  if (t.includes('8k')) specs.resolution = '8k';
  else if (t.includes('4k') || t.includes('uhd')) specs.resolution = '4k';
  else if (t.includes('1080p') || t.includes('full hd') || t.includes('fhd')) specs.resolution = 'fhd';

  // TV panel type
  if (t.includes('oled') && !t.includes('qled')) specs.panel_type = 'oled';
  else if (t.includes('qled')) specs.panel_type = 'qled';
  else if (t.includes('led')) specs.panel_type = 'led';

  // Audio type
  if (t.includes('over-ear') || t.includes('over ear')) specs.audio_type = 'over-ear';
  else if (t.includes('in-ear') || t.includes('in ear') || t.includes('earbud') || t.includes('airpod')) specs.audio_type = 'in-ear';
  else if (t.includes('speaker') || t.includes('soundbar') || t.includes('سماعة خارجية')) specs.audio_type = 'speaker';

  // Wireless
  if (t.includes('wireless') || t.includes('bluetooth') || t.includes('لاسلكي')) specs.wireless = 'wireless';
  else if (t.includes('wired') || t.includes('سلكي')) specs.wireless = 'wired';

  // ANC
  if (t.includes('noise cancel') || t.includes('anc') || t.includes('إلغاء الضوضاء')) specs.anc = 'yes';

  // Gaming platform
  if (t.includes('ps5') || t.includes('playstation 5') || t.includes('بلايستيشن 5')) specs.platform = 'ps5';
  else if (t.includes('xbox')) specs.platform = 'xbox';
  else if (t.includes('switch') || t.includes('nintendo')) specs.platform = 'switch';

  // Gaming type
  if (t.includes('controller') || t.includes('headset') || t.includes('joystick')) specs.gaming_type = 'accessory';
  else if (t.includes('console')) specs.gaming_type = 'console';

  // Color extraction — test against original title (case-insensitive patterns)
  const colorMatch = title.match(COLOR_PATTERN);
  if (colorMatch) {
    specs.color = normalizeColor(colorMatch[0]);
  }

  // Connectivity: 5G / 4G / WiFi Only
  if (/\b5g\b/i.test(t)) specs.connectivity = '5g';
  else if (/\b4g\b|\blte\b/i.test(t)) specs.connectivity = '4g';
  else if (/\bwi-?fi\s*only\b/i.test(t)) specs.connectivity = 'wifi';

  // SIM type
  if (/\besim\s*only\b/i.test(t)) specs.sim_type = 'esim_only';
  else if (/\bdual\s*sim\b/i.test(t)) specs.sim_type = 'dual_sim';
  else if (/\besim\b/i.test(t)) specs.sim_type = 'esim';
  else if (/\bsingle\s*sim\b/i.test(t)) specs.sim_type = 'single_sim';

  // Condition: renewed/refurbished/used (skip "new" — too many false positives)
  if (/\b(?:renewed|refurbished|مجدد)\b/i.test(t)) specs.condition = 'renewed';
  else if (/\b(?:used|مستعمل)\b/i.test(t)) specs.condition = 'used';

  return specs;
}
