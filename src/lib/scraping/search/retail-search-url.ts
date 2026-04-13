/** Very short / junk queries break some merchant CDNs (404/empty). */
export function safeSearchToken(raw: string): string {
  const q = raw.trim();
  if (q.length < 2 || q === '.' || q === '..') return 'phone';
  return q;
}

export const qenc = (q: string) => encodeURIComponent(safeSearchToken(q));

/** Latin slug for AliExpress `/w/wholesale-{slug}.html` (Arabic-only queries → `phone`). */
export function aliexpressWholesaleSlug(raw: string): string {
  const t = safeSearchToken(raw);
  const latin = t
    .replace(/[^\x00-\x7F]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return latin || 'phone';
}
