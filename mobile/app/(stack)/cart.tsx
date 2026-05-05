/**
 * Cart Screen - Multi-store grouped cart (stack screen)
 *
 * HIG: Use .insetGrouped list style for settings-like grouped content.
 * Groups items by store with subtotals.
 */

import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart, Trash2, Plus, Minus, ExternalLink } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale, useTranslations } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useCartStore, StoreCart, CartItem } from '@/src/lib/cart/cart-store';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button, Card, Price, EmptyState, SARSymbol, KeyedProductImage } from '@/src/components/ui';
import { formatPrice } from '@/src/lib/utils';

export default function CartScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useTranslations();
  const rtl = useRTL();
  const { cart, removeItem, updateQuantity, clearCart, getTotals } = useCartStore();
  const totals = getTotals();
  const stores = Object.values(cart);

  const handleClearCart = useCallback(() => {
    Alert.alert(
      locale === 'ar' ? 'مسح السلة' : 'Clear Cart',
      locale === 'ar' ? 'هل أنت متأكد من مسح جميع المنتجات?' : 'Are you sure you want to remove all items?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'مسح' : 'Clear', style: 'destructive', onPress: clearCart },
      ]
    );
  }, [locale, clearCart]);

  if (stores.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'السلة فارغة' : 'Your cart is empty'}
        message={locale === 'ar' ? 'ابحث عن منتجات وأضفها إلى سلتك' : 'Search for products and add them to your cart'}
        actionTitle={locale === 'ar' ? 'ابدأ التسوق' : 'Start Shopping'}
        onAction={() => router.push('/(tabs)/search')}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Clear All header */}
      <View style={[styles.clearHeader, { flexDirection: rtl.row }]}>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          {totals.totalItems} {locale === 'ar' ? 'منتج' : 'items'}
        </Text>
        <Pressable onPress={handleClearCart} hitSlop={8}>
          <Text style={[typography.footnote, { color: colors.error, fontWeight: '600' }]}>
            {locale === 'ar' ? 'مسح الكل' : 'Clear All'}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {stores.map((store) => (
          <StoreSection
            key={store.storeId}
            store={store}
            locale={locale}
            colors={colors}
            rtl={rtl}
            onRemove={removeItem}
            onUpdateQty={updateQuantity}
          />
        ))}
      </ScrollView>

      {/* Bottom Summary Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.separator }]}>
        <View>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {locale === 'ar' ? `${totals.totalItems} منتج من ${totals.totalStores} متجر` : `${totals.totalItems} items from ${totals.totalStores} stores`}
          </Text>
          <Text style={[typography.title3, { color: colors.label, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {formatPrice(totals.subtotal)} <SARSymbol size={14} color={colors.primary} />
          </Text>
        </View>
      </View>
    </View>
  );
}

function StoreSection({ store, locale, colors, rtl, onRemove, onUpdateQty }: {
  store: StoreCart; locale: string; colors: any; rtl: ReturnType<typeof useRTL>;
  onRemove: (storeId: string, productId: string) => void;
  onUpdateQty: (storeId: string, productId: string, qty: number) => void;
}) {
  const storeTotal = store.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.md }}>
      <View style={[styles.storeHeader, { backgroundColor: colors.secondaryBackground, borderRadius: radii.md, flexDirection: rtl.row }]}>
        <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>{store.storeName}</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }]}>
          {formatPrice(storeTotal)} <SARSymbol size={11} color={colors.primary} />
        </Text>
      </View>

      {store.items.map((item) => (
        <CartItemRow
          key={item.productId}
          item={item}
          storeId={store.storeId}
          locale={locale}
          colors={colors}
          rtl={rtl}
          onRemove={onRemove}
          onUpdateQty={onUpdateQty}
        />
      ))}
    </View>
  );
}

function CartItemRow({ item, storeId, locale, colors, rtl, onRemove, onUpdateQty }: {
  item: CartItem; storeId: string; locale: string; colors: any; rtl: ReturnType<typeof useRTL>;
  onRemove: (storeId: string, productId: string) => void;
  onUpdateQty: (storeId: string, productId: string, qty: number) => void;
}) {
  return (
    <View style={[styles.cartItem, { backgroundColor: colors.card, borderBottomColor: colors.separator, flexDirection: rtl.row }]}>
      <View style={[styles.itemImage, { backgroundColor: colors.secondaryBackground, borderRadius: radii.sm }]}>
        {item.imageUrl ? (
          <KeyedProductImage uri={item.imageUrl} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <ShoppingCart size={20} color={colors.tertiaryLabel} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
        <Text numberOfLines={2} style={[typography.subheadline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {item.productName}
        </Text>
        <Text style={[typography.headline, { color: colors.label, marginTop: 4, fontVariant: ['tabular-nums'], textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {formatPrice(item.price)} <SARSymbol size={12} color={colors.primary} />
        </Text>
        {/* Quantity controls */}
        <View style={{ flexDirection: rtl.row, alignItems: 'center', marginTop: spacing.sm, gap: spacing.md }}>
          <View style={[styles.qtyControls, { borderColor: colors.separator }]}>
            <Pressable
              onPress={() => onUpdateQty(storeId, item.productId, item.quantity - 1)}
              style={styles.qtyButton}
              hitSlop={4}
            >
              <Minus size={16} color={colors.primary} />
            </Pressable>
            <Text style={[typography.body, { color: colors.label, fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'center' }]}>
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQty(storeId, item.productId, item.quantity + 1)}
              style={styles.qtyButton}
              hitSlop={4}
            >
              <Plus size={16} color={colors.primary} />
            </Pressable>
          </View>
          <Pressable onPress={() => onRemove(storeId, item.productId)} hitSlop={8}>
            <Trash2 size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clearHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  storeHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  cartItem: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemImage: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  qtyButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
