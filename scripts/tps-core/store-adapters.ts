// scripts/tps-core/store-adapters.ts
// ─────────────────────────────────────────────────────────────────────────────
// Store Adapter Registry — كل متجر يعرّف: استخراج حقوله + تنظيفها + نسخته.
// مسؤولية الـ Adapter: أسماء الحقول + التنظيف (Normalization) — الـ matcher
// يستقبل بيانات نظيفة دائماً ولا يعرف أي شيء عن بنية المتاجر.
// ─────────────────────────────────────────────────────────────────────────────

import { isStoreIdentity } from "./store-identity-guard";

export interface AdaptedRow {
  nameAr: string;
  nameEn: string;
  brand: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  sku: string | null;
  model: string | null;
  adapterVersion: string;
  isCompleteVariant: boolean;
}

type P = Record<string, unknown>;

const s = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(s(v));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const firstOfArray = (v: unknown): string | null => {
  if (Array.isArray(v) && v.length) return s(v[0]);

  const str = s(v);
  if (str?.startsWith("[")) {
    try {
      const a = JSON.parse(str);
      if (Array.isArray(a) && a.length) return s(a[0]);
    } catch {}
  }

  return str;
};

const cleanName = (v: string | null): string =>
  (v ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[-–|،,\s]+|[-–|،,\s]+$/g, "")
    .trim();

/**
 * A STORE NAME IS NOT A BRAND (ADR-191).
 *
 * Some feeds put the shop's own name in the brand field. Measured on production: **22 active
 * canonicals keyed `sony world - ksa|…`** — Sony WH-1000XM6, WF-C510, INZONE H3/H9 — carrying
 * the RETAILER as their manufacturer. The customer reads «sony world - ksa Wh-1000xm6» as a
 * product name, and because `brand` is the first segment of the identity key, the same headphone
 * sold by Jarir can never corroborate with it: one merchant's listing is fenced off inside its
 * own brand namespace.
 *
 * This is the Constitution's own rule — *one canonical identity; one canonical store identity* —
 * and a store identifier reaching an identity key breaks it. Rejecting here rather than at one
 * merchant's adapter means the next feed that does this is caught on arrival.
 *
 * Rejected ⇒ `null`, which is what "we do not know the brand" already means downstream. Unknown
 * beats incorrect, and a wrong brand is worse than no brand because it is silently load-bearing.
 */
const cleanBrand = (v: unknown): string | null => {
  const b = firstOfArray(v);
  const brand = b ? b.replace(/\s+/g, " ").trim() : null;
  if (!brand) return null;
  return isStoreIdentity(brand) ? null : brand;
};

const TRACKING_PARAMS = [
  "childsku",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ref",
  "srsltid",
];

const cleanUrl = (v: unknown): string | null => {
  const raw = s(v);
  if (!raw) return null;

  try {
    const u = new URL(raw);

    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.includes(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }

    return u.toString();
  } catch {
    return raw;
  }
};

const cleanModel = (v: unknown): string | null => {
  const m = s(v);
  return m ? m.replace(/\s+/g, " ").trim().toUpperCase() : null;
};

const STORAGE_RE =
  /(\d+(?:\.\d+)?)\s*(TB|GB|تيرا(?:بايت)?|جيجا(?:بايت)?)/i;

const storageFromModel = (model: string | null): string | null => {
  if (!model) return null;

  const m = model.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
};

export const STORE_ADAPTERS: Record<
  string,
  (p: P, rawName: string | null) => AdaptedRow
> = {
  "المنيع": (p, rawName) => ({
    nameAr: cleanName(s(p.nameAr) ?? s(p.name) ?? rawName),
    nameEn: "",
    brand: cleanBrand(p.brand) ?? cleanBrand(p.brandEn) ?? cleanBrand(p.brandAr),
    price: num(p.sellingPrice) ?? num(p.price) ?? num(p.wasPrice),
    url: cleanUrl(p.url),
    image: s(p.image_url),
    sku: s(p.sku),
    model: cleanModel(p.model),
    adapterVersion: "almanea-v1",
    isCompleteVariant: true,
  }),

  "اكسترا": (p, rawName) => ({
    nameAr: "",
    nameEn: cleanName(s(p.nameEn) ?? s(p.title) ?? rawName),
    brand: cleanBrand(p.brandEn) ?? cleanBrand(p.brand),
    price: num(p.sellingPrice) ?? num(p.price) ?? num(p.wasPrice),
    url: cleanUrl(p.productUrl),
    image: firstOfArray(p.imageUrl),
    sku: s(p.sku),
    model: cleanModel(p.model),
    adapterVersion: "extra-v1",
    isCompleteVariant: true,
  }),

  "جرير": (p, rawName) => {
    let nameAr = cleanName(s(p.name_ar) ?? rawName);
    let nameEn = cleanName(s(p.name_en));
    const model = cleanModel(p.model);

    if (!STORAGE_RE.test(`${nameAr} ${nameEn}`)) {
      const st = storageFromModel(model);

      if (st) {
        if (nameEn) {
          nameEn = `${nameEn} ${st}`;
        } else {
          nameAr = `${nameAr} ${st}`;
        }
      }
    }

    const hasStorage = STORAGE_RE.test(`${nameAr} ${nameEn} ${model ?? ""}`);

    return {
      nameAr,
      nameEn,
      brand: cleanBrand(p.brand),
      price: num(p.current_price) ?? num(p.original_price),
      url: cleanUrl(p.product_url),
      image: firstOfArray(p.image_urls),
      sku: s(p.sku),
      model,
      adapterVersion: "jarir-v3",
      isCompleteVariant: hasStorage,
    };
  },

  "أمازون": (p, rawName) => {
    let nameEn = cleanName(s(p.name_en) ?? s(p.name_ar) ?? rawName);
    const model = cleanModel(p.model);

    if (!STORAGE_RE.test(nameEn)) {
      const st = storageFromModel(model);
      if (st) nameEn = `${nameEn} ${st}`;
    }

    const hasStorage = STORAGE_RE.test(`${nameEn} ${model ?? ""}`);

    return {
      nameAr: "",
      nameEn,
      brand: cleanBrand(p.brand),
      price: num(p.current_price) ?? num(p.original_price),
      url: cleanUrl(p.product_url),
      image: firstOfArray(p.image_urls),
      sku: s(p.sku),
      model,
      adapterVersion: "amazon-v1",
      isCompleteVariant: hasStorage,
    };
  },
};

export function adaptStoreRow(
  storeName: string,
  payload: P,
  rawName: string | null
): AdaptedRow | null {
  const adapter = STORE_ADAPTERS[storeName];
  return adapter ? adapter(payload, rawName) : null;
}