'use client';

import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { getStoreTotals } from '@/lib/cart/cart-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CartSummaryProps {
  locale: string;
  onCheckout?: (storeId: string) => void;
}

export function CartSummary({ locale, onCheckout }: CartSummaryProps) {
  const { cart, totalItems, subtotal } = useMultiStoreCart();
  const isRTL = locale === 'ar';
  const stores = Object.values(cart);

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            {isRTL ? 'سلة التسوق فارغة' : 'Your cart is empty'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRTL ? 'ملخص السلة' : 'Cart Summary'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {stores.map((store, idx) => {
          const totals = getStoreTotals(cart, store.storeId);

          return (
            <div key={store.storeId}>
              {idx > 0 && <Separator className="my-6" />}
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                    {store.storeName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isRTL
                      ? `${totals.itemCount} ${totals.itemCount === 1 ? 'منتج' : 'منتجات'}`
                      : `${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'}`}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
                    </span>
                    <Price
                      amount={totals.subtotal}
                      className="font-semibold text-gray-900 dark:text-white"
                    />
                  </div>
                  {totals.deliveryCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isRTL ? 'رسوم التوصيل' : 'Delivery'}
                      </span>
                      <Price
                        amount={totals.deliveryCost}
                        className="font-semibold text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {isRTL ? 'المجموع' : 'Total'}
                    </span>
                    <Price
                      amount={totals.total}
                      className="font-bold text-lg text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {onCheckout && (
                  <Button
                    onClick={() => onCheckout(store.storeId)}
                    className="w-full"
                    variant="default"
                  >
                    {isRTL ? `الشراء من ${store.storeName}` : `Checkout from ${store.storeName}`}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {stores.length > 1 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {isRTL ? 'المجموع الكلي' : 'Grand Total'}
                </span>
                <Price
                  amount={subtotal}
                  className="font-bold text-lg text-gray-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRTL
                  ? `من ${stores.length} متاجر`
                  : `From ${stores.length} stores`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

