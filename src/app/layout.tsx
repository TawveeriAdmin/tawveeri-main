// ROOT LAYOUT — owns the HTML shell, the locale, the fonts and every provider.
//
// WHY IT OWNS THE LOCALE. This layout sits ABOVE the `[locale]` segment, so it cannot read
// the route param. It used to ship a hardcoded `lang="ar"` on every page, which meant `/en`
// served `<html lang="ar">` — English copy announced in an Arabic voice (WCAG 3.1.1, Level A)
// — and carried no `dir` at all, so Radix portals (mounted on `document.body`, outside the
// `[locale]` wrapper) had to set direction by hand. A client-side script corrected both after
// first paint; the SERVED BYTES stayed wrong, which is what a no-JS consumer and any
// byte-level audit actually see.
//
// The locale therefore comes from the REQUEST, not the route tree: `x-locale`, set by our
// middleware, with next-intl's own `x-next-intl-locale` as the fallback and `defaultLocale`
// as the last resort. A missing header degrades to exactly the old behaviour (Arabic), never
// to a crash. Reading a header opts this layout into dynamic rendering — which costs nothing
// here, because `[locale]` is a dynamic segment with no `generateStaticParams`, so every page
// under it was already rendered on demand.
//
// WHY THE PROVIDERS MOVED UP. `app/not-found.tsx` is resolved at THIS level. While the shell
// lived in `[locale]/layout.tsx`, the 404 page for any unmatched route rendered with no
// header, no footer, no fonts and no theme. Providers here are what let that page be a real
// page.
//
// ONE CONSEQUENCE, HANDLED: Next does not re-render this layout on a client-side navigation,
// because it owns no route param. Switching locale therefore MUST be a hard navigation —
// see `goToLocale` in `public-page-shell.tsx`, which documents the same constraint from the
// other side. If you ever make locale switching a `router.push` again, the language, the
// direction and the messages all go stale together and nothing throws.
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { getRequestLocale } from '@/lib/i18n/request-locale';
import { SimpleIntlProvider } from '@/lib/simple-intl-provider';
import { ThemeProvider } from './providers/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { MultiStoreCartProvider } from '@/lib/cart/cart-context';
import { getNavigableCategories } from '@/lib/intelligence/navigable-categories';
import { NavigableCategoriesProvider } from '@/lib/intelligence/navigable-categories-context';
import { loadMessages } from '@/lib/i18n/load-messages';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  icons: {
    icon: '/logos/Tawveeri.png',
    apple: '/logos/Tawveeri.png',
  },
  title: {
    default: 'توفيري - Tawveeri | منصة مقارنة الأسعار',
    template: '%s | توفيري Tawveeri',
  },
  description:
    'أفضل الأسعار للإلكترونيات في السعودية - Find the best deals on electronics in Saudi Arabia',
  keywords:
    'price comparison, saudi arabia, electronics, deals, توفيري, مقارنة أسعار, السعودية, إلكترونيات',
  openGraph: {
    type: 'website',
    siteName: 'توفيري Tawveeri',
    locale: 'ar_SA',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Brand font — single family for both Arabic & English per brand guidelines
const cairo = Cairo({
  weight: ['300', '400', '600', '700', '900'],
  subsets: ['latin', 'arabic'],
  variable: '--font-cairo',
  display: 'swap',
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  // Which categories may appear in navigation — measured live, never hardcoded (ADR-150).
  // Failure returns [] inside the helper, so a bad read hides the menu rather than
  // rendering a stale one.
  const navigableCategories = (await getNavigableCategories()).map(
    ({ key, comparable, labelAr, labelEn, query, emoji, slug }) => ({ key, comparable, labelAr, labelEn, query, emoji, slug }),
  );

  const messages = await loadMessages(locale);

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={cairo.variable}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('tawveeri-theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <SimpleIntlProvider key={locale} messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            forcedTheme={undefined}
            storageKey="tawveeri-theme"
            disableTransitionOnChange={false}
          >
            <MultiStoreCartProvider>
              <AuthProvider>
                <NavigableCategoriesProvider categories={navigableCategories}>
                  {children}
                </NavigableCategoriesProvider>
                <Toaster />
              </AuthProvider>
            </MultiStoreCartProvider>
          </ThemeProvider>
        </SimpleIntlProvider>
      </body>
    </html>
  );
}
