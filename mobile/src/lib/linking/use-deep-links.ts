/**
 * Deep Link Handler
 *
 * Handles incoming deep links from:
 * - Custom scheme: tawveeri://product/{slug}
 * - Universal links: https://tawveeri.com/product/{slug}
 * - Notification taps (handled separately in push.ts)
 *
 * Expo Router handles most routing automatically via file-based routes.
 * This hook intercepts URLs that don't map directly to a route file
 * (e.g., web URLs from universal links) and remaps them.
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

/**
 * Map of web URL paths to mobile app routes.
 * Universal links (https://tawveeri.com/...) need to be translated
 * to mobile routes since the file structure differs from the web app.
 */
function routeFromWebUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Strip locale prefix: /ar/product/... → /product/...
    const stripped = path.replace(/^\/(ar|en)/, '');

    // Product detail: /product/{slug} or /products/{slug}
    const productMatch = stripped.match(/^\/products?\/([^/]+)$/);
    if (productMatch) {
      return `/(stack)/product/${productMatch[1]}`;
    }

    // Store detail: /stores/{slug}
    const storeMatch = stripped.match(/^\/stores?\/([^/]+)$/);
    if (storeMatch) {
      return `/(stack)/store/${storeMatch[1]}`;
    }

    // Auth callback
    if (stripped.startsWith('/auth/callback')) {
      return null; // Let Expo Router handle via auth/callback.tsx
    }

    // Direct mappings
    const directRoutes: Record<string, string> = {
      '/deals': '/(tabs)/deals',
      '/search': '/(tabs)/search',
      '/wishlist': '/(stack)/wishlist',
      '/notifications': '/(stack)/notifications',
      '/price-alerts': '/(stack)/price-alerts',
      '/settings': '/(stack)/settings',
      '/stores': '/(stack)/stores',
      '/compare': '/(stack)/compare',
    };

    if (directRoutes[stripped]) {
      return directRoutes[stripped];
    }

    return null;
  } catch {
    return null;
  }
}

export function useDeepLinkHandler() {
  useEffect(() => {
    // Handle URL that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle URLs while app is already running (warm start)
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);
}

function handleUrl(url: string) {
  // Only intercept https:// universal links
  // tawveeri:// custom scheme links are handled by Expo Router automatically
  if (!url.startsWith('https://')) return;

  const route = routeFromWebUrl(url);
  if (route) {
    // Small delay to ensure navigation is ready
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  }
}
