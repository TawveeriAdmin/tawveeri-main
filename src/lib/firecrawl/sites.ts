export interface FirecrawlSiteConfig {
  slug: string;
  nameEn: string;
  nameAr: string;
  /** Fallback listing/home URL when `buildSearchUrl` is null or returns null. */
  url: string;
  /**
   * Search or filtered listing URL for the user query. Return null to use `url`.
   * Patterns should be verified in-browser for each merchant.
   */
  buildSearchUrl?: (query: string) => string | null;
}

export const FIRECRAWL_DEMO_SITES: FirecrawlSiteConfig[] = [
  {
    slug: 'samsung_ksa',
    nameEn: 'Samsung KSA',
    nameAr: 'سامسونج السعودية',
    url: 'https://www.samsung.com/sa_en/',
    buildSearchUrl: (q) =>
      q.trim()
        ? `https://www.samsung.com/sa_en/search/search/?keyword=${encodeURIComponent(q.trim())}`
        : null,
  },
  {
    slug: 'shaker',
    nameEn: 'Shaker',
    nameAr: 'شاكر',
    url: 'https://shakersa.com/%d8%aa%d8%b3%d9%88%d9%82/',
    buildSearchUrl: (q) =>
      q.trim() ? `https://shakersa.com/?s=${encodeURIComponent(q.trim())}` : null,
  },
  {
    slug: 'zagzoog',
    nameEn: 'Zagzoog',
    nameAr: 'الزقزوق',
    url: 'https://zagzoog.com/arabic/products?s=all',
  },
  {
    slug: 'alesayi',
    nameEn: 'Alesayi Electronics',
    nameAr: 'العيسائي للإلكترونيات',
    url: 'https://aecksa.com/',
    buildSearchUrl: (q) =>
      q.trim() ? `https://aecksa.com/?s=${encodeURIComponent(q.trim())}` : null,
  },
  {
    slug: 'swsg',
    nameEn: 'SWSG',
    nameAr: 'سواسق',
    url: 'https://swsg.co/ar/offers/swsg-online.html',
  },
  {
    slug: 'alkhunaizan',
    nameEn: 'Alkhunaizan',
    nameAr: 'الخنيزان',
    url: 'https://www.alkhunaizan.sa/',
    buildSearchUrl: (q) =>
      q.trim() ? `https://www.alkhunaizan.sa/?s=${encodeURIComponent(q.trim())}` : null,
  },
  {
    slug: 'bukhamsen',
    nameEn: 'Bukhamsen',
    nameAr: 'بخمسين',
    url: 'https://bukhamsen.com/',
    buildSearchUrl: (q) =>
      q.trim() ? `https://bukhamsen.com/?s=${encodeURIComponent(q.trim())}` : null,
  },
  {
    slug: 'alghanim',
    nameEn: 'Alghanim',
    nameAr: 'الغانم',
    url: 'https://alghanim-store.com/product-tag/%d8%a7%d9%84%d8%ba%d8%a7%d9%86%d9%85-%d8%a7%d9%84%d8%b3%d8%b1%d9%8a%d8%b9/',
  },
  {
    slug: 'alsaif_gallery',
    nameEn: 'Alsaif Gallery',
    nameAr: 'السيف غاليري',
    url: 'https://alsaifgallery.com/SA_ar/c-1178/large-appliances-1/refrigerators-freezers-1.html',
  },
  {
    slug: 'lulu_gcc',
    nameEn: 'Lulu Hypermarket',
    nameAr: 'لولو هايبرماركت',
    url: 'https://gcc.luluhypermarket.com/ar-sa/electronics/',
    buildSearchUrl: (q) =>
      q.trim()
        ? `https://gcc.luluhypermarket.com/ar-sa/search/?text=${encodeURIComponent(q.trim())}`
        : null,
  },
];
