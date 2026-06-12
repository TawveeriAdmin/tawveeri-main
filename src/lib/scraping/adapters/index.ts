/**
 * سجل المحوّلات — المصدر الوحيد للحقيقة عن متاجر خط البيانات.
 * إضافة متجر جديد = ملف محوّل + سطر واحد هنا.
 */
import type { StoreAdapter } from './types';
import { almaneaAdapter } from './almanea';
import { extraAdapter } from './extra';

export const STORE_ADAPTERS: StoreAdapter[] = [
  almaneaAdapter,
  extraAdapter,
  // قريباً: jarirAdapter, amazonAdapter, noonAdapter...
];

export function getAdapterBySlug(slug: string): StoreAdapter | undefined {
  return STORE_ADAPTERS.find(a => a.slug === slug && a.enabled);
}

export function getEnabledAdapters(): StoreAdapter[] {
  return STORE_ADAPTERS.filter(a => a.enabled);
}

export type { StoreAdapter, NormalizedOffer, FetchResult } from './types';
