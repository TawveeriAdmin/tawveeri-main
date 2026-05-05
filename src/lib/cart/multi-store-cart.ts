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
  productStoreId?: string; // For tracking
}

export interface StoreCart {
  storeId: string;
  storeName: string;
  items: CartItem[];
  deliveryCost?: number;
  deliveryTimeDays?: number;
}

export type MultiStoreCart = Record<string, StoreCart>;

const STORAGE_KEY = 'tawveeri-multi-store-cart';

function cloneCart(cart: MultiStoreCart): MultiStoreCart {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(cart);
    }
  } catch {
    // fall back to JSON cloning
  }
  return JSON.parse(JSON.stringify(cart)) as MultiStoreCart;
}

export function loadCart(): MultiStoreCart {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MultiStoreCart;
    return parsed || {};
  } catch (error) {
    console.error('Failed to load cart from storage:', error);
    return {};
  }
}

export function persistCart(cart: MultiStoreCart) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Failed to persist cart:', error);
  }
}

export function addItemToCart(cart: MultiStoreCart, item: CartItem): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[item.storeId] ?? {
    storeId: item.storeId,
    storeName: item.storeName,
    items: [],
  };

  const existingItem = storeEntry.items.find((existing) => existing.productId === item.productId);
  if (existingItem) {
    existingItem.quantity += item.quantity;
    existingItem.price = item.price;
    existingItem.productName = item.productName;
    existingItem.productSlug = item.productSlug;
    existingItem.imageUrl = item.imageUrl;
  } else {
    storeEntry.items.push({ ...item });
  }

  storeEntry.items = storeEntry.items.filter((product) => product.quantity > 0);

  if (storeEntry.items.length > 0) {
    nextCart[item.storeId] = storeEntry;
  } else {
    delete nextCart[item.storeId];
  }

  return nextCart;
}

export function removeItemFromCart(cart: MultiStoreCart, storeId: string, productId: string): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[storeId];
  if (!storeEntry) return nextCart;

  storeEntry.items = storeEntry.items.filter((item) => item.productId !== productId);

  if (storeEntry.items.length === 0) {
    delete nextCart[storeId];
  } else {
    nextCart[storeId] = storeEntry;
  }

  return nextCart;
}

export function clearCart(): MultiStoreCart {
  return {};
}

export function getCartTotals(cart: MultiStoreCart) {
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

