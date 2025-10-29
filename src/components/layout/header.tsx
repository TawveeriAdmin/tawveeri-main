'use client';

import { useTheme } from 'next-themes';
import { useLocale } from '@/app/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Languages } from 'lucide-react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-700 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary-800 dark:text-primary-400">
            {t('app.name')}
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#"
            className="text-sm font-medium text-gray-700 hover:text-primary-800 transition-colors dark:text-gray-300 dark:hover:text-primary-400"
          >
            {t('nav.products')}
          </a>
          <a
            href="#"
            className="text-sm font-medium text-gray-700 hover:text-primary-800 transition-colors dark:text-gray-300 dark:hover:text-primary-400"
          >
            {t('nav.deals')}
          </a>
          <a
            href="#"
            className="text-sm font-medium text-gray-700 hover:text-primary-800 transition-colors dark:text-gray-300 dark:hover:text-primary-400"
          >
            {t('nav.compare')}
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label="Toggle language"
          >
            <Languages className="h-5 w-5" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
