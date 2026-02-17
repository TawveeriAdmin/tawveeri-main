'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface PriceHistoryChartProps {
  productStoreId: string;
  productName: string;
  storeName: string;
  locale?: string;
  height?: number;
}

interface PricePoint {
  price: number;
  recorded_at: string;
}

type TimeRange = '30' | '90' | '365';

export function PriceHistoryChart({
  productStoreId,
  productName,
  storeName,
  locale: propLocale,
  height = 300,
}: PriceHistoryChartProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = propLocale || (params?.locale as string) || 'ar';
  const supabase = getSupabaseBrowserClient();

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('90');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPriceHistory() {
      setLoading(true);
      setError(null);

      try {
        const days = parseInt(timeRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error: queryError } = await supabase
          .from('price_history')
          .select('price, recorded_at')
          .eq('product_store_id', productStoreId)
          .gte('recorded_at', startDate.toISOString())
          .order('recorded_at', { ascending: true });

        if (queryError) throw queryError;

        setPriceHistory((data || []) as PricePoint[]);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError(err instanceof Error ? err.message : t('products.priceHistory.errorLoading'));
      } finally {
        setLoading(false);
      }
    }

    fetchPriceHistory();
  }, [productStoreId, timeRange, locale]);

  // Calculate price trend
  const priceTrend = (() => {
    if (priceHistory.length < 2) return null;
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const diff = lastPrice - firstPrice;
    const percentage = ((diff / firstPrice) * 100).toFixed(1);
    return { diff, percentage, isPositive: diff > 0 };
  })();

  // Simple chart rendering (without external library)
  const maxPrice = Math.max(...priceHistory.map((p) => p.price), 0);
  const minPrice = Math.min(...priceHistory.map((p) => p.price), maxPrice);
  const priceRange = maxPrice - minPrice || 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('products.priceHistory.title')}</CardTitle>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">{t('products.priceHistory.30Days')}</SelectItem>
              <SelectItem value="90">{t('products.priceHistory.90Days')}</SelectItem>
              <SelectItem value="365">{t('products.priceHistory.1Year')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {priceTrend && (
          <div className="flex items-center gap-2 text-sm">
            {priceTrend.isPositive ? (
              <TrendingUp className="w-4 h-4 text-error" />
            ) : priceTrend.diff < 0 ? (
              <TrendingDown className="w-4 h-4 text-success" />
            ) : (
              <Minus className="w-4 h-4 text-outline" />
            )}
            <span className={priceTrend.isPositive ? 'text-error' : priceTrend.diff < 0 ? 'text-success' : 'text-outline'}>
              {priceTrend.isPositive ? '+' : ''}
              {priceTrend.percentage}%{' '}
              {priceTrend.isPositive
                ? t('products.priceHistory.increase')
                : priceTrend.diff < 0
                  ? t('products.priceHistory.decrease')
                  : t('products.priceHistory.noChange')}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full" style={{ height: `${height}px` }} />
        ) : error ? (
          <div className="text-center text-error py-8">{error}</div>
        ) : priceHistory.length === 0 ? (
          <div className="text-center text-on-surface-variant py-8">
            {t('products.priceHistory.noData')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple Line Chart */}
            <div
              className="relative w-full border-b-2 border-outline-variant"
              style={{ height: `${height}px` }}
            >
              <svg className="w-full h-full" viewBox={`0 0 ${priceHistory.length * 10} ${height}`} preserveAspectRatio="none">
                <polyline
                  points={priceHistory
                    .map(
                      (point, index) =>
                        `${index * 10},${height - ((point.price - minPrice) / priceRange) * height}`
                    )
                    .join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                />
                {priceHistory.map((point, index) => (
                  <circle
                    key={index}
                    cx={index * 10}
                    cy={height - ((point.price - minPrice) / priceRange) * height}
                    r="3"
                    className="fill-primary"
                  />
                ))}
              </svg>
            </div>

            {/* Price Labels */}
            <div className="flex justify-between text-xs text-on-surface-variant">
              <div>
                <div>{t('products.priceHistory.lowest')}</div>
                <div className="font-semibold">{minPrice.toLocaleString()} {locale === 'ar' ? 'ر.س' : 'SAR'}</div>
              </div>
              <div>
                <div>{t('products.priceHistory.highest')}</div>
                <div className="font-semibold">{maxPrice.toLocaleString()} {locale === 'ar' ? 'ر.س' : 'SAR'}</div>
              </div>
            </div>

            {/* Recent Prices List */}
            <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
              {priceHistory.slice(-5).reverse().map((point, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">
                    {new Date(point.recorded_at).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="font-semibold">{point.price.toLocaleString()} {locale === 'ar' ? 'ر.س' : 'SAR'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

