import type { StoreSearchResult } from './types';
import { SamsungKsaSearchScraper } from './samsung-ksa-search-scraper';
import { ShakerSearchScraper } from './shaker-search-scraper';
import { ZagzoogSearchScraper } from './zagzoog-search-scraper';
import { AlesayiSearchScraper } from './alesayi-search-scraper';
import { SwsgSearchScraper } from './swsg-search-scraper';
import { AlkhunaizanSearchScraper } from './alkhunaizan-search-scraper';
import { BukhamsenSearchScraper } from './bukhamsen-search-scraper';
import { AlghanimSearchScraper } from './alghanim-search-scraper';
import { AlsaifGallerySearchScraper } from './alsaif-gallery-search-scraper';
import { LuluGccSearchScraper } from './lulu-gcc-search-scraper';
import { NajmStoreSearchScraper } from './najm-store-search-scraper';
import { AliexpressArSearchScraper } from './aliexpress-ar-search-scraper';

type SearchScraper = { search: (opts: { query: string; pages: number }) => Promise<StoreSearchResult> };

/**
 * Extended merchants — each has a dedicated {@link BaseSearchScraper} implementation
 * (same architecture as Amazon / Noon / Jarir / Extra / Almanea).
 */
export const EXTENDED_SEARCH_SCRAPERS: Record<string, () => SearchScraper> = {
  samsung_ksa: () => new SamsungKsaSearchScraper(),
  shaker: () => new ShakerSearchScraper(),
  zagzoog: () => new ZagzoogSearchScraper(),
  alesayi: () => new AlesayiSearchScraper(),
  swsg: () => new SwsgSearchScraper(),
  alkhunaizan: () => new AlkhunaizanSearchScraper(),
  bukhamsen: () => new BukhamsenSearchScraper(),
  alghanim: () => new AlghanimSearchScraper(),
  alsaif_gallery: () => new AlsaifGallerySearchScraper(),
  lulu_gcc: () => new LuluGccSearchScraper(),
  najm_store: () => new NajmStoreSearchScraper(),
  aliexpress_ar: () => new AliexpressArSearchScraper(),
};
