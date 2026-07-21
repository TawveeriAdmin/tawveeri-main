// src/lib/scraping/services/ingestion-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// بوابة الإدخال الموحدة — Unified Ingestion Contract
// وظيفة واحدة: أي منتج من أي scraper → صف خام في raw_observations.
// لا تفسير، لا مطابقة، لا تصنيف — الخام يُحفظ كما وصل (فلسفة TPS).
// إضافة متجر جديد مستقبلاً = استدعاء ingest() — لا شيء آخر.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/database';
import type { ScrapedProduct } from '../base/types';

export class IngestionService {
  private supabase = createServerClient();

  /**
   * يحفظ دفعة منتجات خام لمتجر واحد. يرجع عدد الصفوف المحفوظة.
   *
   * store_id and scrapingRunId are resolved by the caller (the orchestrator,
   * which already resolves the canonical store id and owns the active
   * scraping_runs.id) and passed in explicitly. Identity is NOT re-resolved
   * here — a single authoritative value flows down the ingestion chain, and
   * both ids are written at insert time. store_name is written as the slug for
   * provenance only; nothing resolves from the label.
   */
  async ingestBatch(
    storeSlug: string,
    products: ScrapedProduct[],
    storeId: number,
    scrapingRunId: number | null
  ): Promise<number> {
    if (!products.length) return 0;

    const storeName = storeSlug;
    const now = new Date().toISOString();

    const rows = products.map((p) => ({
      store_id: storeId,
      store_name: storeName,
      scraping_run_id: scrapingRunId,
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