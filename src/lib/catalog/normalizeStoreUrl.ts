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

    // Jarir: normalize any non-Saudi GCC market (qa/ae/bh/kw) to the Saudi storefront (sa-en).
    // Jarir shares the product slug + SKU (jpm####) across all GCC markets; only the market
    // prefix and the price differ. Verified live: the sa-en page resolves to the exact same
    // product at the KSA price (e.g. qa-ar/vivo-y04-...jpm1588 → sa-en/... = "vivo Y04 128GB
    // Gold — Jarir Bookstore KSA", 439 SAR). Preserves childSku so the exact variant is kept.
    if (
      storeName === "جرير" ||
      storeName === "مكتبة جرير" ||
      storeName.toLowerCase() === "jarir" ||
      host.includes("jarir.com")
    ) {
      const m = url.pathname.match(/^\/([a-z]{2})-([a-z]{2})\/(.+)$/i);
      if (m && m[1].toLowerCase() !== "sa") {
        const childSku = url.searchParams.get("childSku");
        const q = childSku ? `?childSku=${encodeURIComponent(childSku)}` : "";
        return `https://www.jarir.com/sa-en/${m[3]}${q}`;
      }
      return url.toString();
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}