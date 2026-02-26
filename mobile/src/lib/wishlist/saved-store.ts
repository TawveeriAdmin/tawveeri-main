/**
 * Local saved products store (for search results without DB IDs).
 * Persisted to AsyncStorage. Works without auth.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  store: string;
  url: string;
  savedAt: string;
}

interface SavedStore {
  products: SavedProduct[];
  addProduct: (product: Omit<SavedProduct, 'savedAt'>) => void;
  removeProduct: (id: string) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedStore>()(
  persist(
    (set, get) => ({
      products: [],
      addProduct: (product) => {
        if (get().products.some((p) => p.id === product.id)) return;
        set((state) => ({
          products: [{ ...product, savedAt: new Date().toISOString() }, ...state.products],
        }));
      },
      removeProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },
      isSaved: (id) => get().products.some((p) => p.id === id),
      clear: () => set({ products: [] }),
    }),
    {
      name: 'tawveeri-saved-products',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
