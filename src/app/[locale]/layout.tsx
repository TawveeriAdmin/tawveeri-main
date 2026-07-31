import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SimpleIntlProvider } from '@/lib/simple-intl-provider';
import { buildAlternates, getBaseUrl, BRAND_OG_IMAGE } from '@/lib/seo/metadata';

const locales = ['ar', 'en'] as const;
import { Cairo } from 'next/font/google';
import { ThemeProvider } from '../providers/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { MultiStoreCartProvider } from '@/lib/cart/cart-context';
import { getNavigableCategories } from '@/lib/intelligence/navigable-categories';
import { NavigableCategoriesProvider } from '@/lib/intelligence/navigable-categories-context';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = getBaseUrl();

  return {
    title: {
      default: locale === 'ar'
        ? 'توفيري | منصة مقارنة أسعار الإلكترونيات'
        : 'Tawveeri | Electronics Price Comparison',
      template: locale === 'ar' ? '%s | توفيري' : '%s | Tawveeri',
    },
    description: locale === 'ar'
      ? 'قارن أسعار الإلكترونيات من أمازون ونون وجرير واكسترا والمنيع. أفضل العروض والتخفيضات في السعودية.'
      : 'Compare electronics prices from Amazon, Noon, Jarir, Extra & Almanea. Best deals in Saudi Arabia.',
    alternates: buildAlternates(''),
    openGraph: {
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      url: `${baseUrl}/${locale}`,
      // Site-wide default. Without this the homepage — the most-shared URL we have — rendered
      // a blank card everywhere. See BRAND_OG_IMAGE for why the dimensions are stated exactly.
      images: [{
        url: `${baseUrl}${BRAND_OG_IMAGE.path}`,
        width: BRAND_OG_IMAGE.width,
        height: BRAND_OG_IMAGE.height,
        alt: 'Tawveeri',
      }],
    },
    twitter: {
      // `summary`, not `summary_large_image`: the brand mark is square. Declaring the large
      // card for a square image is the mismatch that produced blank previews.
      card: 'summary',
      images: [`${baseUrl}${BRAND_OG_IMAGE.path}`],
    },
  };
}

// Brand font — single family for both Arabic & English per brand guidelines
const cairo = Cairo({
 weight: ['300', '400', '600', '700', '900'],
 subsets: ['latin', 'arabic'],
 variable: '--font-cairo',
 display: 'swap',
});

const extractNamespace = (
 payload: Record<string, unknown> | undefined,
 namespace: string
): Record<string, unknown> | undefined => {
 if (!payload || typeof payload !== 'object') return undefined;
 const nested = payload[namespace];
 if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
 return nested as Record<string, unknown>;
 }
 return payload;
};

// Removed generateStaticParams - next-intl plugin handles this

export default async function LocaleLayout({
 children,
 params,
}: {
 children: React.ReactNode;
 params: Promise<{ locale: string }>;
}) {
 // Await params (Next.js 15+ requirement)
 const { locale } = await params;

 // Validate locale
 if (!locales.includes(locale as (typeof locales)[number])) {
 notFound();
 }

 // Which categories may appear in navigation — measured live, never hardcoded (ADR-150).
 // Failure returns [] inside the helper, so a bad read hides the menu rather than
 // rendering a stale one.
 const navigableCategories = (await getNavigableCategories()).map(
 ({ key, comparable, labelAr, labelEn, query, emoji, slug }) => ({ key, comparable, labelAr, labelEn, query, emoji, slug }),
 );

 // Load messages directly with error handling
 let messages: Record<string, unknown> = {};
 try {
 const [common, landing, auth, products, dashboard, profile, storesList, deals, product, store, search, wishlist, compare, settings, notifications, admin, checkout, priceAlerts, cart, compareTranslations, couponsTranslations, agent] = await Promise.allSettled([
 import(`../../../messages/${locale}/common.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/landing.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/auth.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/products.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/dashboard.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/profile.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/stores.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/deals.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/product.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/store.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/search.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/wishlist.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/compare.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/settings.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/notifications.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/admin.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/checkout.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/priceAlerts.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/cart.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/compare.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/coupons.json`) as Promise<{ default: Record<string, unknown> }>,
 import(`../../../messages/${locale}/agent.json`) as Promise<{ default: Record<string, unknown> }>,
 ]);

 // Combine all successfully loaded messages with namespacing
 // Note: common.json has both top-level keys (app, nav, etc.) and a nested "common" object
 const commonMessages = common.status === 'fulfilled' && common.value?.default ? common.value.default : {};
 const commonNested = (commonMessages as Record<string, unknown>)?.common as Record<string, unknown> | undefined;
 const commonTopLevel = { ...(commonMessages as Record<string, unknown>) };
 delete commonTopLevel.common;
 const adminMessages = extractNamespace(
   admin.status === 'fulfilled' && admin.value?.default ? admin.value.default : undefined,
   'admin'
 );
 messages = {
 ...(commonTopLevel || {}), // Top-level keys from common.json (app, nav, button, etc.)
 ...(commonNested ? { common: commonNested } : {}), // Nested common object namespaced
 ...(landing.status === 'fulfilled' && landing.value?.default ? landing.value.default : {}),
 ...(auth.status === 'fulfilled' && auth.value?.default ? { auth: auth.value.default } : {}),
 ...(products.status === 'fulfilled' && products.value?.default ? { products: products.value.default } : {}),
 ...(dashboard.status === 'fulfilled' && dashboard.value?.default ? { dashboard: dashboard.value.default } : {}),
 ...(profile.status === 'fulfilled' && profile.value?.default ? { profile: profile.value.default } : {}),
 ...(storesList.status === 'fulfilled' && storesList.value?.default ? { stores: storesList.value.default } : {}),
 ...(deals.status === 'fulfilled' && deals.value?.default ? { deals: deals.value.default } : {}),
 ...(product.status === 'fulfilled' && product.value?.default ? { product: product.value.default } : {}),
 ...(store.status === 'fulfilled' && store.value?.default ? { store: store.value.default } : {}),
 ...(search.status === 'fulfilled' && search.value?.default ? { search: search.value.default } : {}),
 ...(wishlist.status === 'fulfilled' && wishlist.value?.default ? { wishlist: wishlist.value.default } : {}),
 ...(compare.status === 'fulfilled' && compare.value?.default ? { compare: compare.value.default } : {}),
 ...(settings.status === 'fulfilled' && settings.value?.default ? { settings: settings.value.default } : {}),
 ...(notifications.status === 'fulfilled' && notifications.value?.default ? { notifications: notifications.value.default } : {}),
 ...(adminMessages ? { admin: adminMessages } : {}),
 ...(checkout.status === 'fulfilled' && checkout.value?.default ? { checkout: checkout.value.default } : {}),
 ...(priceAlerts.status === 'fulfilled' && priceAlerts.value?.default ? { priceAlerts: priceAlerts.value.default } : {}),
 ...(cart.status === 'fulfilled' && cart.value?.default ? { cart: cart.value.default } : {}),
 ...(compareTranslations.status === 'fulfilled' && compareTranslations.value?.default ? { compare: compareTranslations.value.default } : {}),
 ...(couponsTranslations.status === 'fulfilled' && couponsTranslations.value?.default ? { coupons: couponsTranslations.value.default } : {}),
 ...(agent.status === 'fulfilled' && agent.value?.default ? { agent: agent.value.default } : {}),
 };

 if (Object.keys(messages).length === 0) {
 console.warn('No messages loaded, using empty messages object');
 }
 } catch (error) {
 console.error('Error loading messages:', error);
 // Fallback to empty messages object to prevent crash
 messages = {};
 }

 // Ensure messages is a plain object (serializable) for client-side navigation
 // This prevents issues with Chrome's strict serialization
 messages = JSON.parse(JSON.stringify(messages || {}));

 return (
 <div
 lang={locale}
 dir={locale === 'ar' ? 'rtl' : 'ltr'}
 className={`${cairo.variable} font-sans antialiased`}
 >
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
 {/* Live-derived category navigation (ADR-150). Measured server-side here so every
 page's header shows only categories that currently clear the rule — never a
 hardcoded list. Does not reorder any existing provider. */}
 <NavigableCategoriesProvider categories={navigableCategories}>
 {children}
 </NavigableCategoriesProvider>
 <Toaster />
 </AuthProvider>
 </MultiStoreCartProvider>
 </ThemeProvider>
 </SimpleIntlProvider>
 </div>
 );
}
