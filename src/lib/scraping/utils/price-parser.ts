/**
 * Parse price from text string
 * Handles Arabic numerals, currency symbols, and various formats
 */
export function parsePrice(priceText: string, currency: string = 'SAR'): number | null {
  if (!priceText) return null;

  try {
    // Normalize price text
    const normalized = normalizePriceText(priceText);
    
    // Extract number
    const number = extractNumber(normalized);
    
    if (number === null) return null;

    // Validate price
    if (!validatePrice(number)) return null;

    return number;
  } catch (error) {
    console.error('Error parsing price:', error);
    return null;
  }
}

/**
 * Normalize price text by removing currency symbols and formatting
 */
export function normalizePriceText(text: string): string {
  if (!text) return '';

  // Remove common currency symbols and text
  let normalized = text
    .replace(/ر\.س|SAR|ريال|ريال سعودي/gi, '')
    .replace(/[،,]/g, '') // Remove Arabic and English commas
    .replace(/\s+/g, '') // Remove spaces
    .trim();

  // Convert Arabic numerals to English (٠-٩ -> 0-9)
  normalized = convertArabicNumerals(normalized);

  return normalized;
}

/**
 * Convert Arabic numerals to English numerals
 */
function convertArabicNumerals(text: string): string {
  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };

  return text.split('').map(char => arabicToEnglish[char] || char).join('');
}

/**
 * Extract number from text
 */
export function extractNumber(text: string): number | null {
  if (!text) return null;

  // Match decimal number (supports both . and , as decimal separator)
  const match = text.match(/(\d+[.,]?\d*)/);
  
  if (!match) return null;

  // Replace comma with dot for decimal
  const numberStr = match[1].replace(',', '.');

  const number = parseFloat(numberStr);

  return isNaN(number) ? null : number;
}

/**
 * Validate price range
 */
export function validatePrice(price: number): boolean {
  // Price must be positive
  if (price <= 0) return false;

  // Price must be reasonable (not more than 1,000,000 SAR)
  if (price > 1000000) return false;

  return true;
}

