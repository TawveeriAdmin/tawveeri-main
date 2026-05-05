/**
 * Zustand compare store with AsyncStorage persistence.
 * Max 4 products for side-by-side comparison.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CompareProduct {
  id: string;
  name_ar?: string;
  name_en?: string;
  name?: string;
  slug: string;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  specifications?: Record<string, unknown> | null;
  product_stores?: Array<{
    id: string;
    current_price: number;
    original_price?: number | null;
    store_id: string;
    delivery_time_days?: number | null;
    delivery_cost?: number | null;
    is_free_delivery?: boolean | null;
    stores?: {
      id: string;
      name: string;
      name_ar?: string;
      name_en?: string;
      logo_url?: string | null;
      delivery_info_ar?: string | null;
      delivery_info_en?: string | null;
      return_policy_ar?: string | null;
      return_policy_en?: string | null;
      warranty_info_ar?: string | null;
      warranty_info_en?: string | null;
    };
  }>;
}

const MAX_COMPARE = 4;

interface CompareState {
  products: CompareProduct[];
  addProduct: (product: CompareProduct) => boolean;
  removeProduct: (id: string) => void;
  clearAll: () => void;
  isInCompare: (id: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        const { products } = get();
        if (products.length >= MAX_COMPARE) return false;
        if (products.some((p) => p.id === product.id)) return false;
        set({ products: [...products, product] });
        return true;
      },

      removeProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      clearAll: () => set({ products: [] }),

      isInCompare: (id) => get().products.some((p) => p.id === id),
    }),
    {
      name: 'tawveeri-compare',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
