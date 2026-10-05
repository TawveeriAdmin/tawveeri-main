// src/lib/identity/page-evidence.ts — what a merchant PRODUCT PAGE states about the manufacturer model (evidence capture, 2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// STATUS: PURE PARSER. No network, no database, no identity decision. It turns a page's HTML into raw, provenance-carrying statements
//   { field, value }
// that the capture job stores APPEND-ONLY (`tps_listing_evidence`) and that `extractModelEvidence` reads as ADDITIONAL, measured-trust
// evidence. It never rewrites a key and never decides sameness: evidence ingestion and identity mutation are separate stages.
//
// Why it exists: the evidence-first dossiers (2026-10-04) found 15 of 69 disputed listings whose PAGE states a manufacturer code our
// payload lacks — Jarir "Manufacturer No", Extra/Almanea JSON-LD `mpn`, Amazon "Model Number" in the product-details table.
//
// FIELD NAMES (`page.*`) are the trust-matrix keys; a field is trusted only after it is MEASURED (page-field-trust.ts), never by name:
//   page.jsonld.mpn / .sku / .model / .gtin   — schema.org Product JSON-LD
//   page.label.manufacturer_no                — Jarir's visible "Manufacturer No" label
//   page.script.modelNumber                   — Extra's inline `"modelNumber":"…"`
//   page.table.<slug>                         — a th/td (or bold-label) detail row: model_number, item_model_number, model_name, manufacturer_part_number, part_number
export interface PageEvidenceItem { field: string; value: string }

const decode = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const squash = (s: string): string => decode(s.replace(/<[^>]*>/g, ' ')).replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const slug = (k: string): string => k.toLowerCase().replace(/[‎‏‪-‮:]/g, '').replace(/\s+/g, ' ').trim().replace(/ /g, '_');

/** Model-looking detail rows worth recording (value is stored raw; classification happens in the evidence layer). */
const ROW_KEYS = new Set(['model_number', 'item_model_number', 'model_name', 'model', 'manufacturer_part_number', 'part_number', 'mpn', 'manufacturer_no', 'manufacturer_number']);
const MAX_VALUE = 80;
const clean = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = squash(String(v));
  return s && s.length <= MAX_VALUE ? s : null;
};

function jsonLdProducts(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const visit = (n: unknown) => {
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    const t = o['@type'];
    if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) out.push(o);
    if (o['@graph']) visit(o['@graph']);
    if (o.hasVariant) visit(o.hasVariant);
  };
  while ((m = re.exec(html))) { try { visit(JSON.parse(m[1].trim())); } catch { /* malformed JSON-LD is ignored, never guessed at */ } }
  return out;
}

export function parsePageEvidence(html: string): PageEvidenceItem[] {
  const out: PageEvidenceItem[] = [];
  const seen = new Set<string>();
  const add = (field: string, v: unknown) => {
    const value = clean(v); if (!value) return;
    const k = `${field}\u0001${value.toUpperCase()}`; if (seen.has(k)) return;
    seen.add(k); out.push({ field, value });
  };

  // 1) schema.org Product JSON-LD — only the FIRST product's own statements (variants/related products are other items).
  const products = jsonLdProducts(html);
  const p = products[0];
  if (p) {
    add('page.jsonld.mpn', p.mpn);
    add('page.jsonld.sku', p.sku);
    add('page.jsonld.model', typeof p.model === 'string' ? p.model : (p.model as Record<string, unknown> | undefined)?.name);
    for (const g of ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14']) add('page.jsonld.gtin', p[g]);
  }

  // 2) Jarir: "Manufacturer No <b class="ar-number">65Q71Q</b>"
  const jr = /Manufacturer\s*(?:No\.?|Number)\s*(?:<[^>]+>\s*)*([A-Za-z0-9][A-Za-z0-9\-/. ]{2,40}?)\s*</i.exec(html);
  if (jr) add('page.label.manufacturer_no', jr[1]);

  // 3) Extra: inline `"modelNumber":"65S7N"` (also `modelNumber="65S7N"`)
  const ex = /["']?modelNumber["']?\s*[:=]\s*["']([^"']{3,40})["']/.exec(html);
  if (ex) add('page.script.modelNumber', ex[1]);

  // 4) Detail rows: <th>Model Number</th><td>65Q72Q</td> (Amazon product details), and bold-label bullets "Item model number : X".
  const rowRe = /<th[^>]*>([\s\S]{1,80}?)<\/th>\s*<td[^>]*>([\s\S]{1,200}?)<\/td>/gi;
  let r: RegExpExecArray | null;
  while ((r = rowRe.exec(html))) { const k = slug(squash(r[1])); if (ROW_KEYS.has(k)) add(`page.table.${k}`, r[2]); }
  const bulletRe = /<span[^>]*class="[^"]*a-text-bold[^"]*"[^>]*>\s*([\s\S]{1,60}?)\s*<\/span>\s*<span[^>]*>([\s\S]{1,120}?)<\/span>/gi;
  while ((r = bulletRe.exec(html))) { const k = slug(squash(r[1])); if (ROW_KEYS.has(k)) add(`page.table.${k}`, r[2]); }

  return out;
}

/** GS1 check-digit validation (GTIN-8/12/13/14). A 10-digit "gtin" (Almanea "8508110000" is a customs code) or a failed checksum is NOT a GTIN. */
export function isValidGtin(v: string): boolean {
  const d = v.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length) || d !== v.trim()) return false;
  const digits = d.split('').map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
