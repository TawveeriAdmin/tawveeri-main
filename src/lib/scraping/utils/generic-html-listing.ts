import * as cheerio from 'cheerio';
import type { ScrapedProduct } from '../base/types';
import { determineCategory } from './category-utils';

const KNOWN_BRANDS = [
  'apple', 'samsung', 'lg', 'sony', 'hisense', 'tcl', 'haier', 'midea',
  'huawei', 'xiaomi', 'honor', 'lenovo', 'hp', 'dell', 'asus', 'acer',
  'playstation', 'nintendo', 'xbox', 'bose', 'jbl', 'anker', 'canon', 'nikon',
];

function normalizeUrl(url: string, base: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  try {
    return new URL(normalizedPath, normalizedBase).href;
  } catch {
    return `${normalizedBase}${normalizedPath}`;
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).replace(/[^\d.]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * WooCommerce-style markup: sale price in `ins`, original in `del`, amounts in `bdi`.
 * Reading the whole `.price` node concatenates multiple formatted SAR amounts (e.g. 5,429 + 5,429 → 54,295,429).
 */
function extractWooStylePriceTexts(
  priceScope: cheerio.Cheerio<unknown>,
): { currentText: string; originalText: string } | null {
  const ins = priceScope.find('ins .woocommerce-Price-amount bdi, ins .woocommerce-Price-amount, ins bdi').first();
  const del = priceScope.find('del .woocommerce-Price-amount bdi, del .woocommerce-Price-amount, del bdi').first();
  if (ins.length) {
    return {
      currentText: ins.text().trim(),
      originalText: del.length ? del.text().trim() : '',
    };
  }
  const singleBdi = priceScope.find('.woocommerce-Price-amount bdi').first();
  if (singleBdi.length) {
    return { currentText: singleBdi.text().trim(), originalText: '' };
  }
  const singleAmount = priceScope.find('.woocommerce-Price-amount').first();
  if (singleAmount.length) {
    return { currentText: singleAmount.text().trim(), originalText: '' };
  }
  return null;
}

function extractBrand(title: string, brandFromSource: string | null): string {
  const source = (brandFromSource || '').trim();
  if (source && source.toLowerCase() !== 'unknown') {
    return source;
  }

  const lowerTitle = title.toLowerCase();
  const matched = KNOWN_BRANDS.find((brand) => lowerTitle.includes(brand));
  if (!matched) return 'Unknown';
  if (matched === 'lg') return 'LG';
  if (matched === 'hp') return 'HP';
  return matched.charAt(0).toUpperCase() + matched.slice(1);
}

function extractModel(title: string, brand: string | null): string {
  let model = title;
  if (brand) {
    model = model.replace(new RegExp(brand, 'gi'), '').trim();
  }

  const modelPatterns = [
    /\b(iPhone|iPad|MacBook|Galaxy|Xiaomi|Huawei)\s+([A-Z0-9\s]+)/i,
    /\b([A-Z]{2,}\d+[A-Z]*)/,
    /\b(\d{2,}[A-Z]*)/,
  ];

  for (const pattern of modelPatterns) {
    const match = model.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  const words = model.split(' ').slice(0, 3).join(' ');
  return words || title;
}

function extractSkuFromUrl(url: string): string | null {
  if (!url) return null;

  const matches = [
    url.match(/\/p\/([a-z0-9_-]{4,})/i),
    url.match(/\/product\/([a-z0-9_-]{4,})/i),
    url.match(/[?&](sku|id|pid)=([a-z0-9_-]{4,})/i),
  ];

  for (const match of matches) {
    if (!match) continue;
    return match[2] || match[1] || null;
  }

  return null;
}

function parseNextData(html: string, baseUrl: string): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const nextDataScript = $('script#__NEXT_DATA__').first();
  if (!nextDataScript.length) return [];

  try {
    const payload = JSON.parse(nextDataScript.html() || '{}') as Record<string, unknown>;
    const pageProps = (payload.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined;
    const candidates = [
      pageProps?.products,
      pageProps?.searchResults,
      (pageProps?.searchResults as Record<string, unknown> | undefined)?.products,
      pageProps?.catalog,
      (pageProps?.catalog as Record<string, unknown> | undefined)?.products,
      pageProps?.items,
      pageProps?.productList,
    ];

    const records = candidates.find(Array.isArray) as Array<Record<string, unknown>> | undefined;
    if (!records || records.length === 0) return [];

    return records
      .map((item) => parseObjectProduct(item, baseUrl))
      .filter((item): item is ScrapedProduct => item !== null);
  } catch {
    return [];
  }
}

function parseJsonLdListing(html: string, baseUrl: string): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
      const entries = Array.isArray(data) ? data : [data];

      for (const entry of entries) {
        const type = String(entry['@type'] || '');
        if (type === 'Product') {
          const parsed = parseObjectProduct(entry, baseUrl);
          if (parsed) products.push(parsed);
          continue;
        }

        if (type === 'ItemList' && Array.isArray(entry.itemListElement)) {
          for (const item of entry.itemListElement as Array<Record<string, unknown>>) {
            const nested = (item.item as Record<string, unknown>) || item;
            const parsed = parseObjectProduct(nested, baseUrl);
            if (parsed) products.push(parsed);
          }
        }
      }
    } catch {
      /* ignore */
    }
  });

  return products;
}

function parseHtmlProducts(html: string, sourceUrl: string, baseUrl: string): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];

  const selectors = [
    '.product-item',
    '.product-card',
    '.product',
    '[data-product-id]',
    '.products-grid li',
    '.product-list-item',
    'li.product',
    "a[href*='/product/']",
    "a[href*='/p/']",
    '.woocommerce-LoopProduct-link',
  ];

  for (const selector of selectors) {
    const cards = $(selector);
    if (!cards.length) continue;

    cards.each((_, el) => {
      const parsed = parseHtmlProduct($, $(el), sourceUrl, baseUrl);
      if (parsed) products.push(parsed);
    });

    if (products.length > 0) break;
  }

  return products;
}

function parseHtmlProduct(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<unknown>,
  sourceUrl: string,
  baseUrl: string,
): ScrapedProduct | null {
  const title = card
    .find('.product-name, .product-title, .woocommerce-loop-product__title, h2, h3, [class*="title"]')
    .first()
    .text()
    .trim();

  if (!title) return null;

  const link =
    card.find("a[href*='/product/'], a[href*='/p/'], a[href*='/dp/'], a[href]").first().attr('href') || '';
  const productUrl = normalizeUrl(link, sourceUrl);

  const priceBlock = card.find('.price').first();
  let price: number | null = null;
  let originalPrice: number | null = null;

  const woo = priceBlock.length ? extractWooStylePriceTexts(priceBlock) : null;
  if (woo) {
    price = parsePrice(woo.currentText);
    originalPrice = woo.originalText ? parsePrice(woo.originalText) : null;
  }
  if (!price || price <= 0) {
    const priceText = card
      .find('.woocommerce-Price-amount bdi, .woocommerce-Price-amount, .product-price, .special-price, [class*="price"]')
      .first()
      .text();
    price = parsePrice(priceText);
  }
  if (!price || price <= 0) return null;

  if (originalPrice == null || originalPrice <= 0) {
    const originalPriceText = card
      .find('del .woocommerce-Price-amount bdi, .old-price, .original-price, .regular-price, del')
      .first()
      .text();
    originalPrice = parsePrice(originalPriceText);
  }

  const image =
    card.find('img').first().attr('src') ||
    card.find('img').first().attr('data-src') ||
    card.find('img').first().attr('data-lazy-src') ||
    null;

  const sku =
    card.attr('data-product-id') ||
    card.attr('data-sku') ||
    card.find('[data-product-id]').attr('data-product-id') ||
    extractSkuFromUrl(productUrl);

  const brandText = card.find('.brand, .product-brand, [class*="brand"]').first().text().trim();
  const brand = extractBrand(title, brandText || null);

  const outOfStock = card.text().toLowerCase().includes('out of stock');
  const isDeal = Boolean(originalPrice && originalPrice > price);

  return {
    name_ar: title,
    name_en: title,
    brand,
    model: extractModel(title, brand),
    sku,
    current_price: price,
    original_price: originalPrice,
    availability: outOfStock ? 'out_of_stock' : 'in_stock',
    product_url: productUrl,
    image_urls: image ? [normalizeUrl(image, baseUrl)] : [],
    specifications: {},
    category: determineCategory(title),
    description_ar: null,
    description_en: null,
    is_deal: isDeal,
  };
}

function parseObjectProduct(item: Record<string, unknown>, baseUrl: string): ScrapedProduct | null {
  const title = String(item.name || item.title || '').trim();
  if (!title) return null;

  const sku = String(item.sku || item.id || item.product_id || '').trim() || null;
  const pricesWithTax = item.prices_with_tax as Record<string, unknown> | undefined;
  const offers = item.offers as Record<string, unknown> | undefined;
  const priceData = item.price_data as Record<string, unknown> | undefined;

  const regularPrice = toNumber(
    item.price || pricesWithTax?.price || pricesWithTax?.original_price ||
      offers?.price || priceData?.current,
  );

  const discountedPrice = toNumber(
    pricesWithTax?.discounted_price || item.special_price ||
      item.sale_price || item.discounted_price || priceData?.discounted,
  );

  const price = (discountedPrice && regularPrice && discountedPrice < regularPrice)
    ? discountedPrice
    : (regularPrice || discountedPrice);
  if (!price || price <= 0) return null;

  const originalPrice = (discountedPrice && regularPrice && discountedPrice < regularPrice)
    ? regularPrice
    : toNumber(
        item.original_price || pricesWithTax?.original_price ||
          offers?.highPrice || priceData?.original,
      );

  const rewriteUrl = stringFromUnknown(item.rewrite_url);
  const href = String(item.url || item.product_url || item.link || rewriteUrl || '').trim();
  const productUrl = normalizeUrl(href, baseUrl);

  const image =
    stringFromUnknown(item.image) ||
    stringFromUnknown(item.image_url) ||
    stringFromUnknown(item.thumbnail) ||
    stringFromUnknown(item.thumbnail_url);

  const brand = extractBrand(
    title,
    stringFromUnknown(item.brand) ||
      stringFromUnknown((item.brand as Record<string, unknown> | undefined)?.name),
  );

  const availabilityRaw = String(
    item.availability || (item.offers as Record<string, unknown> | undefined)?.availability || 'in_stock',
  ).toLowerCase();
  const availability = (
    availabilityRaw.includes('outofstock') ||
    availabilityRaw.includes('out_of_stock') ||
    availabilityRaw.includes('sold_out')
  )
    ? 'out_of_stock'
    : 'in_stock';

  const isDeal = Boolean(originalPrice && originalPrice > price);

  return {
    name_ar: title,
    name_en: title,
    brand,
    model: extractModel(title, brand),
    sku,
    current_price: price,
    original_price: originalPrice,
    availability,
    product_url: productUrl,
    image_urls: image ? [normalizeUrl(image, baseUrl)] : [],
    specifications: {},
    category: determineCategory(title),
    description_ar: null,
    description_en: null,
    is_deal: isDeal,
  };
}

/**
 * Parse a category/search listing page into products (shared by search + cron store scrapers).
 */
export function parseGenericHtmlListing(html: string, pageUrl: string, baseUrl: string): ScrapedProduct[] {
  const fromNext = parseNextData(html, baseUrl);
  if (fromNext.length > 0) return fromNext;

  const fromLd = parseJsonLdListing(html, baseUrl);
  if (fromLd.length > 0) return fromLd;

  return parseHtmlProducts(html, pageUrl, baseUrl);
}

function extractText($: cheerio.CheerioAPI, selector: string): string | null {
  const element = $(selector).first();
  return element.text().trim() || null;
}

function extractAttr($: cheerio.CheerioAPI, selector: string, attr: string): string | null {
  return $(selector).first().attr(attr)?.trim() || null;
}

function parseJsonLdProductDetail(data: Record<string, unknown>): ScrapedProduct | null {
  try {
    const title = String(data.name || '').trim();
    if (!title) return null;

    const offers = (data.offers || {}) as Record<string, unknown>;
    const price = toNumber(offers.price || offers.lowPrice);
    if (!price) return null;

    const imageUrl = (
      typeof data.image === 'string' ? data.image : (data.image as Record<string, unknown>)?.url
    ) as string | undefined;
    const brand = String((data.brand as Record<string, unknown> | undefined)?.name || extractBrand(title, null));

    const availability = offers.availability === 'https://schema.org/OutOfStock' ? 'out_of_stock' : 'in_stock';

    return {
      name_ar: title,
      name_en: title,
      brand,
      model: extractModel(title, brand),
      sku: (data.sku as string) || null,
      current_price: price,
      original_price: null,
      availability,
      product_url: String(data.url || ''),
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category: determineCategory(title),
      description_ar: null,
      description_en: (data.description as string) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a product detail page (price refresh / single-URL scrape).
 */
export function parseGenericProductDetail(html: string, productUrl: string, baseUrl: string): ScrapedProduct | null {
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]');
  let ldProduct: ScrapedProduct | null = null;
  jsonLd.each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}') as Record<string, unknown>;
      if (data['@type'] === 'Product') {
        ldProduct = parseJsonLdProductDetail(data);
      }
    } catch { /* ignore */ }
  });
  if (ldProduct) {
    ldProduct.product_url = productUrl;
    ldProduct.category = determineCategory(ldProduct.name_en);
    return ldProduct;
  }

  const title =
    extractText($, 'h1.product-name, h1.product-title, h1.page-title, h1.product-name-title, h1') || '';
  if (!title) return null;

  const priceScope = $('.product .price, p.price, .summary .price, .entry-summary .price').first();
  let currentPrice: number | null = null;
  let originalPrice: number | null = null;

  const woo = priceScope.length ? extractWooStylePriceTexts(priceScope) : null;
  if (woo) {
    currentPrice = parsePrice(woo.currentText);
    originalPrice = woo.originalText ? parsePrice(woo.originalText) : null;
  }
  if (!currentPrice || currentPrice <= 0) {
    const priceText =
      extractText($, '[itemprop="price"]') ||
      (priceScope.length
        ? priceScope.find('.woocommerce-Price-amount bdi').first().text().trim()
        : '') ||
      extractText($, '.product-price .current, .price-current, .special-price') ||
      '';
    currentPrice = parsePrice(priceText);
  }
  if (!currentPrice || currentPrice <= 0) return null;

  if (originalPrice == null || originalPrice <= 0) {
    const origText =
      extractText($, '.product-price .was, .old-price, .regular-price, del .woocommerce-Price-amount bdi, del, .strike-through') ||
      '';
    originalPrice = origText ? parsePrice(origText) : null;
  }

  const imageUrl =
    extractAttr($, '.product-gallery img, .product-image img, .pdp-image img, img[itemprop="image"]', 'src') ||
    extractAttr($, '.product-gallery img, .product-image img', 'data-src');

  const brandText = extractText($, '.product-brand, .brand, [itemprop="brand"]');
  const brand = brandText || extractBrand(title, null);

  const outOfStock =
    $('.out-of-stock, .sold-out, [itemprop="availability"]').text().toLowerCase().includes('out') ||
    html.toLowerCase().includes('out of stock');

  return {
    name_ar: title,
    name_en: title,
    brand,
    model: extractModel(title, brand),
    sku: null,
    current_price: currentPrice,
    original_price: originalPrice,
    availability: outOfStock ? 'out_of_stock' : 'in_stock',
    product_url: productUrl,
    image_urls: imageUrl ? [normalizeUrl(imageUrl, baseUrl)] : [],
    specifications: {},
    category: determineCategory(title),
    description_ar: null,
    description_en: extractText($, '.product-description, .description, [itemprop="description"]'),
    is_deal: Boolean(originalPrice && originalPrice > currentPrice),
  };
}
