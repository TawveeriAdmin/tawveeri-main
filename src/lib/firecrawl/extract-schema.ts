/**
 * Firecrawl v2 JSON extraction schema for `/scrape` (formats array).
 * @see https://docs.firecrawl.dev/features/llm-extract
 */
export const PRODUCT_LIST_JSON_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      description: 'Products visible in listing or search results grids only.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: ['string', 'null'],
            description:
              'Full product name as shown. Must not be a URL or site address. Return null if not found.',
          },
          price_text: {
            type: ['string', 'null'],
            description:
              'Exact price text as shown (e.g. with SAR, SR, ر.س, or ريال). Return null if not found.',
          },
          product_url: {
            type: ['string', 'null'],
            description:
              'Absolute HTTPS URL to the product detail page. Return null if not found.',
          },
          image_url: {
            type: ['string', 'null'],
            description:
              'Absolute HTTPS URL of the main product image. Return null if not found.',
          },
        },
      },
    },
  },
} as const;

export const PRODUCT_LIST_EXTRACT_PROMPT =
  'Extract up to 5 distinct electronics or appliances products from product listing cards or search results. Ignore site navigation, menus, headers, footers, and cookie banners. Never use a bare URL or page address as a product title—only human-readable product names.';
