'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { Database } from '@/lib/database/types';

type PriceAlertRow = Database['public']['Tables']['price_alerts']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

interface PriceAlertCardProps {
  alert: PriceAlertRow & {
    products?: ProductRow;
  };
  currentPrice: number;
  locale: string;
  onEdit: (alert: PriceAlertRow) => void;
  onDelete: (alertId: string) => void;
  onToggle: (alertId: string, isActive: boolean) => void;
}

export function PriceAlertCard({
  alert,
  currentPrice,
  locale,
  onEdit,
  onDelete,
  onToggle,
}: PriceAlertCardProps) {
  const isRTL = locale === 'ar';
  const product = alert.products;
  const productName = product ? (locale === 'ar' ? product.name_ar : product.name_en) : 'Unknown Product';
  const productImage = product?.image_urls?.[0] || '/placeholder-product.png';
  const priceDifference = currentPrice - alert.target_price;
  const pricePercentage = currentPrice > 0 ? ((priceDifference / currentPrice) * 100) : 0;
  const isTargetReached = currentPrice <= alert.target_price;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            <Image
              src={productImage}
              alt={productName}
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-product.png';
              }}
            />
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2 truncate">
              {productName}
            </h3>

            {/* Price Comparison */}
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isRTL ? 'السعر الحالي' : 'Current Price'}:
                </span>
                <Price
                  amount={currentPrice}
                  className="text-lg font-bold text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isRTL ? 'السعر المستهدف' : 'Target Price'}:
                </span>
                <Price
                  amount={alert.target_price}
                  className="text-lg font-semibold text-primary-600 dark:text-primary-400"
                />
              </div>
              {isTargetReached ? (
                <Badge variant="success" className="w-fit">
                  {isRTL ? 'تم الوصول للهدف! 🎉' : 'Target Reached! 🎉'}
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isRTL ? 'الفرق' : 'Difference'}:
                  </span>
                  <span className={cn(
                    'text-sm font-semibold',
                    priceDifference > 0 ? 'text-warning-600 dark:text-warning-400' : 'text-success-600 dark:text-success-400'
                  )}>
                    <Price amount={Math.abs(priceDifference)} />
                    {` (${pricePercentage.toFixed(1)}%)`}
                  </span>
                </div>
              )}
            </div>

            {/* Status & Date */}
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span>
                {isRTL ? 'تاريخ الإنشاء' : 'Created'}: {format(new Date(alert.created_at), 'MMM dd, yyyy')}
              </span>
              {alert.notified_at && (
                <span>
                  {isRTL ? 'تم الإشعار' : 'Notified'}: {format(new Date(alert.notified_at), 'MMM dd, yyyy')}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(alert.id, !alert.is_active)}
                className={cn(
                  alert.is_active ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {alert.is_active ? (
                  <>
                    <Power className="h-4 w-4 mr-1" />
                    {isRTL ? 'نشط' : 'Active'}
                  </>
                ) : (
                  <>
                    <PowerOff className="h-4 w-4 mr-1" />
                    {isRTL ? 'غير نشط' : 'Inactive'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(alert)}
              >
                <Edit className="h-4 w-4 mr-1" />
                {isRTL ? 'تعديل' : 'Edit'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(alert.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isRTL ? 'حذف' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

