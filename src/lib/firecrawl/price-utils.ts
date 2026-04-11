export function normalizeArabicDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[٫٬،]/g, ',');
}

export function extractNumericPriceFromText(priceText: string): number {
  const normalized = normalizeArabicDigits(priceText || '');
  const candidates = normalized.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  if (candidates.length === 0) return 0;

  const numbers = candidates
    .map((token) => Number(token.replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numbers.length === 0) return 0;
  return Math.min(...numbers);
}
