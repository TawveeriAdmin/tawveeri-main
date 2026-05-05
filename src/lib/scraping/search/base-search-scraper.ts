import * as cheerio from 'cheerio';
import type { ProductCategory } from '@/lib/database/types';
import type { StoreSearchOptions, StoreSearchResult } from './types';
import { getBrowserHeaders } from './user-agents';
import { determineCategory as determineCategoryFromTitle } from '../utils/category-utils';

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
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return response.text();
  }

  protected async fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      headers: headers || getBrowserHeaders(),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
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
    return determineCategoryFromTitle(title);
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

export function formatScrapeError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name && err.name !== 'Error' ? `${err.name}: ` : '';
    const msg = err.message || err.toString();
    return `${name}${msg}`;
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; name?: unknown; toString?: () => string };
    if (typeof e.message === 'string' && e.message.length > 0) {
      const n = typeof e.name === 'string' ? `${e.name}: ` : '';
      return `${n}${e.message}`;
    }
    try {
      const str = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
      if (str && str !== '{}') return str;
    } catch {}
    try {
      const s = String(err);
      if (s && s !== '[object Object]') return s;
    } catch {}
    return Object.prototype.toString.call(err);
  }
  return String(err);
}
