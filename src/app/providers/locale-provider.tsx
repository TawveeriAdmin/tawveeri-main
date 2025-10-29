'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'ar' | 'en';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

// Translation dictionary
const translations = {
  ar: {
    'app.name': 'توفيري',
    'nav.products': 'المنتجات',
    'nav.deals': 'العروض',
    'nav.compare': 'مقارنة',
    'price.best': 'أفضل سعر',
    'price.save': 'وفر',
    'price.sar': 'ر.س',
    'button.view': 'عرض في المتجر',
    'store.extra': 'اكسترا',
    'store.jarir': 'مكتبة جرير',
    'store.noon': 'نون',
    'delivery.free': 'توصيل مجاني',
    'warranty': 'الضمان',
    'rating': 'التقييم',
  },
  en: {
    'app.name': 'Tawveeri',
    'nav.products': 'Products',
    'nav.deals': 'Deals',
    'nav.compare': 'Compare',
    'price.best': 'Best Price',
    'price.save': 'Save',
    'price.sar': 'SAR',
    'button.view': 'View at Store',
    'store.extra': 'Extra',
    'store.jarir': 'Jarir',
    'store.noon': 'Noon',
    'delivery.free': 'Free Delivery',
    'warranty': 'Warranty',
    'rating': 'Rating',
  },
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Default to Arabic
  const [locale, setLocaleState] = useState<Locale>('ar');
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    // Update document attributes
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';

      // Update font family based on locale
      const fontClass = newLocale === 'ar' ? 'font-sans-ar' : 'font-sans';
      document.documentElement.className = document.documentElement.className
        .replace(/font-sans(-ar)?/g, '')
        .trim();
      document.documentElement.classList.add(fontClass);

      // Store preference
      localStorage.setItem('locale', newLocale);
    }
  };

  // Initialize from localStorage or default to Arabic
  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    const initialLocale = stored || 'ar';

    if (typeof document !== 'undefined') {
      document.documentElement.lang = initialLocale;
      document.documentElement.dir = initialLocale === 'ar' ? 'rtl' : 'ltr';

      const fontClass = initialLocale === 'ar' ? 'font-sans-ar' : 'font-sans';
      document.documentElement.classList.add(fontClass);
    }

    setLocaleState(initialLocale);
  }, []);

  const t = (key: string): string => {
    return translations[locale][key as keyof typeof translations.ar] || key;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dir, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
