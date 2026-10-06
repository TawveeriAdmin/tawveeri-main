// src/lib/search/model-token-gate.ts — a model code in the query is the identity of the request (2026-10-06).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED (production, external review 2026-10-06):
//   «Samsung WA21A8376GV OR غسالة سامسونج 21 كيلو» → 0   «غسالة سامسونج 21 كيلو» → 0   «Philips XU2100» → 0   but «XU2100» alone → 1
//   «XU2100 مكنسة» → a DIFFERENT, dearer record (1,799) with the 869 Amazon offer hidden
//   «ECOVACS DEEBOT T50 PRO OMNI» → 82 results, none containing T50 (fans, chargers, a watch)
// Two defects, one cause: the Arabic/descriptive words decided the category and were all REQUIRED, while the one token that actually names the
// product (the model code) was just another word — and a code that matches nothing was silently replaced by whatever shared «PRO» and «OMNI».
//
// Rules (deterministic, no price, no LLM):
//   STRONG model token (≥6 chars, letters AND ≥3 digits, e.g. WA21A8376GV, XU2100, 75QNED93A6A, QA65S90HAEXSA)  → the query is reduced to it for
//     retrieval (the other words describe it; they must not veto it), and the canonical lookup is by model-number PREFIX so a region suffix the
//     shopper did not type (/YL, /ZA, -AMAQ) does not hide the product.
//   WEAK code (a short letters+digits token, e.g. T50, N30, S24, Q70, A54)  → every result must carry it as a WHOLE token (T50 is not T500);
//     when nothing does, the honest answer is «we do not have this model», not a grid of look-alikes.
// Families that are specs or product lines rather than model codes (RTX4060, iPhone15, DDR5, PS5…) are never treated as codes.
import { normalizeArabic } from './arabic-normalize';

const NOT_A_MODEL_FAMILY = /^(RTX|GTX|RX|GT|IPHONE|IPAD|AIRPODS|MACBOOK|GALAXY|PIXEL|REDMI|POCO|XBOX|PS|DDR|LPDDR|SSD|HDD|NVME|USB|HDMI|WIFI|WI|BT|LTE|OLED|QLED|UHD|FHD|AMOLED|ANDROID|IOS|WINDOWS|WIN|CORE|RYZEN|SNAPDRAGON|EXYNOS|DIMENSITY|APPLE|SERIES|WATCH|BUDS)\d/i;
const UNIT_SUFFIX = /^\d+(GB|TB|MB|INCH|IN|BTU|HZ|MAH|KG|G|L|W|V|MP|NM|PA|ML|CM|MM|K|PCS|PC)$/i;

const STRONG = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{4,}(?:[/-][A-Z0-9]+)*$/;
const WEAK = /^[A-Z]{1,3}\d{2,4}[A-Z]?$/;

const clean = (t: string): string => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const digits = (t: string): number => (t.match(/\d/g) || []).length;

function candidateTokens(query: string): string[] {
  return (query || '').split(/\s+/).map(clean).filter(Boolean).filter((t) => /^[\x00-\x7F]+$/.test(t)).map((t) => t.toUpperCase());
}

/** The first STRONG model token of the query (upper-case, as typed incl. any suffix), or null. */
export function strongModelToken(query: string): string | null {
  for (const t of candidateTokens(query)) {
    if (t.length < 6 || t.length > 40 || NOT_A_MODEL_FAMILY.test(t) || UNIT_SUFFIX.test(t)) continue;
    if (STRONG.test(t) && digits(t) >= 3 && /[A-Z]/.test(t)) return t;
  }
  return null;
}

/** Whole-token codes the query REQUIRES, lower-case, suffix-free (the part before the first «/» or «-»). Strong and weak both count. */
export function requiredCodeTokens(query: string): string[] {
  const out = new Set<string>();
  const strong = strongModelToken(query);
  if (strong) out.add(strong.split(/[/-]/)[0].toLowerCase());
  for (const t of candidateTokens(query)) {
    if (NOT_A_MODEL_FAMILY.test(t) || UNIT_SUFFIX.test(t)) continue;
    if (WEAK.test(t)) out.add(t.toLowerCase());
  }
  return [...out];
}

const tokenSet = (text: string): Set<string> => new Set(normalizeArabic(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));

/** True when every required code is present as a whole token somewhere in the product's names / identity key / model. */
export function carriesCodes(texts: Array<string | null | undefined>, codes: string[]): boolean {
  if (!codes.length) return true;
  const have = tokenSet(texts.filter(Boolean).join(' '));
  return codes.every((c) => have.has(c));
}

/** Model-number prefix patterns for a strong token: exact, then the region-suffix forms. PostgREST `or` clause body. */
export function modelNumberPrefixFilter(token: string): string {
  const m = token.toUpperCase().replace(/[^A-Z0-9/-]/g, '');
  return `model_number.eq.${m},model_number.like.${m}/%,model_number.like.${m}-%`;
}
