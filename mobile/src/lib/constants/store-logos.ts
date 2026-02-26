import { ImageSource } from 'expo-image';

export const STORE_LOGOS: Record<string, ImageSource> = {
  amazon: require('@/assets/logos/amazon.png'),
  noon: require('@/assets/logos/noon.png'),
  jarir: require('@/assets/logos/jarir.png'),
  extra: require('@/assets/logos/extra.png'),
  almanea: require('@/assets/logos/almanea.png'),
};

export const STORE_NAMES: Record<string, { ar: string; en: string }> = {
  amazon: { ar: 'أمازون', en: 'Amazon' },
  noon: { ar: 'نون', en: 'Noon' },
  jarir: { ar: 'جرير', en: 'Jarir' },
  extra: { ar: 'اكسترا', en: 'Extra' },
  almanea: { ar: 'المنيع', en: 'Almanea' },
};
