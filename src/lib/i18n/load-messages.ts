// Message loading for `SimpleIntlProvider`, extracted verbatim from `[locale]/layout.tsx` when
// the HTML shell moved up to the root layout (which has no route param and therefore reads the
// locale from the request). Behaviour is unchanged on purpose: same namespaces, same
// `Promise.allSettled` tolerance, same spreading rules.
//
// THE SPREADING RULES ARE NOT COSMETIC — they decide which keys exist:
//   • `common.json` has BOTH top-level keys (app, nav, button…) and a nested `common` object.
//     The top level is spread flat; the nested object becomes the `common` namespace.
//   • `landing.json` is spread flat as well, so its keys are top-level.
//   • `admin.json` is unwrapped by `extractNamespace` because it nests under `admin`.
//   • everything else is namespaced by filename.
// A failed import degrades to a missing namespace, never to a crash — a page with an untranslated
// string is recoverable; a page that does not render is not.

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

export async function loadMessages(locale: string): Promise<Record<string, unknown>> {
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
    messages = {};
  }

  // Ensure messages is a plain object (serializable) for client-side navigation.
  // This prevents issues with Chrome's strict serialization.
  return JSON.parse(JSON.stringify(messages || {}));
}
