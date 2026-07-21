/**
 * سجل المحوّلات — المصدر الوحيد للحقيقة عن متاجر خط البيانات.
 * إضافة متجر جديد = ملف محوّل + سطر واحد هنا.
 */
import type { StoreAdapter } from './types';
import { almaneaAdapter } from './almanea';
import { extraAdapter } from './extra';
import {
  jarirAdapter, amazonAdapter,
  noonAdapter, samsungKsaAdapter, shakerAdapter, swsgAdapter,
} from './scraper-wrapped';

// All 8 stores registered on the adapter contract (E12). enabled=false ones are
// registered for completeness but await a validated ingestion run before use.
export const STORE_ADAPTERS: StoreAdapter[] = [
  almaneaAdapter,   // enabled — bespoke Algolia adapter
  extraAdapter,     // enabled — bespoke UNBXD adapter
  jarirAdapter,     // enabled — wraps JarirSearchScraper (~50k obs)
  amazonAdapter,    // enabled — wraps AmazonSearchScraper (~2k obs)
  noonAdapter,      // disabled — no pipeline data yet
  samsungKsaAdapter,// disabled — no pipeline data yet
  shakerAdapter,    // disabled — no pipeline data yet
  swsgAdapter,      // disabled — no pipeline data yet
];

export function getAdapterBySlug(slug: string): StoreAdapter | undefined {
  return STORE_ADAPTERS.find(a => a.slug === slug && a.enabled);
}

export function getEnabledAdapters(): StoreAdapter[] {
  return STORE_ADAPTERS.filter(a => a.enabled);
}

export type { StoreAdapter, NormalizedOffer, FetchResult } from './types';
