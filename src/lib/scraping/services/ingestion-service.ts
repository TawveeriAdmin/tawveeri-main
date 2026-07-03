// src/lib/scraping/services/ingestion-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// بوابة الإدخال الموحدة — Unified Ingestion Contract
// وظيفة واحدة: أي منتج من أي scraper → صف خام في raw_observations.
// لا تفسير، لا مطابقة، لا تصنيف — الخام يُحفظ كما وصل (فلسفة TPS).
// إضافة متجر جديد مستقبلاً = استدعاء ingest() — لا شيء آخر.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/database';
import type { ScrapedProduct } from '../base/types';

// أسماء المتاجر الموحدة (عربي — نفس نمط raw_observations الحالي)
const STORE_SLUG_TO_NAME: Record<string, string> = {
  jarir: 'جرير',
  amazon: 'أمازون',
  noon: 'نون',
  extra: 'اكسترا',
  almanea: 'المنيع',
  shaker: 'شاكر',
  'samsung-ksa': 'سامسونج',
  swsg: 'الشتاء والصيف',
};

export class IngestionService {
  private supabase = createServerClient();

  /** يحفظ دفعة منتجات خام لمتجر واحد. يرجع عدد الصفوف المحفوظة. */
  async ingestBatch(storeSlug: string, products: ScrapedProduct[]): Promise<number> {
    if (!products.length) return 0;
    const storeName = STORE_SLUG_TO_NAME[storeSlug] ?? storeSlug;
    const now = new Date().toISOString();

    const rows = products.map((p) => ({
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