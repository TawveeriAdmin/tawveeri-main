import type { GenericHtmlSiteConfig } from './generic-html-search-scraper';

/** Very short / junk queries break some merchant CDNs (404/empty). */
function safeSearchToken(raw: string): string {
  const q = raw.trim();
  if (q.length < 2 || q === '.' || q === '..') return 'phone';
  return q;
}

const qenc = (q: string) => encodeURIComponent(safeSearchToken(q));

/** Search URL patterns per merchant (trial order until HTML/JSON yields products). */
export const EXTENDED_MERCHANT_SITE_CONFIGS: GenericHtmlSiteConfig[] = [
  {
    slug: 'samsung_ksa',
    displayName: 'Samsung KSA',
    baseUrl: 'https://www.samsung.com',
    searchUrlBuilders: [
      (q, p) =>
        `https://www.samsung.com/sa_en/aisearch/?searchvalue=${qenc(q)}${p > 1 ? `&page=${p}` : ''}`,
    ],
  },
  {
    slug: 'shaker',
    displayName: 'Shaker',
    baseUrl: 'https://shakersa.com',
    searchUrlBuilders: [
      (q, p) => `https://shakersa.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'zagzoog',
    displayName: 'Zagzoog',
    baseUrl: 'https://zagzoog.com',
    searchUrlBuilders: [
      (q, p) => `https://zagzoog.com/arabic/products?s=${qenc(q)}${p > 1 ? `&page=${p}` : ''}`,
      (q, p) => `https://zagzoog.com/arabic/products?s=all&search=${qenc(q)}${p > 1 ? `&p=${p}` : ''}`,
    ],
  },
  {
    slug: 'alesayi',
    displayName: 'Alesayi Electronics',
    baseUrl: 'https://aecksa.com',
    searchUrlBuilders: [
      (q, p) => `https://aecksa.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'swsg',
    displayName: 'SWSG',
    baseUrl: 'https://swsg.co',
    searchUrlBuilders: [
      (q, p) => `https://swsg.co/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      (q, p) => `https://swsg.co/ar/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'alkhunaizan',
    displayName: 'Alkhunaizan',
    baseUrl: 'https://www.alkhunaizan.sa',
    searchUrlBuilders: [
      (q, p) => `https://www.alkhunaizan.sa/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'bukhamsen',
    displayName: 'Bukhamsen',
    baseUrl: 'https://bukhamsen.com',
    searchUrlBuilders: [
      (q, p) => `https://bukhamsen.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'alghanim',
    displayName: 'Alghanim',
    baseUrl: 'https://alghanim-store.com',
    searchUrlBuilders: [
      (q, p) => `https://alghanim-store.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
    ],
  },
  {
    slug: 'alsaif_gallery',
    displayName: 'Alsaif Gallery',
    baseUrl: 'https://alsaifgallery.com',
    searchUrlBuilders: [
      (q, p) =>
        `https://alsaifgallery.com/SA_en/search?keyword=${qenc(q)}${p > 1 ? `&page=${p}` : ''}`,
      (q, p) =>
        `https://alsaifgallery.com/SA_ar/search?keyword=${qenc(q)}${p > 1 ? `&page=${p}` : ''}`,
    ],
  },
  {
    slug: 'lulu_gcc',
    displayName: 'Lulu Hypermarket',
    baseUrl: 'https://gcc.luluhypermarket.com',
    requiresBrowser: true,
    searchUrlBuilders: [
      (q, p) =>
        `https://gcc.luluhypermarket.com/ar-sa/search/?text=${qenc(q)}${p > 1 ? `&page=${p - 1}` : ''}`,
      (q, p) =>
        `https://gcc.luluhypermarket.com/en-sa/search/?text=${qenc(q)}${p > 1 ? `&page=${p - 1}` : ''}`,
    ],
  },
];
