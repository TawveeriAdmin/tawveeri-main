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
