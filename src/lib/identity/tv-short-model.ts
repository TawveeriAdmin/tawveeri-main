// src/lib/identity/tv-short-model.ts — TV short manufacturer-model evidence for the VERIFIER (research prototype, 2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// STATUS: SHADOW ONLY. Nothing in production imports this module. It exists so the TV short-model research
// (scripts/tps-analysis/tv-short-model-research.ts, docs/report/TV-SHORT-MODEL-IDENTITY-PROPOSAL-2026-10-04.md) and its
// regression fixtures run against ONE implementation. Wiring it into the signals job / compare page is a separate,
// founder-approved step.
//
// THE GAP (Wave 1, 2026-10-04): the TV plugin builds a model number from three lanes (payload → title → size-prefixed
// short code, ADR-177) but the verifier's callers read only `extractManufacturerModel(payload)`, which refuses anything
// shorter than 6 characters; and ADR-177's lane only reads a short code from a PAYLOAD field and then demands it verbatim
// in the title — so a code that sits in the title alone (Amazon "TCL 85T8D …") or in a structured field alone (Extra
// modelNumber "85C6K PRO") is invisible. Result: TCL 85T8D and 85C6K PRO merged.
//
// THE DESIGN (not "accept short strings"): evidence by SOURCE SEMANTICS, then a naming-convention test.
//   lane D — a short code DECLARED in a structured manufacturer-intent field (mpn / modelNumber / model_number). The generic
//            `model` field is never read here: measured on the live catalogue it is a truncation ("85T"), a whole title, a
//            retailer fragment or a spec at amazon / jarir / noon / alnakheelk (74 %, 100 %, junk, 100 % non-model).
//   lane T — a size-prefixed short code READ FROM THE TITLE under ADR-177's three conditions (shape, self-consistency with the
//            parsed screen size, not a prefix of a longer token), with technology / unit words refused (65QLED, 144HZ, 55INCH).
// Both lanes feed the verifier as a DECLARED model; the verifier's own rules then decide: a stated conflict rejects, a code on
// one side only stays Review, agreeing codes match.
import { isStoreInternalIdentifier } from './store-identifiers';

export const norm = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Trap classes — tokens that satisfy a loose "short alphanumeric" shape but are not a manufacturer model. Labelled by RULE. */
const TRAPS: { cls: string; re: RegExp }[] = [
  { cls: 'retailer_asin', re: /^B0[A-Z0-9]{8}$/ },
  { cls: 'retailer_noon_code', re: /^N\d{6,10}[A-Z]$/ },
  { cls: 'retailer_numeric_sku', re: /^\d{5,}$/ },
  { cls: 'size', re: /^\d{2,3}(INCH|IN)$/ },
  { cls: 'refresh_rate', re: /^\d{2,3}HZ$/ },
  { cls: 'resolution', re: /^(4K|8K|UHD|FHD|HD|2160P|1080P)$/ },
  { cls: 'panel_or_marketing', re: /^(QLED|NEOQLED|OLED|MINILED|MINI|LED|QNED|ULED|CRYSTAL|GOOGLE|ANDROID|SMART|DOLBY|ATMOS|VIDAA|WEBOS|TIZEN|HDR10|HDR10PLUS|AI)$/ },
];
export const trapClass = (normalizedToken: string): string | null => TRAPS.find((t) => t.re.test(normalizedToken))?.cls ?? null;

/** Structured fields a retailer fills with the manufacturer's model on PURPOSE. `model` is deliberately absent. */
export const DECLARED_FIELDS = ['mpn', 'modelNumber', 'model_number'] as const;
const VARIANT_PRO = /^[A-Z0-9-]+ (PRO|PLUS|MAX|ULTRA|EVO|LITE)$/;
const VARIANT_WORDS = new Set(['PRO', 'PLUS', 'MAX', 'ULTRA', 'EVO', 'LITE']);

/** Lane D. A short code declared in a structured manufacturer field, or null. */
export function declaredShortModel(payload: Record<string, unknown>, title: string): string | null {
  for (const f of DECLARED_FIELDS) {
    const raw = payload[f];
    if (typeof raw !== 'string') continue;
    const v = raw.trim().toUpperCase();
    if (v.length < 4 || v.length > 22) continue;
    const t = norm(v);
    if (!/\d/.test(t) || !/[A-Z]/.test(t) || trapClass(t) || isStoreInternalIdentifier(v)) continue;
    if (norm(title) === t) continue; // the field just repeats the title
    if (v.includes(' ') && !VARIANT_PRO.test(v)) continue; // free text, not one model
    return v;
  }
  return null;
}

const SIZE_PREFIXED = /^(\d{2,3})([A-Z][A-Z0-9]{1,3})$/;
/** Alphabetic tails that make a size-prefixed token a technology / unit word rather than a series code. */
const TECH_TAIL = /^(QLED|OLED|QNED|ULED|MINI|MINILED|NEO|INCH|IN|HZ|SMART|LED|UHD|FHD|TV)$/;

export function screenSizeOf(title: string): number | null {
  const m = /(\d{2,3})\s?(?:"|”|inch|بوصة|انش|إنش)/i.exec(title);
  return m ? Number(m[1]) : null;
}

/** Why a size-prefixed-looking title word is refused — null when it is accepted. Exposed so the research can count refusals. */
export function titleWordRefusal(word: string, words: string[], size: number | null): string | null {
  const m = SIZE_PREFIXED.exec(word);
  if (!m) return 'not_size_prefixed_shape';
  if (size == null) return 'no_parsed_size';
  if (Number(m[1]) !== size) return 'size_mismatch';
  if (TECH_TAIL.test(m[2]) || /^\d+HZ$/.test(word)) return 'technology_word';
  if (words.some((o) => o.length > word.length && o.startsWith(word))) return 'prefix_of_longer_token';
  return null;
}

export const titleWords = (title: string): string[] =>
  title.toUpperCase().split(/[\s,()/|–—:;"'،]+/).map((w) => w.replace(/[.,،؛:]+$/, '')).filter(Boolean);

/** Lane T. A size-prefixed short code read from the title, with an immediately following variant word kept ("85C6K PRO"). */
export function titleShortModel(title: string): string | null {
  const size = screenSizeOf(title);
  if (size == null) return null;
  const words = titleWords(title);
  for (let i = 0; i < words.length; i++) {
    if (titleWordRefusal(words[i], words, size) !== null) continue;
    return VARIANT_WORDS.has(words[i + 1] ?? '') ? `${words[i]} ${words[i + 1]}` : words[i];
  }
  return null;
}

/** The model the verifier would be given: the TV plugin's own derivation first, then lane D, then lane T. */
export function composeVerifierModel(pluginModel: string | null, payload: Record<string, unknown>, title: string): string | null {
  return pluginModel ?? declaredShortModel(payload, title) ?? titleShortModel(title);
}
