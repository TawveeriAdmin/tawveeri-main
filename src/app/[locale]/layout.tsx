import { notFound } from 'next/navigation';
import { SimpleIntlProvider } from '@/lib/simple-intl-provider';

const locales = ['ar', 'en'] as const;
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from '../providers/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { MultiStoreCartProvider } from '@/lib/cart/cart-context';

// English font
const inter = Inter({
 weight: ['400', '500', '600', '700', '800'],
 subsets: ['latin'],
 variable: '--font-inter',
 display: 'swap',
});

// Arabic font
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
 weight: ['400', '500', '600', '700'],
 subsets: ['arabic'],
 variable: '--font-ibm-plex-arabic',
 display: 'swap',
});

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

 // Load messages directly with error handling
 let messages: Record<string, unknown> = {};
 try {
 const [common, landing, auth, products, dashboard, profile, storesList, deals, product, store, search, wishlist, compare, settings, notifications, admin, checkout, priceAlerts, cart, compareTranslations] = await Promise.allSettled([
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
 ]);

 // Combine all successfully loaded messages with namespacing
 // Note: common.json has both top-level keys (app, nav, etc.) and a nested "common" object
 const commonMessages = common.status === 'fulfilled' && common.value?.default ? common.value.default : {};
 const commonNested = (commonMessages as Record<string, unknown>)?.common as Record<string, unknown> | undefined;
 const commonTopLevel = { ...(commonMessages as Record<string, unknown>) };
 delete commonTopLevel.common;
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
 ...(admin.status === 'fulfilled' && admin.value?.default ? { admin: admin.value.default } : {}),
 ...(checkout.status === 'fulfilled' && checkout.value?.default ? { checkout: checkout.value.default } : {}),
 ...(priceAlerts.status === 'fulfilled' && priceAlerts.value?.default ? { priceAlerts: priceAlerts.value.default } : {}),
 ...(cart.status === 'fulfilled' && cart.value?.default ? { cart: cart.value.default } : {}),
 ...(compareTranslations.status === 'fulfilled' && compareTranslations.value?.default ? { compare: compareTranslations.value.default } : {}),
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
 className={`${inter.variable} ${ibmPlexArabic.variable} ${
 locale === 'ar' ? 'font-sans-ar' : 'font-sans'
 } antialiased`}
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
 {children}
 <Toaster />
 </AuthProvider>
 </MultiStoreCartProvider>
 </ThemeProvider>
 </SimpleIntlProvider>
 </div>
 );
}
