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
      const match = url.pathname.match(/-p-(\d+)(?:\?.*|#.*)?$/);

      if (match && match[1]) {
        const productId = match[1];

        if (/^\d{15}$/.test(productId)) {
          return `https://www.almanea.sa/en/product/p-${productId}`;
        }
      }

      return rawUrl.replace(url.origin, "https://www.almanea.sa");
    }

    // Amazon.sa: clean product URL to /dp/ASIN + affiliate tag
    if (
      storeName === "أمازون" ||
      storeName.toLowerCase() === "amazon" ||
      host.includes("amazon.sa")
    ) {
      const asinMatch =
        url.pathname.match(/\/dp\/([A-Z0-9]{10})/i) ||
        url.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);

      if (asinMatch && asinMatch[1]) {
        return `https://www.amazon.sa/dp/${asinMatch[1].toUpperCase()}?tag=tawveeri-21`;
      }

      url.searchParams.set("tag", "tawveeri-21");
      return url.toString();
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}