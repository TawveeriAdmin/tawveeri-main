// src/lib/enrichment/icecat.ts
// ─────────────────────────────────────────────────────────────────────────────
// Icecat Open GTIN resolver — free, credential-light product-identity enrichment.
//
// WHY (the lever): TPS identity is parser-derived (brand|family|generation|variant|
// storage). It is strong but fragile at the tail: ~89% of listings are single-store,
// many because the NAME parser could not fuse a merchant's wording with another's.
// A GTIN (EAN/UPC) is a GLOBAL, store-independent product identifier — two merchants
// selling the same GTIN are selling the SAME commercial variant with certainty,
// regardless of how each titled it. Icecat's free "Open Icecat" catalogue maps a GTIN
// to its authoritative brand + MPN + product name + category + image, letting us:
//   (1) NAME/enrich a GTIN-anchored canonical from an authority (not merchant text), and
//   (2) corroborate across stores by GTIN — the parser-independent comparison path.
//
// CONSTITUTIONAL GUARDRAILS:
//   • Never fabricate. resolveGtin returns null on any doubt (bad GTIN, unconfigured,
//     network error, not-found, malformed response). Unknown beats incorrect.
//   • Deterministic. No LLM. A GTIN either resolves to a cited Icecat record or it does not.
//   • Credential-light + env-gated. With ICECAT_USERNAME unset the resolver is a no-op
//     (returns null) — the code ships and stays dormant until the founder registers a
//     free Open Icecat username and sets the env var. Activation is config, not code.
// ─────────────────────────────────────────────────────────────────────────────

/** A resolved, authority-cited product identity. Every field is Icecat-sourced. */
export interface IcecatProduct {
  gtin: string;                 // the validated GTIN we queried
  brand: string | null;         // GeneralInfo.Brand
  mpn: string | null;           // GeneralInfo.ProductCode (manufacturer part number)
  title: string | null;        // GeneralInfo.Title / ProductName
  category: string | null;      // GeneralInfo.Category.Name.Value
  imageUrl: string | null;      // Image.HighPic (authority image)
  icecatId: string | null;      // Icecat's own product id (provenance)
  source: "icecat_open";        // provenance tag — never dropped downstream
}

const ICECAT_ENDPOINT = "https://live.icecat.biz/api";

/**
 * Normalize a candidate GTIN to digits only. Merchants pad/space/hyphenate them.
 * Leading-zero forms (UPC-A 12 → GTIN-13, EAN-8) are preserved as given; we only
 * strip non-digits. Returns "" when nothing digit-like remains.
 */
export function normalizeGtin(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/\D+/g, "");
}

/**
 * GS1 check-digit validation. A real GTIN is 8, 12, 13 or 14 digits and its last
 * digit is a mod-10 checksum over the rest (weights 3,1,3,1… from the right of the
 * payload). This rejects SKUs/model numbers that merchants mislabel as "gtin" —
 * we must NEVER corroborate two products on a junk identifier. Deterministic, pure.
 */
export function isValidGtin(raw: string | number | null | undefined): boolean {
  const s = normalizeGtin(raw);
  if (![8, 12, 13, 14].includes(s.length)) return false;
  if (/^0+$/.test(s)) return false; // all-zeros is a placeholder, never a real product
  const digits = s.split("").map((d) => Number(d));
  const check = digits.pop()!;
  let sum = 0;
  // Weight the rightmost payload digit by 3, then alternate 1,3,1,3…
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

/**
 * Canonical GTIN-14 form for cross-store keying. UPC-A/EAN-8/EAN-13 that identify the
 * SAME trade item differ only by leading zeros; left-padding to 14 makes "0049…",
 * "49…" and "00049…" one key. (We do NOT re-checksum after padding — padding a valid
 * GTIN preserves its trade-item identity; length-specific checksums already passed.)
 */
export function gtinKey(raw: string | number | null | undefined): string | null {
  const s = normalizeGtin(raw);
  if (!isValidGtin(s)) return null;
  return s.padStart(14, "0");
}

// Small in-process memo so a re-run within a batch never re-hits Icecat for the same
// GTIN. Bounded; process-lifetime. (Not a persistence layer — that is the graph's job.)
const memo = new Map<string, IcecatProduct | null>();

function pickImage(image: unknown): string | null {
  const im = image as Record<string, unknown> | undefined;
  for (const k of ["HighPic", "Pic500x500", "LowPic", "ThumbPic"]) {
    const v = im?.[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }
  return null;
}

const asStr = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

/**
 * Parse an Icecat API JSON body into an IcecatProduct, or null if it is not a usable,
 * OK product record. Pure + defensive — every field access is guarded, because we treat
 * a malformed/partial response as "unknown" (null), never as a partial fabrication.
 * Exported for unit testing against captured fixtures (no network).
 */
export function parseIcecatResponse(body: unknown, gtin: string): IcecatProduct | null {
  const root = body as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return null;
  // Icecat signals success with msg:"OK". Anything else (not found, access denied) → unknown.
  const msg = asStr(root.msg);
  if (msg && msg.toUpperCase() !== "OK") return null;
  const data = root.data as Record<string, unknown> | undefined;
  const gi = data?.GeneralInfo as Record<string, unknown> | undefined;
  if (!gi) return null;

  const brandInfo = gi.BrandInfo as Record<string, unknown> | undefined;
  const brand = asStr(gi.Brand) ?? asStr(brandInfo?.BrandName);
  const cat = gi.Category as Record<string, unknown> | undefined;
  const catName = cat?.Name as Record<string, unknown> | undefined;
  const title = asStr(gi.Title) ?? asStr(gi.ProductName);

  // A record with neither a brand nor a title carries no identity worth citing.
  if (!brand && !title) return null;

  return {
    gtin,
    brand,
    mpn: asStr(gi.ProductCode),
    title,
    category: asStr(catName?.Value) ?? asStr(cat?.CategoryName),
    imageUrl: pickImage(data?.Image),
    icecatId: asStr(gi.IcecatId),
    source: "icecat_open",
  };
}

export interface ResolveOptions {
  language?: string;     // Icecat content language (default "en"; "AR" also supported)
  timeoutMs?: number;    // network budget (default 8000)
  username?: string;     // override ICECAT_USERNAME (mainly for tests)
  fetchImpl?: typeof fetch; // injectable for tests
}

/**
 * Resolve a GTIN to its Open Icecat identity, or null. NEVER throws, NEVER fabricates:
 * a bad GTIN, missing username, network failure, non-OK response or unparseable body all
 * yield null (the caller then leaves the product's identity untouched — unknown beats
 * incorrect). Env-gated on ICECAT_USERNAME so it is dormant until the founder activates it.
 */
export async function resolveGtin(
  rawGtin: string | number | null | undefined,
  opts: ResolveOptions = {}
): Promise<IcecatProduct | null> {
  const gtin = normalizeGtin(rawGtin);
  if (!isValidGtin(gtin)) return null;

  const username = opts.username ?? process.env.ICECAT_USERNAME ?? "";
  if (!username) return null; // dormant until configured — not an error

  const cacheKey = `${username}|${opts.language ?? "en"}|${gtin}`;
  if (memo.has(cacheKey)) return memo.get(cacheKey)!;

  const doFetch = opts.fetchImpl ?? fetch;
  const url =
    `${ICECAT_ENDPOINT}?UserName=${encodeURIComponent(username)}` +
    `&Language=${encodeURIComponent(opts.language ?? "en")}` +
    `&GTIN=${encodeURIComponent(gtin)}` +
    `&Content=GeneralInfo,Image`;

  let result: IcecatProduct | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    const res = await doFetch(url, {
      headers: { accept: "application/json", "user-agent": "TawveeriBot/1.0 (+identity-enrichment)" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const body = await res.json().catch(() => null);
      result = parseIcecatResponse(body, gtin);
    }
  } catch {
    result = null; // network/timeout/parse → unknown
  }

  memo.set(cacheKey, result);
  return result;
}

/** Test-only: clear the in-process memo between cases. */
export function __clearIcecatMemo(): void {
  memo.clear();
}
