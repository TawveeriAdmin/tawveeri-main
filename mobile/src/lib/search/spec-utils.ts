/**
 * Spec filter definitions and title-based spec extraction.
 * Ported from web's src/lib/scraping/config/spec-configs.ts (pure functions, no web deps).
 */

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

export const CATEGORY_SPEC_FILTERS: Record<string, SpecFilterDefinition[]> = {
  smartphone: [
    {
      key: 'ram_gb', label_ar: 'الذاكرة العشوائية', label_en: 'RAM', type: 'checkbox',
      options: [
        { value: '4', label_ar: '4 جيجابايت', label_en: '4 GB' },
        { value: '6', label_ar: '6 جيجابايت', label_en: '6 GB' },
        { value: '8', label_ar: '8 جيجابايت', label_en: '8 GB' },
        { value: '12', label_ar: '12 جيجابايت', label_en: '12 GB' },
        { value: '16', label_ar: '16 جيجابايت', label_en: '16 GB' },
      ],
    },
    {
      key: 'storage_gb', label_ar: 'سعة التخزين', label_en: 'Storage', type: 'checkbox',
      options: [
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
        { value: '128', label_ar: '128 جيجابايت', label_en: '128 GB' },
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
        { value: '1024', label_ar: '1 تيرابايت', label_en: '1 TB' },
      ],
    },
  ],
  laptop: [
    {
      key: 'ram_gb', label_ar: 'الذاكرة العشوائية', label_en: 'RAM', type: 'checkbox',
      options: [
        { value: '8', label_ar: '8 جيجابايت', label_en: '8 GB' },
        { value: '16', label_ar: '16 جيجابايت', label_en: '16 GB' },
        { value: '32', label_ar: '32 جيجابايت', label_en: '32 GB' },
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
      ],
    },
    {
      key: 'storage_gb', label_ar: 'سعة التخزين', label_en: 'Storage', type: 'checkbox',
      options: [
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
        { value: '1024', label_ar: '1 تيرابايت', label_en: '1 TB' },
        { value: '2048', label_ar: '2 تيرابايت', label_en: '2 TB' },
      ],
    },
    {
      key: 'screen_size', label_ar: 'حجم الشاشة', label_en: 'Screen Size', type: 'checkbox',
      options: [
        { value: '13', label_ar: '13 بوصة', label_en: '13"' },
        { value: '14', label_ar: '14 بوصة', label_en: '14"' },
        { value: '15', label_ar: '15 بوصة', label_en: '15"' },
        { value: '16', label_ar: '16 بوصة', label_en: '16"' },
        { value: '17', label_ar: '17 بوصة', label_en: '17"' },
      ],
    },
  ],
  tv: [
    {
      key: 'screen_size', label_ar: 'حجم الشاشة', label_en: 'Screen Size', type: 'checkbox',
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
      key: 'resolution', label_ar: 'الدقة', label_en: 'Resolution', type: 'checkbox',
      options: [
        { value: 'fhd', label_ar: 'Full HD', label_en: 'Full HD (1080p)' },
        { value: '4k', label_ar: '4K', label_en: '4K UHD' },
        { value: '8k', label_ar: '8K', label_en: '8K' },
      ],
    },
    {
      key: 'panel_type', label_ar: 'نوع الشاشة', label_en: 'Panel Type', type: 'checkbox',
      options: [
        { value: 'led', label_ar: 'LED', label_en: 'LED' },
        { value: 'qled', label_ar: 'QLED', label_en: 'QLED' },
        { value: 'oled', label_ar: 'OLED', label_en: 'OLED' },
      ],
    },
  ],
  tablet: [
    {
      key: 'storage_gb', label_ar: 'سعة التخزين', label_en: 'Storage', type: 'checkbox',
      options: [
        { value: '64', label_ar: '64 جيجابايت', label_en: '64 GB' },
        { value: '128', label_ar: '128 جيجابايت', label_en: '128 GB' },
        { value: '256', label_ar: '256 جيجابايت', label_en: '256 GB' },
        { value: '512', label_ar: '512 جيجابايت', label_en: '512 GB' },
      ],
    },
  ],
  audio: [
    {
      key: 'audio_type', label_ar: 'النوع', label_en: 'Type', type: 'checkbox',
      options: [
        { value: 'over-ear', label_ar: 'فوق الأذن', label_en: 'Over-Ear' },
        { value: 'in-ear', label_ar: 'داخل الأذن', label_en: 'In-Ear' },
        { value: 'speaker', label_ar: 'سماعة خارجية', label_en: 'Speaker' },
      ],
    },
    {
      key: 'wireless', label_ar: 'الاتصال', label_en: 'Connectivity', type: 'checkbox',
      options: [
        { value: 'wireless', label_ar: 'لاسلكي', label_en: 'Wireless' },
        { value: 'wired', label_ar: 'سلكي', label_en: 'Wired' },
      ],
    },
  ],
  gaming: [
    {
      key: 'platform', label_ar: 'المنصة', label_en: 'Platform', type: 'checkbox',
      options: [
        { value: 'ps5', label_ar: 'بلايستيشن 5', label_en: 'PlayStation 5' },
        { value: 'xbox', label_ar: 'اكس بوكس', label_en: 'Xbox' },
        { value: 'pc', label_ar: 'كمبيوتر', label_en: 'PC' },
        { value: 'switch', label_ar: 'نينتندو سويتش', label_en: 'Nintendo Switch' },
      ],
    },
  ],
};

/**
 * Extract specs from a product title string.
 * Returns key-value pairs matching spec filter keys.
 */
export function extractSpecsFromTitle(title: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const t = title.toLowerCase();

  // RAM & Storage disambiguation
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

  const explicitRamMatch = t.match(/(\d+)\s*gb\s*(?:ram|memory|ذاكرة)/i) ||
                           t.match(/(?:ram|memory|ذاكرة)\s*[:.]?\s*(\d+)\s*gb/i);
  if (explicitRamMatch) {
    specs.ram_gb = (explicitRamMatch[1] || explicitRamMatch[2]);
  }

  const explicitStorageMatch = t.match(/(\d+)\s*gb\s*(?:storage|ssd|hdd|rom|internal|تخزين)/i) ||
                               t.match(/(?:storage|ssd|hdd|rom|internal|تخزين)\s*[:.]?\s*(\d+)\s*gb/i);
  if (explicitStorageMatch) {
    specs.storage_gb = (explicitStorageMatch[1] || explicitStorageMatch[2]);
  }

  if (!specs.storage_gb && allTB.length > 0) {
    specs.storage_gb = String(allTB[0].value);
  }

  if (!specs.ram_gb && !specs.storage_gb) {
    if (allGB.length === 1) {
      if (allGB[0].value >= 32) specs.storage_gb = String(allGB[0].value);
    } else if (allGB.length >= 2) {
      const sorted = [...allGB].sort((a, b) => a.value - b.value);
      specs.ram_gb = String(sorted[0].value);
      specs.storage_gb = String(sorted[sorted.length - 1].value);
    }
  }

  if (specs.ram_gb && !specs.storage_gb) {
    const ramVal = parseInt(specs.ram_gb);
    const remaining = allGB.filter(g => g.value !== ramVal && g.value >= 32);
    if (remaining.length > 0) specs.storage_gb = String(Math.max(...remaining.map(g => g.value)));
    if (!specs.storage_gb && allTB.length > 0) specs.storage_gb = String(allTB[0].value);
  }

  if (specs.storage_gb && !specs.ram_gb) {
    const storageVal = parseInt(specs.storage_gb);
    const remaining = allGB.filter(g => g.value < storageVal && g.value < 32);
    if (remaining.length > 0) specs.ram_gb = String(Math.max(...remaining.map(g => g.value)));
  }

  // Screen size
  const screenMatch = t.match(/(\d+(?:\.\d+)?)\s*[-"]?\s*(?:inch|"|بوصة|in\b)/i) ||
                      t.match(/(\d+(?:\.\d+)?)\s*-\s*inch/i);
  if (screenMatch) specs.screen_size = String(Math.round(parseFloat(screenMatch[1])));

  // Resolution
  if (/\b8k\b/i.test(t)) specs.resolution = '8k';
  else if (/\b4k\b/i.test(t) || /\buhd\b/i.test(t)) specs.resolution = '4k';
  else if (/\b1080p\b/i.test(t) || /\bfull\s*hd\b/i.test(t) || /\bfhd\b/i.test(t)) specs.resolution = 'fhd';

  // Panel type
  if (/\boled\b/i.test(t) && !/\bqled\b/i.test(t)) specs.panel_type = 'oled';
  else if (/\bqled\b/i.test(t)) specs.panel_type = 'qled';
  else if (/\bled\b/i.test(t)) specs.panel_type = 'led';

  // Audio
  if (t.includes('over-ear') || t.includes('over ear')) specs.audio_type = 'over-ear';
  else if (t.includes('in-ear') || t.includes('in ear') || t.includes('earbud') || t.includes('airpod')) specs.audio_type = 'in-ear';
  else if (t.includes('speaker') || t.includes('soundbar')) specs.audio_type = 'speaker';

  if (t.includes('wireless') || t.includes('bluetooth')) specs.wireless = 'wireless';
  else if (t.includes('wired')) specs.wireless = 'wired';

  // Gaming
  if (t.includes('ps5') || t.includes('playstation 5')) specs.platform = 'ps5';
  else if (t.includes('xbox')) specs.platform = 'xbox';
  else if (t.includes('switch') || t.includes('nintendo')) specs.platform = 'switch';

  // Condition
  if (/\b(?:renewed|refurbished|مجدد)\b/i.test(t)) specs.condition = 'renewed';
  else if (/\b(?:used|مستعمل)\b/i.test(t)) specs.condition = 'used';

  return specs;
}
