'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type CartItem,
  type MultiStoreCart,
  addItemToCart,
  clearCart,
  getCartTotals,
  loadCart,
  persistCart,
  removeItemFromCart,
} from './multi-store-cart';

interface MultiStoreCartContextValue {
  cart: MultiStoreCart;
  addItem: (item: CartItem) => void;
  removeItem: (storeId: string, productId: string) => void;
  clear: () => void;
  totalItems: number;
  totalStores: number;
  subtotal: number;
}

const MultiStoreCartContext = createContext<MultiStoreCartContextValue | undefined>(undefined);

export function MultiStoreCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<MultiStoreCart>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const existing = loadCart();
    setCart(existing);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistCart(cart);
  }, [cart, hydrated]);

  const addItem = (item: CartItem) => {
    setCart((prev) => addItemToCart(prev, item));
  };

  const removeItem = (storeId: string, productId: string) => {
    setCart((prev) => removeItemFromCart(prev, storeId, productId));
  };

  const clear = () => {
    setCart(clearCart());
  };

  const { totalItems, totalStores, subtotal } = useMemo(() => getCartTotals(cart), [cart]);

  const value = useMemo<MultiStoreCartContextValue>(
    () => ({
      cart,
      addItem,
      removeItem,
      clear,
      totalItems,
      totalStores,
      subtotal,
    }),
    [cart, totalItems, totalStores, subtotal]
  );

  return <MultiStoreCartContext.Provider value={value}>{children}</MultiStoreCartContext.Provider>;
}

export function useMultiStoreCart() {
  const context = useContext(MultiStoreCartContext);
  if (!context) {
    throw new Error('useMultiStoreCart must be used within a MultiStoreCartProvider');
  }
  return context;
}

