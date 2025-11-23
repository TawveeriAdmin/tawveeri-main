// Server-side translation helper for async server components
export async function getServerTranslations(locale: string) {
  try {
    const [
      common,
      landing,
      auth,
      products,
      dashboard,
      profile,
      storesList,
      deals,
      product,
      store,
      search,
      wishlist,
      compare,
      settings,
      notifications,
      admin,
    ] = await Promise.allSettled([
      import(`../../messages/${locale}/common.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/landing.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/auth.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/products.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/dashboard.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/profile.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/stores.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/deals.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/product.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/store.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/search.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/wishlist.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/compare.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/settings.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/notifications.json`) as Promise<{ default: Record<string, unknown> }>,
      import(`../../messages/${locale}/admin.json`) as Promise<{ default: Record<string, unknown> }>,
    ]);

    const messages = {
      ...(common.status === 'fulfilled' && common.value?.default ? common.value.default : {}),
      ...(landing.status === 'fulfilled' && landing.value?.default ? landing.value.default : {}),
      ...(auth.status === 'fulfilled' && auth.value?.default ? auth.value.default : {}),
      ...(products.status === 'fulfilled' && products.value?.default ? products.value.default : {}),
      ...(dashboard.status === 'fulfilled' && dashboard.value?.default ? dashboard.value.default : {}),
      ...(profile.status === 'fulfilled' && profile.value?.default ? profile.value.default : {}),
      ...(storesList.status === 'fulfilled' && storesList.value?.default ? storesList.value.default : {}),
      ...(deals.status === 'fulfilled' && deals.value?.default ? deals.value.default : {}),
      ...(product.status === 'fulfilled' && product.value?.default ? product.value.default : {}),
      ...(store.status === 'fulfilled' && store.value?.default ? store.value.default : {}),
      ...(search.status === 'fulfilled' && search.value?.default ? search.value.default : {}),
      ...(wishlist.status === 'fulfilled' && wishlist.value?.default ? wishlist.value.default : {}),
      ...(compare.status === 'fulfilled' && compare.value?.default ? compare.value.default : {}),
      ...(settings.status === 'fulfilled' && settings.value?.default ? settings.value.default : {}),
      ...(notifications.status === 'fulfilled' && notifications.value?.default ? notifications.value.default : {}),
      ...(admin.status === 'fulfilled' && admin.value?.default ? admin.value.default : {}),
    };

    return (key: string): string => {
      const keys = key.split('.');
      let value: any = messages;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key;
        }
      }
      return typeof value === 'string' ? value : key;
    };
  } catch (error) {
    console.error('Error loading server translations:', error);
    return (key: string) => key;
  }
}

