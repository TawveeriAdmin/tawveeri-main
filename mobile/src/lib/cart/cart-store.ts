/**
 * Zustand cart store with AsyncStorage persistence.
 * Ports pure cart logic from web's multi-store-cart.ts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types (shared with web) ---
export interface CartItem {
  productId: string;
  productName: string;
  productSlug?: string | null;
  storeId: string;
  storeName: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  notes?: string;
  giftWrapping?: boolean;
  productStoreId?: string;
}

export interface StoreCart {
  storeId: string;
  storeName: string;
  items: CartItem[];
  deliveryCost?: number;
  deliveryTimeDays?: number;
}

export type MultiStoreCart = Record<string, StoreCart>;

// --- Pure Functions (ported from web) ---
function cloneCart(cart: MultiStoreCart): MultiStoreCart {
  return JSON.parse(JSON.stringify(cart)) as MultiStoreCart;
}

function addItemToCartPure(cart: MultiStoreCart, item: CartItem): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[item.storeId] ?? {
    storeId: item.storeId,
    storeName: item.storeName,
    items: [],
  };

  const existing = storeEntry.items.find((e) => e.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity;
    existing.price = item.price;
    existing.productName = item.productName;
    existing.productSlug = item.productSlug;
    existing.imageUrl = item.imageUrl;
  } else {
    storeEntry.items.push({ ...item });
  }

  storeEntry.items = storeEntry.items.filter((p) => p.quantity > 0);

  if (storeEntry.items.length > 0) {
    nextCart[item.storeId] = storeEntry;
  } else {
    delete nextCart[item.storeId];
  }

  return nextCart;
}

function removeItemFromCartPure(cart: MultiStoreCart, storeId: string, productId: string): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[storeId];
  if (!storeEntry) return nextCart;

  storeEntry.items = storeEntry.items.filter((item) => item.productId !== productId);

  if (storeEntry.items.length === 0) {
    delete nextCart[storeId];
  }

  return nextCart;
}

function getCartTotalsPure(cart: MultiStoreCart) {
  let totalItems = 0;
  let totalStores = 0;
  let subtotal = 0;

  Object.values(cart).forEach((store) => {
    totalStores += 1;
    store.items.forEach((item) => {
      totalItems += item.quantity;
      subtotal += item.price * item.quantity;
    });
  });

  return { totalItems, totalStores, subtotal };
}

// --- Zustand Store ---
interface CartState {
  cart: MultiStoreCart;
  addItem: (item: CartItem) => void;
  removeItem: (storeId: string, productId: string) => void;
  updateQuantity: (storeId: string, productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotals: () => { totalItems: number; totalStores: number; subtotal: number };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: {},

      addItem: (item) => set((state) => ({
        cart: addItemToCartPure(state.cart, item),
      })),

      removeItem: (storeId, productId) => set((state) => ({
        cart: removeItemFromCartPure(state.cart, storeId, productId),
      })),

      updateQuantity: (storeId, productId, quantity) => set((state) => {
        const nextCart = cloneCart(state.cart);
        const storeEntry = nextCart[storeId];
        if (!storeEntry) return state;

        const item = storeEntry.items.find((i) => i.productId === productId);
        if (!item) return state;

        item.quantity = Math.max(0, quantity);

        storeEntry.items = storeEntry.items.filter((i) => i.quantity > 0);
        if (storeEntry.items.length === 0) {
          delete nextCart[storeId];
        }

        return { cart: nextCart };
      }),

      clearCart: () => set({ cart: {} }),

      getTotals: () => getCartTotalsPure(get().cart),
    }),
    {
      name: 'tawveeri-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Create a CartItem from a product with its store entries.
 * Selects the lowest-price store variant.
 */
export function createCartItemFromProduct<T extends {
  id: string;
  name_ar: string;
  name_en: string;
  slug?: string | null;
  image_urls?: string[] | null;
  product_stores?: Array<{
    id: string;
    current_price: number;
    stores: {
      id: string;
      name_ar: string;
      name_en: string;
    };
  }>;
}>(product: T, locale: string): CartItem | null {
  const storeEntry = product.product_stores
    ?.filter((store) => typeof store.current_price === 'number')
    .reduce<(typeof product.product_stores)[number] | null>((best, current) => {
      if (!best) return current;
      return current.current_price < best.current_price ? current : best;
    }, null);
  if (!storeEntry) return null;

  const storeName = locale === 'ar' ? storeEntry.stores.name_ar : storeEntry.stores.name_en;
  const productName = locale === 'ar' ? product.name_ar : product.name_en;

  return {
    productId: product.id,
    productName,
    productSlug: product.slug ?? null,
    storeId: storeEntry.stores.id,
    storeName,
    price: storeEntry.current_price,
    quantity: 1,
    imageUrl: product.image_urls?.[0] ?? null,
  };
}
