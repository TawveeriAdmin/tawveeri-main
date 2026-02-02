import type { ScrapedProduct } from './base/types';
import type { PythonProduct } from './python-types';

/**
 * Extract model from product title
 * Simple extraction - tries to find model number or uses title as model
 */
function extractModel(title: string, brand: string | null): string {
  // Remove brand from title if present
  let model = title;
  if (brand) {
    model = model.replace(new RegExp(brand, 'gi'), '').trim();
  }
  
  // Try to find model patterns (e.g., "iPhone 15 Pro", "Galaxy S24", "MacBook Pro M3")
  const modelPatterns = [
    /\b(iPhone|iPad|MacBook|Galaxy|Xiaomi|Huawei)\s+([A-Z0-9\s]+)/i,
    /\b([A-Z]{2,}\d+[A-Z]*)/, // Pattern like "M3", "S24", "A15"
    /\b(\d{2,}[A-Z]*)/, // Pattern like "15", "24 Pro"
  ];
  
  for (const pattern of modelPatterns) {
    const match = model.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  // If no pattern found, use first few words after brand removal
  const words = model.split(' ').slice(0, 3).join(' ');
  return words || title;
}

/**
 * Determine category from title and keywords
 */
function determineCategory(title: string): string {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('laptop') || lowerTitle.includes('notebook') || lowerTitle.includes('macbook')) {
    return 'laptop';
  }
  if (lowerTitle.includes('smartphone') || lowerTitle.includes('iphone') || lowerTitle.includes('phone') || lowerTitle.includes('galaxy')) {
    return 'smartphone';
  }
  if (lowerTitle.includes('tablet') || lowerTitle.includes('ipad')) {
    return 'tablet';
  }
  if (lowerTitle.includes('tv') || lowerTitle.includes('television')) {
    return 'tv';
  }
  if (lowerTitle.includes('headphone') || lowerTitle.includes('earphone') || lowerTitle.includes('airpod') || lowerTitle.includes('speaker')) {
    return 'audio';
  }
  if (lowerTitle.includes('camera')) {
    return 'camera';
  }
  if (lowerTitle.includes('gaming') || lowerTitle.includes('playstation') || lowerTitle.includes('xbox') || lowerTitle.includes('nintendo')) {
    return 'gaming';
  }
  if (lowerTitle.includes('watch') || lowerTitle.includes('smartwatch')) {
    return 'accessories';
  }
  
  return 'accessories'; // Default category
}

/**
 * Map Python product format to TypeScript ScrapedProduct format
 */
export function mapPythonProductToScrapedProduct(
  pythonProduct: PythonProduct
): ScrapedProduct {
  const title = pythonProduct.title || 'No title';
  const brand = pythonProduct.brand || 'Unknown';
  const model = extractModel(title, brand);
  const category = determineCategory(title);
  
  // Map availability
  let availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' = 'in_stock';
  if (!pythonProduct.in_stock) {
    availability = 'out_of_stock';
  }
  
  // Map image URLs - clean and validate
  const imageUrls: string[] = [];
  if (pythonProduct.image_url) {
    let imageUrl = pythonProduct.image_url.trim();
    
    // Clean up Jarir image URLs (they sometimes have issues)
    if (pythonProduct.store === 'jarir') {
      // Remove query parameters that might cause issues (but keep essential ones)
      const urlParts = imageUrl.split('?');
      const baseUrl = urlParts[0];
      const params = urlParts[1] || '';
      
      // Keep width/height params if present, remove others
      if (params) {
        const widthMatch = params.match(/width=(\d+)/);
        const heightMatch = params.match(/height=(\d+)/);
        const cleanParams: string[] = [];
        if (widthMatch) cleanParams.push(`width=${widthMatch[1]}`);
        if (heightMatch) cleanParams.push(`height=${heightMatch[1]}`);
        imageUrl = cleanParams.length > 0 ? `${baseUrl}?${cleanParams.join('&')}` : baseUrl;
      } else {
        imageUrl = baseUrl;
      }
      
      // Ensure it's a full URL
      if (!imageUrl.startsWith('http')) {
        if (imageUrl.startsWith('//')) {
          imageUrl = `https:${imageUrl}`;
        } else {
          imageUrl = `https://www.jarir.com${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
      }
      
      // Handle Cloudflare CDN URLs - extract the actual asset URL
      // Exact pattern: https://www.jarir.com/cdn-cgi/image/fit=contain,width=380,height=380,quality=100,metadata=none/https://ak-asset.jarir.com/akeneo-prod/asset/9/a/f/2/9af2f5164fe5d6189b418b5e16580762ac20620d_635221.jpg
      if (imageUrl.includes('cdn-cgi/image')) {
        // Extract the actual image URL embedded in the CDN URL
        // Pattern: cdn-cgi/image/.../https://ak-asset.jarir.com/akeneo-prod/asset/...
        const assetMatch = imageUrl.match(/https:\/\/ak-asset\.jarir\.com\/akeneo-prod\/asset\/([^\s?]+)/);
        if (assetMatch) {
          imageUrl = `https://ak-asset.jarir.com/akeneo-prod/asset/${assetMatch[1]}`;
          // Remove any query params
          if (imageUrl.includes('?')) {
            imageUrl = imageUrl.split('?')[0];
          }
          console.log(`[Jarir Mapper] ✓ Extracted asset URL from CDN: ${imageUrl.substring(0, 100)}`);
        } else {
          // Fallback: try to extract /asset/ path
          const fallbackMatch = imageUrl.match(/\/asset\/([^\s?]+)/);
          if (fallbackMatch) {
            imageUrl = `https://www.jarir.com/asset/${fallbackMatch[1]}`;
            if (imageUrl.includes('?')) {
              imageUrl = imageUrl.split('?')[0];
            }
            console.log(`[Jarir Mapper] Extracted asset URL from CDN (fallback): ${imageUrl.substring(0, 100)}`);
          }
        }
      }
      
      // Filter out placeholder images
      const placeholderKeywords = [
        'placeholder', 'no-image', 'not-available', 'default',
        'missing', 'empty', 'spacer', 'blank', 'assets/placeholder',
        'transparent', 'loading', 'lazy-placeholder'
      ];
      
      if (placeholderKeywords.some(keyword => imageUrl.toLowerCase().includes(keyword))) {
        // Skip placeholder images
        imageUrl = '';
      }
      
      // Filter out brand logos (Jarir returns brand logos instead of product images sometimes)
      // Brand logos are usually: ak-asset.jarir.com/akeneo-prod/catalog/[hash]_brandname.png
      // BUT akeneo-prod/asset/ URLs are ACTUAL product images - don't filter those!
      const isBrandLogo = (
        imageUrl.includes('akeneo-prod/catalog') &&  // Only catalog, not asset!
        imageUrl.toLowerCase().endsWith('.png') &&
        (imageUrl.includes('_apple.png') ||
         imageUrl.includes('_samsung.png') ||
         imageUrl.includes('_huawei.png') ||
         imageUrl.includes('_sony.png') ||
         imageUrl.includes('_xiaomi.png') ||
         imageUrl.includes('_techpick.png') ||
         /_[a-z]+\.png$/i.test(imageUrl))
      );
      
      // akeneo-prod/asset/ URLs are actual product images, not brand logos
      const isProductImage = imageUrl.includes('akeneo-prod/asset');
      
      if (isBrandLogo && !isProductImage) {
        // Skip brand logos - these are not product images
        imageUrl = '';
        console.log(`[Jarir Mapper] Skipped brand logo: ${pythonProduct.image_url?.substring(0, 80) || 'N/A'}`);
      }
      
      // Debug logging for Jarir images
      if (!imageUrl && pythonProduct.image_url) {
        console.log(`[Jarir Mapper] Skipped image: ${pythonProduct.image_url?.substring(0, 80) || 'N/A'}`);
      } else if (imageUrl) {
        console.log(`[Jarir Mapper] Using image URL: ${imageUrl.substring(0, 100)}`);
      }
    }
    
    if (imageUrl && !imageUrl.includes('placeholder') && imageUrl.length > 10) {
      imageUrls.push(imageUrl);
    } else if (pythonProduct.store === 'jarir' && pythonProduct.image_url) {
      // Debug: Log why image was rejected
      console.log(`[Jarir Mapper] Rejected image URL: ${pythonProduct.image_url.substring(0, 100)} | Final: ${imageUrl?.substring(0, 50) || 'empty'}`);
    }
  }
  
  // Determine if it's a deal
  const isDeal = pythonProduct.discount !== null && pythonProduct.discount !== undefined;
  
  // Check for free delivery (Prime or Express badges)
  const isFreeDelivery = pythonProduct.badges?.includes('Prime') || 
                         pythonProduct.badges?.includes('Express') || 
                         false;
  
  return {
    name_ar: title, // Use same title for both languages (can be enhanced later)
    name_en: title,
    brand: brand,
    model: model,
    sku: pythonProduct.sku,
    current_price: pythonProduct.price || 0,
    original_price: pythonProduct.original_price,
    availability: availability,
    product_url: pythonProduct.url,
    image_urls: imageUrls,
    specifications: {}, // Python scripts don't extract specs from search results
    category: category as any, // Type assertion needed
    description_ar: null,
    description_en: null,
    is_deal: isDeal,
    is_free_delivery: isFreeDelivery,
    // Store information for adapter
    store: pythonProduct.store,
    store_name: pythonProduct.store_name,
  } as ScrapedProduct & { store?: string; store_name?: string };
}

