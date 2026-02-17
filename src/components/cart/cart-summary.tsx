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
import { useTranslations } from '@/lib/simple-intl-provider';

interface CartSummaryProps {
  locale: string;
  onCheckout?: (storeId: string) => void;
}

export function CartSummary({ locale, onCheckout }: CartSummaryProps) {
  const { cart, totalItems, subtotal } = useMultiStoreCart();
  const t = useTranslations();
  const isRTL = locale === 'ar';
  const stores = Object.values(cart);

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-outline" />
          <p className="text-on-surface-variant">
            {t('cart.cartEmpty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cart.cartSummary')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {stores.map((store, idx) => {
          const totals = getStoreTotals(cart, store.storeId);

          return (
            <div key={store.storeId}>
              {idx > 0 && <Separator className="my-6" />}
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-title-lg text-on-surface mb-1">
                    {store.storeName}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    {totals.itemCount} {totals.itemCount === 1 ? t('cart.product') : t('cart.products')}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">
                      {t('cart.subtotal')}
                    </span>
                    <Price
                      amount={totals.subtotal}
                      className="font-semibold text-on-surface"
                    />
                  </div>
                  {totals.deliveryCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">
                        {t('cart.delivery')}
                      </span>
                      <Price
                        amount={totals.deliveryCost}
                        className="font-semibold text-on-surface"
                      />
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-on-surface">
                      {t('cart.total')}
                    </span>
                    <Price
                      amount={totals.total}
                      className="font-bold text-lg text-on-surface"
                    />
                  </div>
                </div>

                {onCheckout && (
                  <Button
                    onClick={() => onCheckout(store.storeId)}
                    className="w-full"
                    variant="default"
                  >
                    {t('cart.checkoutFrom', { storeName: store.storeName })}
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
                <span className="font-semibold text-on-surface">
                  {t('cart.grandTotal')}
                </span>
                <Price
                  amount={subtotal}
                  className="font-bold text-lg text-on-surface"
                />
              </div>
              <p className="text-xs text-on-surface-variant">
                {t('cart.fromStores', { count: stores.length })}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

