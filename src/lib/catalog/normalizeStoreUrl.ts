export function normalizeStoreUrl(
  storeName: string,
  rawUrl: string | null
): string | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    // Handle dev-almanea.com → almanea.sa
    if (host.includes("dev-almanea.com")) {
      // Extract product ID from -p-{id} at the end of pathname
      const match = url.pathname.match(/-p-(\d+)(?:\?.*|#.*)?$/);

      if (match && match[1]) {
        const productId = match[1];

        // Validate productId is 15 digits (Almanea standard)
        if (/^\d{15}$/.test(productId)) {
          return `https://www.almanea.sa/en/product/p-${productId}`;
        }
      }

      // Fallback: only replace the domain
      return rawUrl.replace(url.origin, "https://www.almanea.sa");
    }

    // Other stores: keep URL unchanged
    return url.toString();
  } catch {
    // Invalid URL: return as-is
    return rawUrl;
  }
}