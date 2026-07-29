'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, TrendingDown, CircleAlert, Store, Loader2 } from 'lucide-react';
import { Price } from '@/components/ui/price';

interface RealDeal { store_name: string; name: string; brand: string | null; url: string; current_price: number; observed_max: number; real_saving_pct: number; distinct_days: number; }
interface DiscountData { summary?: { checkable_listings: number; by_verdict: Record<string, number>; inflated_reference_share_pct: number | null }; real_deals?: RealDeal[]; }
interface StoreTrust { store_id: number; store_name: string; discount_behavior: string; unobserved_reference_pct: number | null; price_competitiveness_pct: number | null; distinct_products: number; evidence: { sample_size: number; observation_window_days: number | null; confidence: string }; headline: { ar: string; en: string }; }

const T = (ar: string, en: string, loc: string) => (loc === 'ar' ? ar : en);

export function PriceTruthClient({ locale }: { locale: string }) {
  const loc = locale === 'ar' ? 'ar' : 'en';
  const isRTL = loc === 'ar';
  const [d, setD] = useState<DiscountData | null>(null);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [stores, setStores] = useState<StoreTrust[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [di, mc, mt] = await Promise.all([
          fetch('/api/v1/tps/discount-integrity').then((r) => r.json()).catch(() => ({})),
          fetch('/api/v1/tps/model-corroboration').then((r) => r.json()).catch(() => ({})),
          fetch('/api/v1/intelligence/merchant-trust').then((r) => r.json()).catch(() => ({})),
        ]);
        if (!alive) return;
        // Devices only. `total` includes accessories, and 88 of 166 corroborations were
        // accessories — a majority-accessory number under a label that says "products"
        // does not belong on the trust surface (§11).
        setD(di); setModelCount(typeof mc?.products_total === 'number' ? mc.products_total : null);
        setStores(Array.isArray(mt?.stores) ? mt.stores : []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const inflated = d?.summary?.inflated_reference_share_pct ?? null;
  const checkable = d?.summary?.checkable_listings ?? null;
  const verified = d?.summary?.by_verdict?.verified_drop ?? null;
  // §11 — accessories are excluded from trust surfaces ENTIRELY, not merely ranked last.
  // Percentage ranking is what put a 19 SAR phone case above an 8,800 SAR television on
  // this very page. A saving under 50 SAR is float noise, not a decision.
  const deals = ((d?.real_deals ?? []) as Array<Record<string, unknown>>).filter((dl) => {
    const cat = String(dl?.category ?? '').toLowerCase();
    if (cat.includes('accessor')) return false;
    const saving = (Number(dl?.observed_max) || 0) - (Number(dl?.current_price) || 0);
    return saving >= 50;
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-on-primary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />{T('بالدليل، لا بالوعود', 'By evidence, not promises', loc)}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">{T('حقيقة الأسعار', 'Price Truth', loc)}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-on-surface-variant sm:text-base">
          {T('نتتبّع الأسعار الحقيقية عبر الوقت، ونتحقّق من الخصومات المعلنة مقابل ما رصدناه فعلاً — ونؤكّد أن المنتج نفسه معروض في أكثر من متجر برقم الموديل.',
             "We track real prices over time and check advertised discounts against what we actually observed — and confirm the same product across stores by its model number.", loc)}
        </p>
      </header>

      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{T('نحسب من بيانات الرصد…', 'Computing from tracked data…', loc)}</div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-900/50 dark:bg-warning-950/30">
              <div className="text-3xl font-bold text-warning-700 dark:text-warning-400 tabular-nums">{inflated != null ? `${inflated}%` : '—'}</div>
              <div className="mt-1 text-xs text-on-surface-variant">{T('من الخصومات المعلنة تشير إلى سعر لم نرصده يومًا', 'of advertised discounts reference a price we never observed', loc)}</div>
            </div>
            <div className="rounded-2xl border border-success-200 bg-success-50 p-4 dark:border-success-900/50 dark:bg-success-950/30">
              <div className="text-3xl font-bold text-success-700 dark:text-success-300 tabular-nums">{verified ?? '—'}</div>
              <div className="mt-1 text-xs text-on-surface-variant">{T('انخفاضات سعر حقيقية أكّدناها بالتتبّع', 'genuine price drops we verified by tracking', loc)}</div>
            </div>
            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
              <div className="text-3xl font-bold text-primary-700 dark:text-primary-300 tabular-nums">{modelCount ?? '—'}</div>
              <div className="mt-1 text-xs text-on-surface-variant">{T('منتجات مؤكَّدة عبر متاجر متعددة برقم الموديل', 'products verified across stores by model number', loc)}</div>
            </div>
          </div>
          {checkable != null && (
            <p className="mt-2 text-center text-xs text-on-surface-variant">{T(`من إجمالي ${checkable} عرض خصم قابل للفحص`, `across ${checkable} checkable advertised discounts`, loc)}</p>
          )}

          {/* Verified real deals */}
          <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">{T('عروض حقيقية موثّقة', 'Verified real deals', loc)}</h2>
          {deals.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{T('نبني سجل الأسعار — تظهر العروض المؤكَّدة كلما تعمّق التتبّع.', 'Building price history — verified deals appear as tracking deepens.', loc)}</p>
          ) : (
            <div className="space-y-3">
              {deals.map((dl, i) => (
                <a key={i} href={dl.url} target="_blank" rel="noopener noreferrer"
                  className="group block rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-on-surface line-clamp-2">{dl.name}</h3>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-on-surface-variant"><Store className="h-3.5 w-3.5" aria-hidden />{dl.store_name}
                        <span className="opacity-70">· {T(`تتبّعنا ${dl.distinct_days} يوم`, `tracked ${dl.distinct_days}d`, loc)}</span></p>
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-900/40 dark:text-success-300">
                        <TrendingDown className="h-3 w-3" aria-hidden />{T(`توفير حقيقي ${dl.real_saving_pct}٪ — كان ${Number(dl.observed_max.toFixed(2))}`, `real saving ${dl.real_saving_pct}% — was ${Number(dl.observed_max.toFixed(2))}`, loc)}</p>
                      {/* Evidence line — the product thesis made visible (data already fetched; text render only). */}
                      <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">
                        {T(`تتبّعنا هذا المنتج ${dl.distinct_days} يومًا · أعلى سعر رصدناه ${Number(dl.observed_max.toFixed(2))}`,
                           `We tracked this product for ${dl.distinct_days} days · highest price we observed ${Number(dl.observed_max.toFixed(2))}`, loc)}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <Price amount={dl.current_price} className="text-lg font-bold text-primary-700 dark:text-primary-300" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Store trust — discount honesty + real price value */}
          {stores.filter((s) => s.discount_behavior !== 'insufficient_data' || s.price_competitiveness_pct != null).length > 0 && (
            <>
              <h2 className="mb-1 mt-8 text-lg font-bold text-on-surface">{T('ثقة المتاجر', 'Store trust', loc)}</h2>
              <p className="mb-3 text-xs text-on-surface-variant">{T('نميّز بين «مسرح الخصومات» والقيمة السعرية الحقيقية — من واقع ما رصدناه.', 'We separate discount theatre from real price value — from what we actually observed.', loc)}</p>
              <div className="space-y-2">
                {stores.filter((s) => s.discount_behavior !== 'insufficient_data' || s.price_competitiveness_pct != null).map((s) => (
                  <div key={s.store_id} className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Store className="h-4 w-4 text-on-surface-variant" aria-hidden />
                      <span className="font-semibold text-on-surface">{s.store_name}</span>
                      {s.price_competitiveness_pct != null && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">{T(`الأرخص ${s.price_competitiveness_pct}٪`, `cheapest ${s.price_competitiveness_pct}%`, loc)}</span>
                      )}
                      {s.unobserved_reference_pct != null && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.unobserved_reference_pct >= 70 ? 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400' : 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'}`}>
                          {s.unobserved_reference_pct === 0 ? T('«قبل» طابق ما رصدناه', '"was" matched what we saw', loc) : T(`${s.unobserved_reference_pct}٪ «قبل» لم نرصده`, `${s.unobserved_reference_pct}% "was" not observed`, loc)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-on-surface-variant">{loc === 'ar' ? s.headline.ar : s.headline.en}</p>
                    {s.evidence?.sample_size != null && (
                      <p className="mt-1 text-[10px] text-on-surface-variant/70">{T(`عيّنة ${s.evidence.sample_size}${s.evidence.observation_window_days ? ` · ${s.evidence.observation_window_days} يوم` : ''} · ثقة ${s.evidence.confidence === 'high' ? 'عالية' : s.evidence.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}`, `sample ${s.evidence.sample_size}${s.evidence.observation_window_days ? ` · ${s.evidence.observation_window_days}d` : ''} · ${s.evidence.confidence} confidence`, loc)}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Methodology — honest & non-accusatory */}
          <div className="mt-8 rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-low p-4 text-xs text-on-surface-variant">
            <p className="flex items-center gap-1.5 font-semibold text-on-surface"><CircleAlert className="h-3.5 w-3.5" aria-hidden />{T('كيف نحسب هذا', 'How we compute this', loc)}</p>
            <p className="mt-1">{T('نقارن سعر «قبل» المعلَن بأعلى سعر رصدناه فعلاً لنفس المنتج خلال فترة تتبّعنا. «سعر لم نرصده» لا يعني تلاعبًا — قد يكون سعرًا مرجعيًا؛ لكننا نعرض لك التوفير الحقيقي مقابل ما رأيناه. عند نقص البيانات نصمت ولا نحكم.',
                 'We compare the advertised "was" price to the highest price we actually observed for the same product during our tracking. "A price we never observed" is not an accusation — it may be a reference price; we simply show you the real saving vs. what we saw. With insufficient history, we stay silent.', loc)}</p>
            <p className="mt-2 flex items-center gap-1.5 text-success-700 dark:text-success-400"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{T('محايد تمامًا — لا تدخل العمولة في أي من هذا.', 'Fully neutral — commission never enters any of this.', loc)}</p>
          </div>
        </>
      )}
    </div>
  );
}
