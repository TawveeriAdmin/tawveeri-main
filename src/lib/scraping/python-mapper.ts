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
  
  // Map image URLs
  const imageUrls: string[] = [];
  if (pythonProduct.image_url) {
    imageUrls.push(pythonProduct.image_url);
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

