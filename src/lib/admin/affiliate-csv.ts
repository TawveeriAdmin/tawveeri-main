// Minimal CSV parsing for the Affiliate Reconciliation importer (ADR-213).
// No new dependency: Amazon/Noon-style exports are plain comma-separated with optional
// double-quoted fields (RFC 4180 subset) — a hand-rolled parser is sufficient and avoids
// pulling in a library for something this small. Contract: docs/AFFILIATE_RECONCILIATION_CONTRACT.md.
import { createHash } from 'crypto';

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  // Normalize line endings, strip a UTF-8 BOM if present, drop blank trailing lines.
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

// Canonical fields our schema needs — the admin maps each to a detected CSV header on
// first upload of a given `source`. Only trackingId/asin/itemName/state are required;
// everything else degrades gracefully to null rather than rejecting the row.
export const CANONICAL_FIELDS = [
  'trackingId', 'asinOrSku', 'itemName', 'orderDate', 'shipDate',
  'quantity', 'price', 'commissionAmount', 'state', 'currency',
] as const;
export type CanonicalField = typeof CANONICAL_FIELDS[number];
export type ColumnMapping = Partial<Record<CanonicalField, string>>;

/**
 * Affiliate Money Proof mission (2026-09-10), §6/§10 — timezone-safety fix: the previous
 * implementation (`new Date(raw).toISOString().slice(0,10)`) round-trips a DATE-ONLY value
 * (no time-of-day meaning) through JS's local-timezone-dependent Date parsing, then back to
 * UTC — a well-known bug class that can shift the calendar date by ±1 day depending on the
 * server's runtime timezone offset relative to whatever offset (if any) the source string
 * implied. A YYYY-MM-DD string is now used VERBATIM, with no Date object involved at all —
 * no timezone conversion can occur on a value that's already the exact calendar date. Only
 * genuinely ambiguous formats (e.g. "09/15/2026", "Sep 15, 2026") fall back to Date parsing,
 * and that parsing explicitly reads UTC Y/M/D components rather than trusting toISOString's
 * local-to-UTC conversion.
 */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const stripped = String(raw).replace(/[^0-9.\-]/g, '');
  // Guard against non-numeric input (e.g. "n/a") stripping down to "" — Number("") is 0,
  // which would silently fabricate a zero price/commission instead of reporting UNAVAILABLE.
  if (stripped === '' || stripped === '-' || stripped === '.') return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

// A report's own status text is taken verbatim and mapped to our closed state set —
// never inferred beyond what the source states (Reconciliation Contract).
const STATE_ALIASES: Record<string, string> = {
  shipped: 'SHIPPED', dispatched: 'SHIPPED',
  ordered: 'ORDERED', pending: 'ORDERED',
  cancelled: 'CANCELLED', canceled: 'CANCELLED',
  returned: 'RETURNED', refunded: 'RETURNED',
};

// Affiliate Money Proof mission (2026-09-10), §6/§10 — currency-handling fix: the
// `affiliate_conversions.currency` column (schema, migration 30) was never populated by
// this normalizer at all, so every future imported row would silently carry `currency:
// null` on a financial record. Both real merchants in scope today (Amazon.sa Associates,
// Noon's Saudi affiliate program) report in SAR — no foreign-currency conversion is
// fabricated here, this is the merchant's own actual reporting currency. A future
// merchant reporting in a different currency can override it via the same column-mapping
// mechanism as every other field (CANONICAL_FIELDS now includes 'currency').
const DEFAULT_CURRENCY = 'SAR';

export interface NormalizedRow {
  tracking_id_raw: string | null;
  sub_id: string | null;
  asin_or_sku: string | null;
  item_name: string | null;
  order_date: string | null;
  ship_date: string | null;
  quantity: number | null;
  price: number | null;
  commission_amount: number | null;
  currency: string;
  state: string;
  rejected: boolean;
  rejectReason?: string;
}

export function normalizeRow(row: Record<string, string>, mapping: ColumnMapping): NormalizedRow {
  const get = (field: CanonicalField) => (mapping[field] ? row[mapping[field]!] : undefined);
  const trackingId = get('trackingId')?.trim() || null;
  const itemName = get('itemName')?.trim() || null;
  const rawState = get('state')?.trim().toLowerCase() || '';
  const state = STATE_ALIASES[rawState] || (rawState ? rawState.toUpperCase() : null);
  const currency = get('currency')?.trim().toUpperCase() || DEFAULT_CURRENCY;

  if (!itemName && !trackingId) {
    return {
      tracking_id_raw: trackingId, sub_id: null, asin_or_sku: null, item_name: null,
      order_date: null, ship_date: null, quantity: null, price: null, commission_amount: null,
      currency, state: 'UNKNOWN', rejected: true, rejectReason: 'missing both trackingId and itemName',
    };
  }

  return {
    tracking_id_raw: trackingId,
    // sub_id is our own opaque click id (see src/lib/providers/link.ts) — a report only
    // carries it back if the network echoes the sub-tag verbatim, which we can't assume
    // without a real export to check against (Reconciliation Contract stop boundary).
    sub_id: trackingId,
    asin_or_sku: get('asinOrSku')?.trim() || null,
    item_name: itemName,
    order_date: parseDate(get('orderDate')),
    ship_date: parseDate(get('shipDate')),
    quantity: parseNumber(get('quantity')),
    price: parseNumber(get('price')),
    commission_amount: parseNumber(get('commissionAmount')),
    currency,
    state: state || 'ORDERED',
    rejected: false,
  };
}
