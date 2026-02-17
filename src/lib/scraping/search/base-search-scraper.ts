import * as cheerio from 'cheerio';
import type { ProductCategory } from '@/lib/database/types';
import type { StoreSearchOptions, StoreSearchResult } from './types';
import { getBrowserHeaders } from './user-agents';

export abstract class BaseSearchScraper {
  protected storeName: string;
  protected storeSlug: string;

  constructor(storeSlug: string, storeName: string) {
    this.storeSlug = storeSlug;
    this.storeName = storeName;
  }

  abstract search(options: StoreSearchOptions): Promise<StoreSearchResult>;

  protected async fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
    const response = await fetch(url, {
      headers: headers || getBrowserHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return response.text();
  }

  protected async fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      headers: headers || getBrowserHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return response.json() as Promise<T>;
  }

  protected getCheerio(html: string) {
    return cheerio.load(html);
  }

  protected delay(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected extractModel(title: string, brand: string | null): string {
    let model = title;
    if (brand) {
      model = model.replace(new RegExp(brand, 'gi'), '').trim();
    }

    const modelPatterns = [
      /\b(iPhone|iPad|MacBook|Galaxy|Xiaomi|Huawei)\s+([A-Z0-9\s]+)/i,
      /\b([A-Z]{2,}\d+[A-Z]*)/,
      /\b(\d{2,}[A-Z]*)/,
    ];

    for (const pattern of modelPatterns) {
      const match = model.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    const words = model.split(' ').slice(0, 3).join(' ');
    return words || title;
  }

  protected determineCategory(title: string): ProductCategory {
    const t = title.toLowerCase();

    if (t.includes('laptop') || t.includes('notebook') || t.includes('macbook')) return 'laptop';
    if (t.includes('smartphone') || t.includes('iphone') || t.includes('phone') || t.includes('galaxy')) return 'smartphone';
    if (t.includes('tablet') || t.includes('ipad')) return 'tablet';
    if (t.includes('tv') || t.includes('television')) return 'tv';
    if (t.includes('headphone') || t.includes('earphone') || t.includes('airpod') || t.includes('speaker')) return 'audio';
    if (t.includes('camera')) return 'camera';
    if (t.includes('gaming') || t.includes('playstation') || t.includes('xbox') || t.includes('nintendo')) return 'gaming';
    if (t.includes('watch') || t.includes('smartwatch')) return 'accessories';

    return 'accessories';
  }

  protected parsePrice(priceStr: string | null | undefined): number | null {
    if (!priceStr) return null;
    const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(',', '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  protected emptyResult(): StoreSearchResult {
    return {
      products: [],
      store: this.storeSlug,
      storeName: this.storeName,
      count: 0,
    };
  }

  protected errorResult(error: string): StoreSearchResult {
    return {
      ...this.emptyResult(),
      error,
    };
  }
}
