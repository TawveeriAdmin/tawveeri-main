/**
 * Additional Cart Utility Functions
 * Functions for updating cart items (quantity, notes, gift wrapping)
 */

import type { CartItem, MultiStoreCart } from './multi-store-cart';

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

export function updateItemQuantity(
  cart: MultiStoreCart,
  storeId: string,
  productId: string,
  quantity: number
): MultiStoreCart {
  if (quantity <= 0) {
    return cart; // Use removeItem instead
  }

  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[storeId];
  if (!storeEntry) return nextCart;

  const item = storeEntry.items.find((i) => i.productId === productId);
  if (item) {
    item.quantity = quantity;
  }

  return nextCart;
}

export function updateItemNote(
  cart: MultiStoreCart,
  storeId: string,
  productId: string,
  note: string
): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[storeId];
  if (!storeEntry) return nextCart;

  const item = storeEntry.items.find((i) => i.productId === productId);
  if (item) {
    item.notes = note || undefined;
  }

  return nextCart;
}

export function updateItemGiftWrapping(
  cart: MultiStoreCart,
  storeId: string,
  productId: string,
  giftWrapping: boolean
): MultiStoreCart {
  const nextCart = cloneCart(cart);
  const storeEntry = nextCart[storeId];
  if (!storeEntry) return nextCart;

  const item = storeEntry.items.find((i) => i.productId === productId);
  if (item) {
    item.giftWrapping = giftWrapping;
  }

  return nextCart;
}

export function getStoreTotals(cart: MultiStoreCart, storeId: string) {
  const store = cart[storeId];
  if (!store) {
    return { subtotal: 0, deliveryCost: 0, total: 0, itemCount: 0 };
  }

  const subtotal = store.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryCost = store.deliveryCost || 0;
  const itemCount = store.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    deliveryCost,
    total: subtotal + deliveryCost,
    itemCount,
  };
}

