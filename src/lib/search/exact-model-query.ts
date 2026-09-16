/** Preserve every region/variant suffix. This recognizes a whole model-code query,
 * not a product family, prose, capacity, or an instruction to strip punctuation. */
export function exactModelQuery(query: string): string | null {
  const value = query.trim().toUpperCase();
  return value.length >= 8 && value.length <= 40 && /^[A-Z0-9]+(?:[-/][A-Z0-9]+)*$/.test(value)
    && /[A-Z]/.test(value) && (/\d/.test(value) || /^[A-Z]+(?:-[A-Z]+)?\/[A-Z]{2,4}$/.test(value)) ? value : null;
}
