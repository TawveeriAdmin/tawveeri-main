// src/lib/intelligence/observed-saving.ts — ADR-400.
// A saving percentage a customer sees is computed from the two prices the card shows —
// the current price and the highest price WE observed — never from a stored figure and
// never from a merchant's "was" price.
export function observedSavingPct(price: number, observedMax: number): number {
  if (!(observedMax > 0) || !(price >= 0) || observedMax <= price) return 0;
  return Math.round(((observedMax - price) / observedMax) * 100);
}
