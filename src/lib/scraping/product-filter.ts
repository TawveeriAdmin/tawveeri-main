/**
 * Filter to exclude non-tech products
 * Helps filter out books, food items, and other non-tech products
 */

/**
 * Check if a product is tech-related
 * Filters out books, food items, and other non-tech products
 */
export function isTechProduct(
  title: string, 
  brand: string | null, 
  category: string,
  additionalData?: { description?: string; url?: string; product_url?: string; [key: string]: any }
): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerBrand = brand?.toLowerCase() || '';
  const lowerDescription = additionalData?.description?.toLowerCase() || '';
  const url = additionalData?.url || additionalData?.product_url || '';
  const lowerUrl = url.toLowerCase();
  const combinedText = `${lowerTitle} ${lowerDescription} ${lowerUrl}`.toLowerCase();
  
  // Tech keywords in title (defined first since it's used in brand check)
  const techKeywords = [
    'iphone', 'ipad', 'macbook', 'imac', 'mac', 'airpods', 'apple watch',
    'galaxy', 'samsung', 'laptop', 'notebook', 'computer', 'pc', 'desktop',
    'tablet', 'smartphone', 'phone', 'mobile', 'headphone', 'earphone',
    'speaker', 'monitor', 'display', 'tv', 'television', 'camera', 'dslr',
    'gaming', 'mouse', 'keyboard', 'webcam', 'router', 'modem', 'printer',
    'scanner', 'projector', 'smartwatch', 'watch', 'fitness tracker',
    'charger', 'cable', 'adapter', 'hub', 'dock', 'ssd', 'hdd', 'ram',
    'processor', 'cpu', 'gpu', 'graphics card', 'motherboard', 'power supply',
    'playstation', 'xbox', 'nintendo', 'switch', 'ps5', 'ps4', 'xbox series',
    'drone', 'action camera', 'gopro', 'smart home', 'alexa', 'google home',
    'smart bulb', 'smart plug', 'security camera', 'ip camera', 'nas',
    'network', 'wifi', 'bluetooth', 'usb', 'type-c', 'thunderbolt', 'hdmi',
    'displayport', 'ethernet', 'wireless', 'wireless charger'
  ];
  
  // Tech brands (always tech)
  const techBrands = [
    'apple', 'samsung', 'huawei', 'xiaomi', 'sony', 'lg', 'hp', 'dell',
    'lenovo', 'asus', 'acer', 'msi', 'razer', 'logitech', 'microsoft',
    'google', 'oneplus', 'oppo', 'vivo', 'honor', 'motorola', 'nokia',
    'realme', 'canon', 'nikon', 'jbl', 'bose', 'anker', 'anker', 'steelseries',
    'corsair', 'hyperx', 'roccat', 'intel', 'amd', 'nvidia', 'corsair'
  ];
  
  // If brand is a tech brand, it's tech
  // BUT: Check if it's actually food (e.g., "Apple" brand but title says "fresh apple")
  if (techBrands.some(b => lowerBrand.includes(b))) {
    // Special case: "Apple" brand could be fruit if title has food indicators
    if (lowerBrand.includes('apple')) {
      const foodIndicators = ['fresh', 'organic', 'fruit', 'kg', 'per kg', 'red apple', 'green apple', 'ripe'];
      const hasFoodIndicator = foodIndicators.some(indicator => lowerTitle.includes(indicator));
      const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
      
      // If it has food indicators but no tech keywords, it's likely fruit
      if (hasFoodIndicator && !hasTechKeyword) {
        return false;
      }
    }
    return true;
  }
  
  // Check if title contains tech keywords
  if (techKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  
  // Tech categories
  const techCategories = [
    'laptop', 'smartphone', 'tablet', 'tv', 'audio', 'camera', 'gaming',
    'accessories', 'computer', 'electronics'
  ];
  
  if (techCategories.includes(category.toLowerCase())) {
    return true;
  }
  
  // Check for grocery/fruit categories in description, URL, or combined text
  // Amazon URLs often contain category paths like: /gp/product/.../ref=sr_1_1?dchild=1&keywords=apple&qid=...&sr=8-1
  // Or breadcrumb paths in the page
  const groceryCategories = [
    'grocery', 'fruits', 'vegetables', 'fresh fruits', 'fresh vegetables',
    'fruits & vegetables', 'produce', 'food', 'grocery/fruits',
    'grocery/fruits & vegetables', 'grocery/fruits & vegetables/fresh fruits',
    'fruits-vegetables', 'fresh-fruits', 'fresh-vegetables'
  ];
  const hasGroceryCategory = groceryCategories.some(cat => 
    combinedText.includes(cat) || 
    category.toLowerCase().includes(cat) ||
    lowerUrl.includes(cat.replace(/\s+/g, '-')) || // Check URL with hyphens
    lowerUrl.includes(cat.replace(/\s+/g, '/'))   // Check URL with slashes
  );
  
  if (hasGroceryCategory) {
    // Only allow if it has strong tech indicators
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    if (!hasTechKeyword) {
      return false;
    }
  }
  
  // Also check URL for grocery-related paths (Amazon often has /gp/product/.../dp/... with category info)
  const groceryUrlPatterns = [
    /grocery/i,
    /fruits/i,
    /vegetables/i,
    /fresh-fruits/i,
    /fresh-vegetables/i,
    /fruits-vegetables/i
  ];
  const hasGroceryUrl = groceryUrlPatterns.some(pattern => pattern.test(lowerUrl));
  if (hasGroceryUrl && !techKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return false;
  }
  
  // EARLY EXIT: If title has "apple" but NO tech keywords, exclude it UNLESS brand is clearly tech
  // This catches "ZOD Apple Royal Gala" and "ZOD Apple Green, SA, 1 Kg" early
  if (lowerTitle.includes('apple')) {
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    
    // If no tech keywords, check if it's likely fruit
    if (!hasTechKeyword) {
      // Check for weight units (kg, g, etc.)
      const hasWeight = /\b\d+\s*(kg|kilogram|g|gram|lb|pound)\b/i.test(lowerTitle);
      
      // Check for fruit varieties and food indicators
      const fruitVarieties = ['gala', 'royal', 'green', 'red', 'yellow', 'fuji', 'granny', 'honeycrisp', 'pink lady'];
      const foodIndicators = ['fresh', 'organic', 'ripe', 'crisp', 'sweet', 'sa,', 'sa ', 'per kg', 'per kilogram'];
      
      const hasFruitVariety = fruitVarieties.some(variety => lowerTitle.includes(variety));
      const hasFoodIndicator = foodIndicators.some(indicator => lowerTitle.includes(indicator));
      
      // If brand is NOT a tech brand (e.g., "ZOD" instead of "Apple"), and has fruit indicators, exclude
      const isTechBrand = techBrands.some(b => lowerBrand.includes(b));
      if (!isTechBrand && (hasWeight || hasFruitVariety || hasFoodIndicator)) {
        return false;
      }
      
      // Even if brand is tech, if it has weight + fruit indicators, exclude (e.g., "Apple 5kg" fruit)
      if (hasWeight && (hasFruitVariety || hasFoodIndicator)) {
        return false;
      }
      
      // Pattern match: "Brand Apple Variety" (e.g., "ZOD Apple Royal Gala")
      const brandApplePattern = /^[a-z]+\s+apple\s+[a-z]+/i.test(title.trim());
      if (brandApplePattern) {
        return false;
      }
    }
  }
  
  // Exclude non-tech keywords (if these are prominent, it's likely not tech)
  const nonTechKeywords = [
    'book', 'novel', 'story', 'magazine', 'journal', 'diary', 'notebook (paper)',
    'fresh apple', 'organic apple', 'red apple', 'green apple', 'apple fruit',
    'kg', 'kg.', 'per kg', 'per kilogram', 'fresh', 'organic', 'ripe',
    'food', 'snack', 'drink', 'beverage', 'fruit', 'fruits', 'vegetable', 'vegetables', 'grocery',
    'clothing', 'shirt', 'pants', 'shoes', 'fashion', 'apparel',
    'toy', 'game (board game)', 'puzzle', 'art supply', 'stationery',
    'produce', 'fresh produce', 'organic produce'
  ];
  
  // Strong non-tech indicators (if any of these appear, likely not tech)
  const strongNonTechIndicators = [
    'fresh apple', 'organic apple', 'red apple', 'green apple', 'apple fruit',
    'apple kg', 'apple per kg', 'apple per kilogram',
    'fresh fruits', 'organic fruits', 'fresh produce',
    'book about', 'story about', 'novel about'
  ];
  
  // Check for strong non-tech indicators first
  if (strongNonTechIndicators.some(indicator => lowerTitle.includes(indicator))) {
    // But allow if it's clearly tech (e.g., "Apple iPhone" should still pass)
    const hasStrongTechIndicator = techKeywords.some(keyword => 
      lowerTitle.includes(keyword) && keyword.length > 3 // Longer keywords are more specific
    );
    if (!hasStrongTechIndicator) {
      return false;
    }
  }
  
  // Check for food/weight indicators (kg, per kg, etc.) combined with fruit keywords
  const hasWeightIndicator = /\b\d+\s*(kg|kilogram|g|gram)\b/i.test(lowerTitle);
  const hasFruitKeyword = ['fruit', 'fruits', 'fresh', 'organic', 'produce'].some(kw => 
    lowerTitle.includes(kw)
  );
  
  if (hasWeightIndicator && hasFruitKeyword) {
    // If it has weight + fruit keywords, it's likely food
    // Only allow if it has strong tech indicators
    const hasStrongTechIndicator = techKeywords.some(keyword => 
      lowerTitle.includes(keyword) && (keyword.length > 4 || keyword === 'iphone' || keyword === 'ipad' || keyword === 'macbook')
    );
    if (!hasStrongTechIndicator) {
      return false;
    }
  }
  
  // If title is dominated by non-tech keywords, exclude it
  const nonTechMatches = nonTechKeywords.filter(keyword => 
    lowerTitle.includes(keyword)
  ).length;
  
  // If more than 1 non-tech keyword match and no tech keywords, exclude
  if (nonTechMatches > 1) {
    const techMatches = techKeywords.filter(keyword => 
      lowerTitle.includes(keyword)
    ).length;
    
    if (techMatches === 0) {
      return false;
    }
  }
  
  // Special case: "apple" alone or with food context should be excluded
  // But "Apple" brand products should pass (they have tech keywords)
  const isJustApple = /^apple\s*$/i.test(title.trim()) || 
                      /^apple\s+(fruit|fruits|kg|per|fresh|organic|red|green)/i.test(title);
  if (isJustApple) {
    // Only allow if it has tech keywords
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    if (!hasTechKeyword) {
      return false;
    }
  }
  
  // Aggressive check: If title contains "apple" but NO tech keywords, exclude it
  // This catches cases like "ZOD Apple Royal Gala" or "Apple Green 1 Kg"
  if (lowerTitle.includes('apple')) {
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    // If no tech keywords, check if it looks like fruit
    if (!hasTechKeyword) {
      // Check for fruit variety names and indicators
      const fruitVarieties = ['gala', 'royal gala', 'green', 'red', 'yellow', 'fuji', 'granny', 'honeycrisp', 'pink lady'];
      const fruitIndicators = [
        'gala', 'green', 'red', 'royal', 'kg', 'kilogram', 'fresh', 'organic',
        'fruit', 'fruits', 'produce', 'ripe', 'crisp', 'sweet', 'sa,', 'sa '
      ];
      
      const hasFruitVariety = fruitVarieties.some(variety => lowerTitle.includes(variety));
      const hasFruitIndicator = fruitIndicators.some(indicator => lowerTitle.includes(indicator));
      
      // If it has fruit variety or indicators, exclude it
      if (hasFruitVariety || hasFruitIndicator) {
        return false;
      }
      
      // Also exclude if it has weight units (kg, g) - likely food
      const hasWeight = /\b\d+\s*(kg|kilogram|g|gram)\b/i.test(lowerTitle);
      if (hasWeight) {
        return false;
      }
      
      // Exclude if title pattern matches "Brand Apple Variety" (e.g., "ZOD Apple Royal Gala")
      const brandApplePattern = /^[a-z]+\s+apple\s+[a-z]+/i.test(title.trim());
      if (brandApplePattern && !hasTechKeyword) {
        return false;
      }
    }
  }
  
  // Additional check: If title contains weight units (kg, g) and food keywords, exclude
  const hasWeightUnit = /\b\d+\s*(kg|kilogram|g|gram|lb|pound)\b/i.test(lowerTitle);
  const foodKeywords = ['fresh', 'organic', 'ripe', 'fruit', 'fruits', 'produce', 'grocery'];
  const hasFoodKeyword = foodKeywords.some(kw => lowerTitle.includes(kw));
  
  if (hasWeightUnit && hasFoodKeyword) {
    // Only allow if it has strong tech indicators (not just "apple" brand)
    const hasStrongTechKeyword = techKeywords.some(keyword => 
      lowerTitle.includes(keyword) && keyword.length > 4
    );
    if (!hasStrongTechKeyword) {
      return false;
    }
  }
  
  // Check for common fruit/food patterns
  const fruitPatterns = [
    /\b(red|green|yellow|fresh|organic)\s+apple/i,
    /\bapple\s+(red|green|yellow|fresh|organic|fruit|fruits)/i,
    /\bapple\s+\d+\s*(kg|kilogram|g|gram)/i,
    /\b\d+\s*(kg|kilogram|g|gram)\s+apple/i
  ];
  
  const matchesFruitPattern = fruitPatterns.some(pattern => pattern.test(lowerTitle));
  if (matchesFruitPattern) {
    // Only allow if it has tech keywords (not just brand)
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    if (!hasTechKeyword) {
      return false;
    }
  }
  
  // FINAL CHECK: If title has "apple" and no tech keywords, exclude by default (very aggressive)
  // This MUST be the last check before returning true
  if (lowerTitle.includes('apple')) {
    const hasTechKeyword = techKeywords.some(keyword => lowerTitle.includes(keyword));
    if (!hasTechKeyword) {
      // Default to excluding if it has "apple" without tech keywords
      // This catches edge cases that slipped through earlier checks
      console.log(`[Filter] Final check: Excluding "${title}" - has apple but no tech keywords`);
      return false;
    }
  }
  
  // Default: if we can't determine, include it (better to show than hide)
  return true;
}

/**
 * Filter products to only include tech-related items
 */
export function filterTechProducts<T extends { 
  name_en?: string; 
  name_ar?: string;
  title?: string;
  brand?: string | null; 
  category?: string;
  description_ar?: string | null;
  description_en?: string | null;
  product_url?: string;
  url?: string;
  [key: string]: any;
}>(
  products: T[]
): T[] {
  return products.filter(product => {
    // Support both name_en/name_ar (ScrapedProduct) and title (PythonProduct)
    const title = product.name_en || product.name_ar || product.title || '';
    const brand = product.brand || null;
    const category = product.category || '';
    const description = product.description_en || product.description_ar || 
                       (product as any).description || '';
    const url = product.product_url || product.url || (product as any).url || '';
    
    const isTech = isTechProduct(title, brand, category, { 
      description,
      url,
      product_url: url,
      ...product 
    });
    
    // Debug logging for ALL apple products (both included and excluded)
    if (title.toLowerCase().includes('apple')) {
      const hasTechKw = (product.name_en || product.name_ar || product.title || '').toLowerCase().includes('iphone') || 
                        (product.name_en || product.name_ar || product.title || '').toLowerCase().includes('macbook') ||
                        (product.name_en || product.name_ar || product.title || '').toLowerCase().includes('ipad');
      console.log(`[Filter] Apple product: "${title}" | Tech: ${isTech} | HasTechKW: ${hasTechKw} | Brand: ${brand} | Category: ${category}`);
      if (!isTech && !hasTechKw) {
        console.log(`[Filter] ⚠️  SHOULD BE EXCLUDED but isTech=${isTech} - This is a bug!`);
      }
    }
    
    return isTech;
  });
}

