/**
 * F-005 constraint gates — deterministic, pure, title-evidence-only.
 *
 * WHY THIS FILE EXISTS (measured live on production 2026-09-29, `59b3a53c`):
 *   Q09 «تلفزيون سامسونج ٥٥ بوصة أقل من ٣٠٠٠» returned a COMPUTER MONITOR
 *        ("Samsung 55\" 4K 144Hz Monitor") at rank 4 of 8 inside a TV query.
 *   Q10 «Samsung WW90T554DAN» (a washing-machine model number) returned 95 results,
 *        top-10 being earbuds, phone screen films, monitors and a microwave — zero
 *        washing machines, and no honest "we don't carry it" answer.
 *   Q11 «ايفون 17 برو 256» ranked "iPhone 17 Pro **Max** 256GB" FIRST and the plain
 *        "iPhone 17 256GB" above a correct "iPhone 17 Pro 256GB" — a Commercial
 *        Variant leak: Pro, Pro Max and base are three different variants.
 *
 * DESIGN RULES (each one is a decision, not an accident):
 *
 * 1. POSITIVE CONFLICT ONLY. A candidate is excluded only when its own title carries
 *    evidence that positively CONTRADICTS the query's stated constraint. A candidate
 *    that simply says nothing is never excluded — "unknown is not the same as wrong",
 *    the rule every other strong-signal gate in `route.ts` already follows
 *    (see `applyFuelTypeFilter`'s comment there).
 *
 * 2. TITLE TEXT ONLY — NEVER the `products.category` column. Measured on production
 *    the same day: of the rows whose title is washer-shaped, 801 are `appliance`,
 *    132 `accessories`, 44 `kitchen`, 25 `tablet`, 16 `tv` and 2 `monitor`; nine
 *    Samsung washing machines are filed under `accessories` and two under `tv`.
 *    The column is too corrupt to gate on, in either direction. (Fixing the column
 *    is a separate, larger data problem and is NOT attempted here.)
 *
 * 3. NO RECALL LOSS FOR HONEST LISTINGS. Every rule below was replayed against the
 *    live Q09/Q11 result sets before being written: notably the genuine Samsung TV
 *    titled «سامسونج شاشة UHD 55 بوصة – سلسلة DU7000 … UA55DU7000UXSA» names NO TV
 *    noun at all (only «شاشة» = "screen"), so the monitor rule deliberately keys on
 *    the English standalone word "monitor" / an explicit computer-or-gaming-screen
 *    Arabic phrase — never on the ambiguous «شاشة» alone, which both TVs and
 *    monitors use.
 */

// ── Shared normalization ────────────────────────────────────────────────────────

/** Uppercased, non-alphanumerics stripped — so "WW90T554DAN", "ww90-t554 dan" and
 *  "WW90T554DAN/YL" all compare on the same footing. Arabic letters are preserved. */
export function normalizeAlnum(text: string): string {
  return (text || '').toUpperCase().replace(/[^0-9A-Z؀-ۿ]/g, '');
}

function lower(text: string): string {
  return (text || '').toLowerCase();
}

// ── 1. TV query vs computer monitor (Q09) ───────────────────────────────────────

/** Unambiguous TV nouns. «شاشة» is deliberately absent: it means "screen" and is used
 *  by genuine TVs and genuine monitors alike. */
const TV_NOUN_RE = /تلفزيون|تلفاز|تليفزيون|\btv\b|\btelevision\b/i;

/** Unambiguous computer-monitor signals. English "monitor" as a standalone word, or an
 *  Arabic phrase that names the computer/gaming context explicitly. A bare «شاشة» never
 *  qualifies (see the file header). */
const MONITOR_SIGNAL_RE = /\bmonitor\b|\bmonitors\b|شاشة\s*(?:كمبيوتر|حاسوب|العاب|ألعاب|قيمنق|جيمنج)|شاشه\s*(?:كمبيوتر|حاسوب|العاب|ألعاب)/i;

/**
 * True when this candidate positively contradicts a TV query: it names itself a
 * computer monitor AND names no TV noun anywhere. A listing that says both (e.g. a
 * "Smart TV Monitor" hybrid) is KEPT — the conflict is not unambiguous.
 */
export function hasConflictingMonitorSignal(nameAr?: string | null, nameEn?: string | null): boolean {
  const text = `${nameAr || ''} ${nameEn || ''}`;
  if (TV_NOUN_RE.test(text)) return false;
  return MONITOR_SIGNAL_RE.test(text);
}

// ── 2. Model-number query (Q10) ─────────────────────────────────────────────────

/** Tokens that look like a manufacturer model code rather than a word or a plain number:
 *  at least 2 letters AND at least 2 digits, length >= 6. "WW90T554DAN" and
 *  "UA55U8000FUXSA" qualify; "iPhone", "2025", "4K", "256GB", "55" do not. */
export function extractStrongModelToken(query: string): string | null {
  const rawTokens = (query || '').split(/[\s,،/|]+/).filter(Boolean);
  for (const raw of rawTokens) {
    const token = normalizeAlnum(raw);
    if (token.length < 6) continue;
    const letters = (token.match(/[A-Z]/g) || []).length;
    const digits = (token.match(/[0-9]/g) || []).length;
    if (letters >= 2 && digits >= 2) return token;
  }
  return null;
}

/** Does this candidate's own title actually carry that model code? Compared on the
 *  normalized alphanumeric form, so "WW90T554DAN/YL" or "WW90T554DAN-Silver" still match. */
export function titleCarriesModelToken(nameAr: string | null | undefined, nameEn: string | null | undefined, token: string): boolean {
  if (!token) return false;
  const haystack = `${normalizeAlnum(nameAr || '')} ${normalizeAlnum(nameEn || '')}`;
  return haystack.includes(token);
}

// ── 3. Phone commercial-variant tier (Q11) ──────────────────────────────────────

export type PhoneTier = 'pro_max' | 'pro' | 'plus' | 'ultra' | 'base';

/**
 * The tier a piece of text claims. Order matters: "Pro Max" must be tested before "Pro",
 * otherwise every Pro Max reads as a Pro and the leak this gate exists to stop survives.
 */
export function phoneTierOf(text: string): PhoneTier {
  const t = lower(text);
  const hasPro = /\bpro\b|برو/.test(t);
  const hasMax = /\bmax\b|ماكس/.test(t);
  const hasPlus = /\bplus\b|\+|بلس|بلاس/.test(t);
  const hasUltra = /\bultra\b|الترا|أولترا/.test(t);
  if (hasUltra) return 'ultra';
  if (hasPro && hasMax) return 'pro_max';
  if (hasPro) return 'pro';
  if (hasPlus) return 'plus';
  return 'base';
}

/**
 * The tier the SHOPPER asked for, or null when they named none (in which case nothing is
 * gated — a bare "ايفون 17" is a legitimately broad request and must keep returning the
 * whole family).
 */
export function requestedPhoneTier(query: string): PhoneTier | null {
  const tier = phoneTierOf(query || '');
  return tier === 'base' ? null : tier;
}

/**
 * Positive conflict: the shopper named a tier and this candidate is a DIFFERENT tier.
 * A candidate whose tier cannot be read as anything but `base` while a tier was requested
 * counts as a conflict too — "iPhone 17 256GB" is genuinely not the "iPhone 17 Pro" that
 * was asked for, which is exactly the Q11 leak.
 */
export function conflictsWithRequestedTier(requested: PhoneTier | null, nameAr?: string | null, nameEn?: string | null): boolean {
  if (!requested) return false;
  const candidate = phoneTierOf(`${nameAr || ''} ${nameEn || ''}`);
  return candidate !== requested;
}
