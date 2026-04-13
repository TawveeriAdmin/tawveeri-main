import { GenericHtmlSearchScraper } from './generic-html-search-scraper';
import { EXTENDED_MERCHANT_SITE_CONFIGS } from './extended-merchants-config';

/** Factories for the ten merchants previously covered by Firecrawl */
export const EXTENDED_SEARCH_SCRAPERS: Record<string, () => GenericHtmlSearchScraper> =
  Object.fromEntries(
    EXTENDED_MERCHANT_SITE_CONFIGS.map((cfg) => [
      cfg.slug,
      () => new GenericHtmlSearchScraper(cfg),
    ]),
  ) as Record<string, () => GenericHtmlSearchScraper>;
