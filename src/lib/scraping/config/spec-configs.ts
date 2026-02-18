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

/**
 * Extract specs from a product title string.
 * Returns key-value pairs matching spec filter keys.
 */
export function extractSpecsFromTitle(title: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const t = title.toLowerCase();

  // RAM: "8GB", "12 GB", "8gb ram"
  const ramMatch = t.match(/(\d+)\s*gb\s*(?:ram|memory|ذاكرة)?/i) ||
                   t.match(/(?:ram|memory|ذاكرة)\s*[:.]?\s*(\d+)\s*gb/i);
  if (ramMatch) {
    specs.ram_gb = ramMatch[1];
  }

  // Storage: "256GB", "512 GB", "1TB", "2 TB"
  // Must distinguish from RAM - look for storage indicators or second GB match
  const storagePatterns = [
    /(\d+)\s*tb\b/i,
    /(?:storage|ssd|hdd|rom|internal|تخزين)\s*[:.]?\s*(\d+)\s*gb/i,
    /(\d+)\s*gb\s*(?:storage|ssd|hdd|rom|internal|تخزين)/i,
  ];

  for (const pat of storagePatterns) {
    const m = t.match(pat);
    if (m) {
      const val = m[1] || m[2];
      if (pat.source.includes('tb')) {
        specs.storage_gb = String(parseInt(val) * 1024);
      } else {
        specs.storage_gb = val;
      }
      break;
    }
  }

  // If no explicit storage found, check for second GB value (common in phone titles like "12GB 256GB")
  if (!specs.storage_gb) {
    const allGB = [...t.matchAll(/(\d+)\s*gb/gi)];
    if (allGB.length >= 2 && specs.ram_gb) {
      const secondVal = allGB[1][1];
      if (parseInt(secondVal) > parseInt(specs.ram_gb)) {
        specs.storage_gb = secondVal;
      }
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

  return specs;
}
