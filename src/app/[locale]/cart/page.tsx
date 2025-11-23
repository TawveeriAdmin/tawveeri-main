'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { getStoreTotals } from '@/lib/cart/cart-utils';
import { CartSummary } from '@/components/cart/cart-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Price } from '@/components/ui/price';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Edit,
  Gift,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Image from 'next/image';
import type { CartItem } from '@/lib/cart/multi-store-cart';
import { generateAffiliateUrl } from '@/lib/transactions/tracking';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user } = useAuth();
  const { cart, updateItemQuantity, updateItemNote, updateItemGiftWrapping, removeItem } =
    useMultiStoreCart();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  const [editNoteItem, setEditNoteItem] = useState<{
    storeId: string;
    productId: string;
    note: string;
  } | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');

  const stores = Object.values(cart);

  const handleQuantityChange = (storeId: string, productId: string, change: number) => {
    const store = cart[storeId];
    if (!store) return;

    const item = store.items.find((i) => i.productId === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      removeItem(storeId, productId);
      toast({
        title: isRTL ? 'تم الحذف' : 'Removed',
        description: isRTL ? 'تم إزالة المنتج من السلة' : 'Product removed from cart',
      });
    } else {
      updateItemQuantity(storeId, productId, newQuantity);
    }
  };

  const handleOpenNoteDialog = (storeId: string, productId: string) => {
    const store = cart[storeId];
    const item = store?.items.find((i) => i.productId === productId);
    setEditNoteItem({ storeId, productId, note: item?.notes || '' });
    setTempNote(item?.notes || '');
    setNoteDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (!editNoteItem) return;
    updateItemNote(editNoteItem.storeId, editNoteItem.productId, tempNote);
    setNoteDialogOpen(false);
    setEditNoteItem(null);
    toast({
      title: isRTL ? 'تم الحفظ' : 'Saved',
      description: isRTL ? 'تم حفظ الملاحظة' : 'Note saved',
    });
  };

  const handleCheckout = async (storeId: string) => {
    const store = cart[storeId];
    if (!store || store.items.length === 0) return;

    // For now, redirect to checkout page with store ID
    // In future, this could redirect directly to store's checkout
    router.push(`/${locale}/checkout?store=${storeId}`);
  };

  if (stores.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            icon={<ShoppingBag className="h-12 w-12" />}
            title={isRTL ? 'سلة التسوق فارغة' : 'Your cart is empty'}
            description={
              isRTL
                ? 'ابدأ بإضافة المنتجات إلى سلة التسوق'
                : 'Start adding products to your cart'
            }
            action={{
              label: isRTL ? 'تصفح المنتجات' : 'Browse Products',
              onClick: () => router.push(`/${locale}/products`),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{isRTL ? 'الرئيسية' : 'Home'}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{isRTL ? 'سلة التسوق' : 'Cart'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items */}
          <div className="flex-1 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isRTL ? 'سلة التسوق' : 'Shopping Cart'}
            </h1>

            {stores.map((store) => {
              const totals = getStoreTotals(cart, store.storeId);

              return (
                <Card key={store.storeId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{store.storeName}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckout(store.storeId)}
                      >
                        {isRTL ? 'الشراء من هذا المتجر' : 'Checkout from this store'}
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {store.items.map((item) => (
                        <div
                          key={item.productId}
                          className="flex gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          {/* Product Image */}
                          <Link
                            href={`/${locale}/products/${item.productSlug || item.productId}`}
                            className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
                          >
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.productName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <ShoppingBag className="h-8 w-8" />
                              </div>
                            )}
                          </Link>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/${locale}/products/${item.productSlug || item.productId}`}
                            >
                              <h3 className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 mb-1">
                                {item.productName}
                              </h3>
                            </Link>

                            <div className="flex items-center gap-4 mb-2">
                              <Price
                                amount={item.price}
                                className="font-semibold text-gray-900 dark:text-white"
                              />
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 mb-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(store.storeId, item.productId, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(store.storeId, item.productId, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Notes and Gift Wrapping */}
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenNoteDialog(store.storeId, item.productId)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                {isRTL ? 'ملاحظة' : 'Note'}
                                {item.notes && ' ✓'}
                              </Button>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`gift-${item.productId}`}
                                  checked={item.giftWrapping || false}
                                  onCheckedChange={(checked) =>
                                    updateItemGiftWrapping(
                                      store.storeId,
                                      item.productId,
                                      checked === true
                                    )
                                  }
                                />
                                <Label
                                  htmlFor={`gift-${item.productId}`}
                                  className="text-sm cursor-pointer flex items-center gap-1"
                                >
                                  <Gift className="h-3 w-3" />
                                  {isRTL ? 'تغليف هدية' : 'Gift Wrap'}
                                </Label>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(store.storeId, item.productId)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {isRTL ? 'حذف' : 'Remove'}
                              </Button>
                            </div>

                            {item.notes && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
                                {item.notes}
                              </div>
                            )}
                          </div>

                          {/* Item Total */}
                          <div className="text-right">
                            <Price
                              amount={item.price * item.quantity}
                              className="font-bold text-lg"
                            />
                          </div>
                        </div>
                      ))}

                      {/* Store Summary */}
                      <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-400">
                            {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
                          </span>
                          <Price amount={totals.subtotal} className="font-semibold" />
                        </div>
                        {totals.deliveryCost > 0 && (
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-gray-600 dark:text-gray-400">
                              {isRTL ? 'رسوم التوصيل' : 'Delivery'}
                            </span>
                            <Price amount={totals.deliveryCost} className="font-semibold" />
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t">
                          <span className="font-bold text-lg">
                            {isRTL ? 'المجموع' : 'Total'}
                          </span>
                          <Price amount={totals.total} className="font-bold text-lg" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cart Summary Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-4">
              <CartSummary locale={locale} onCheckout={handleCheckout} />
            </div>
          </div>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'إضافة ملاحظة' : 'Add Note'}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? 'أضف ملاحظة خاصة لهذا المنتج'
                : 'Add a special note for this product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">{isRTL ? 'الملاحظة' : 'Note'}</Label>
              <Textarea
                id="note"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder={
                  isRTL
                    ? 'مثال: لون محدد، حجم معين، إلخ...'
                    : 'e.g., specific color, size, etc...'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveNote}>{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

