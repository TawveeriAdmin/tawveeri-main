// src/lib/scraping/services/ingestion-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// بوابة الإدخال الموحدة — Unified Ingestion Contract
// وظيفة واحدة: أي منتج من أي scraper → صف خام في raw_observations.
// لا تفسير، لا مطابقة، لا تصنيف — الخام يُحفظ كما وصل (فلسفة TPS).
// إضافة متجر جديد مستقبلاً = استدعاء ingest() — لا شيء آخر.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/database';
import { resolveStoreId } from '../store-identity';
import type { ScrapedProduct } from '../base/types';

export class IngestionService {
  private supabase = createServerClient();

  /** يحفظ دفعة منتجات خام لمتجر واحد. يرجع عدد الصفوف المحفوظة. */
  async ingestBatch(storeSlug: string, products: ScrapedProduct[]): Promise<number> {
    if (!products.length) return 0;

    // Canonical identity. store_name is written as the slug purely as
    // provenance — identity is store_id and nothing resolves from the label.
    // This replaces a hardcoded slug→Arabic-name map that disagreed with the
    // stores registry (it used 'samsung-ksa' where the registry has
    // 'samsung_ksa', so those rows could never be joined).
    const storeId = await resolveStoreId(storeSlug);
    if (storeId === null) {
      console.error(`[IngestionService] unknown store slug '${storeSlug}' — not in stores registry; refusing to ingest unidentifiable observations`);
      return 0;
    }
    const storeName = storeSlug;
    const now = new Date().toISOString();

    const rows = products.map((p) => ({
      store_id: storeId,
      store_name: storeName,
      raw_name: p.name_ar || p.name_en || '',
      payload: {
        ...p,                          // الخام كاملاً كما وصل — بما فيه sku/mpn إن وُجدا
        _ingested_via: 'ingestion-service-v1',
        _store_slug: storeSlug,
      },
      scraped_at: now,
    }));

    // دفعات 200 — نتجنب حدود حجم الطلب
    let saved = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error, count } = await this.supabase
        .from('raw_observations')
        .insert(chunk, { count: 'exact' });
      if (error) {
        console.error(`[IngestionService] ${storeName} chunk failed:`, error.message);
        continue; // دفعة فاشلة لا توقف البقية
      }
      saved += count ?? chunk.length;
    }

    console.log(`[IngestionService] ${storeName}: saved ${saved}/${rows.length} raw observations`);
    return saved;
  }
}