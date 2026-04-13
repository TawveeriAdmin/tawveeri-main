export type FirecrawlSiteStatus =
  | 'success'
  | 'partial'
  | 'empty'
  | 'rate_limited'
  | 'credits_exhausted'
  | 'failed'
  | 'skipped';

export interface FirecrawlDemoProduct {
  title: string;
  priceText: string;
  productUrl: string;
  imageUrl?: string;
  category?: string;
}

/** v2 /scrape may return LLM JSON under data.json */
export interface FirecrawlScrapeResult {
  ok: boolean;
  status: FirecrawlSiteStatus;
  markdown: string;
  links: string[];
  extractedJson: Record<string, unknown> | null;
  error?: string;
}
