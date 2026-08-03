// scripts/tps-core/storefront-arabic-title.ts
// ADR-185 — compose a Saudi Arabic title for a STOREFRONT (`products`) row whose name_ar is
// the merchant's English title.
//
// This replaces the composer that lived inside `scripts/tps-analysis/arabic-titles.js`, which
// was unsafe to run. It read capacity from `specifications` only — and `capacity_btu` is null
// for EVERY English-named air conditioner in the storefront layer, while 166 of them state the
// BTU in the title. So it would have turned
//     "Haier Nano Cool Split AC, 22,200 BTU, Heat & Cool, Wi-Fi"
// into «مكيف سبليت هاير», stripping the one number an air-conditioner shopper decides on and
// making three different Haier units indistinguishable — which would then collide on the
// `products.name_ar` UNIQUE index and be swallowed by a bare `catch {}`.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: a rename may not lose a fact the merchant stated.
// If the title states a capacity and we cannot carry it, we do not rename. Unknown beats
// incorrect, and a working English title beats a lossy Arabic one.

import { parseCapacity, parseCooling, statesCapacity, hasArabic } from "./arabic-naming";

/** Appliance-family brand transliterations (superset of the map in the old script). */
export const APPLIANCE_BRAND_AR: Record<string, string> = {
  samsung: "سامسونج", lg: "إل جي", "l g": "إل جي", toshiba: "توشيبا", panasonic: "باناسونيك",
  hitachi: "هيتاشي", hisense: "هايسنس", tcl: "تي سي إل", haier: "هاير", midea: "ميديا", aux: "أوكس",
  gree: "جري", daikin: "دايكن", carrier: "كاريير", fisher: "فيشر", general: "جنرال", classpro: "كلاس برو",
  nikai: "نيكاي", beko: "بيكو", bosch: "بوش", whirlpool: "ويرلبول", sharp: "شارب", kelvinator: "كلفيناتور",
  wansa: "وانسا", dansat: "دانسات", "white westinghouse": "وايت وستنجهاوس", "super general": "سوبر جنرال",
  xper: "إكسبير", mtc: "إم تي سي", basic: "بيسك", craft: "كرافت", crafft: "كرافت", impex: "إمبكس",
  geepas: "جيباس", braun: "براون", kenwood: "كينوود", philips: "فيليبس", tefal: "تيفال",
  "black+decker": "بلاك آند ديكر", "black & decker": "بلاك آند ديكر", oscal: "أوسكال", oscar: "أوسكار",
  dots: "دوتس", royal: "رويال", shark: "شارك", karcher: "كارشر", zamil: "الزامل", honeywell: "هانيويل",
};

const TYPE_AR: Record<string, string> = { split: "سبليت", window: "شباك", portable: "متنقل", cassette: "كاسيت", evaporative: "صحراوي", cabinet: "خزانة", ducted: "مخفي" };
const COOL_AR: Record<string, string> = { cool_only: "بارد فقط", hot_cold: "حار/بارد" };

/**
 * Arabic for a brand. The storefront `brand` column ALREADY holds Arabic for many rows
 * («ميديا», «هاير») — the old composer did not notice, so it appended the Latin brand from the
 * title on top and produced «مكيف سبليت كرافت CRAFFT». An already-Arabic brand is returned as is.
 */
/** Placeholders the storefront layer stores in `brand`. A placeholder is not a brand. */
const NON_BRANDS = new Set(["unknown", "n/a", "na", "none", "generic", "-", "other", "غير معروف"]);

export function applianceBrandAr(brand: string | null | undefined): string | null {
  const b = (brand || "").trim();
  if (!b || NON_BRANDS.has(b.toLowerCase())) return null;
  if (hasArabic(b)) return b;
  const k = b.toLowerCase();
  if (APPLIANCE_BRAND_AR[k]) return APPLIANCE_BRAND_AR[k];
  // Longest containing key wins, so "super general" is not shadowed by "general".
  const hit = Object.keys(APPLIANCE_BRAND_AR).filter((x) => k.includes(x)).sort((a, b2) => b2.length - a.length)[0];
  return hit ? APPLIANCE_BRAND_AR[hit] : b; // uncurated brand kept as written, never guessed
}

/**
 * AC form factor from the merchant's title, for the rows where `specifications.ac_type` is
 * absent. «مكيف شباك الزامل 17800 وحدة» beats «مكيف الزامل 17800 وحدة» and the word is the
 * merchant's own.
 */
export function parseAcType(title: string): string | null {
  const t = (title || "").toLowerCase();
  if (/\bsplit\b/.test(t)) return "split";
  if (/\bwindow\b/.test(t)) return "window";
  if (/\bportable\b/.test(t)) return "portable";
  if (/\bcassette\b/.test(t)) return "cassette";
  if (/\bevaporative|desert\s*cooler\b/.test(t)) return "evaporative";
  if (/\bducted|concealed\b/.test(t)) return "ducted";
  if (/\bcabinet|floor\s*standing\b/.test(t)) return "cabinet";
  return null;
}

/**
 * Arabic head read from the merchant's own title.
 *
 * This is the primary path, not a fallback for the `appliance` bucket, because the stored
 * `category` is not reliable: the split air conditioners a shopper still sees in English on the
 * «مكيف» results page are filed under **`accessories`**. The title says what the product is, and
 * an unrecognised title returns null so nothing is guessed.
 */
export function subtypeAr(title: string): string | null {
  const t = (title || "").toLowerCase();
  // "Split AC" / "Window AC" / "air conditioner" are unambiguous; a bare "AC" is not and is
  // deliberately not matched.
  if (/air\s*conditioner|\b(split|window|portable|cassette|ducted|cabinet)\s*a\/?c\b/.test(t)) return "مكيف";
  if (/refrigerator|fridge/.test(t)) return "ثلاجة";
  if (/freezer/.test(t)) return "فريزر";
  if (/washer|washing machine/.test(t)) return "غسالة";
  if (/dryer/.test(t)) return "نشافة";
  if (/dishwasher/.test(t)) return "غسالة صحون";
  if (/vacuum/.test(t)) return "مكنسة كهربائية";
  if (/water heater|geyser/.test(t)) return "سخان";
  if (/microwave/.test(t)) return "ميكروويف";
  if (/oven/.test(t)) return "فرن";
  return null;
}

export interface StorefrontRow {
  category: string;
  nameEn: string;
  brand: string | null;
  specifications: Record<string, unknown> | null;
}

export interface ComposeResult {
  title: string | null;
  /** Why nothing was composed — reported, never silent. */
  refusedBecause?: "no_category" | "capacity_would_be_lost" | "too_thin";
}

/**
 * Compose, or refuse and say why. Order: {category} {type} {brand} {capacity} {cooling}
 * {inverter} {model}, which is how a Saudi retailer writes an appliance title.
 */
export function composeStorefrontArabic(row: StorefrontRow): ComposeResult {
  const specs = (row.specifications && typeof row.specifications === "object" ? row.specifications : {}) as Record<string, unknown>;
  const title = row.nameEn || "";
  const head = row.category === "air_conditioner" ? "مكيف"
    : row.category === "refrigerator" ? "ثلاجة"
    : subtypeAr(title);
  if (!head) return { title: null, refusedBecause: "no_category" };

  // Specs first (they are structured), the merchant's title second (it is still evidence).
  const fromTitle = parseCapacity(title);
  const btu = (specs.capacity_btu as number) ?? fromTitle.btu;
  const liters = (specs.capacity_liters as number) ?? fromTitle.liters;
  const kg = (specs.capacity_kg as number) ?? fromTitle.kg;
  const cuft = (specs.capacity_cuft as number) ?? fromTitle.cuft;

  // THE GATE. The merchant stated a capacity and we could not read it ⇒ renaming would
  // destroy the fact the shopper decides on. Keep the working English title instead.
  if (statesCapacity(title) && !btu && !liters && !kg && !cuft) {
    return { title: null, refusedBecause: "capacity_would_be_lost" };
  }

  const parts = [head];
  const isAc = head === "مكيف";
  const acType = (specs.ac_type as string | undefined) ?? (isAc ? parseAcType(title) : null);
  if (acType && TYPE_AR[acType]) parts.push(TYPE_AR[acType]);
  const bAr = applianceBrandAr(row.brand);
  if (bAr) parts.push(bAr);
  if (btu) parts.push(`${btu} وحدة`);
  if (liters) parts.push(`${liters} لتر`);
  if (cuft) parts.push(`${cuft} قدم`);
  if (kg) parts.push(`${kg} كجم`);
  if (specs.door_count === 2) parts.push("بابين");
  const cooling = (specs.cooling as string | undefined) ?? parseCooling(title) ?? undefined;
  if (cooling && COOL_AR[cooling]) parts.push(COOL_AR[cooling]);
  if (specs.inverter === true || /\binverter\b/i.test(title)) parts.push("إنفرتر");
  if (/\bwi-?fi\b/i.test(title)) parts.push("واي فاي");

  if (parts.length < 3) return { title: null, refusedBecause: "too_thin" };
  let out = parts.join(" ");

  // The merchant's model code, kept Latin, so near-identical variants stay distinguishable
  // (and so the name_ar UNIQUE index has something to separate them by). Never append a code
  // that is just the brand again — that is what produced «… كرافت CRAFFT».
  const model = title.match(/\b([A-Z][A-Z0-9]{4,}(?:-[A-Z0-9]+)?)\b/);
  const brandWords = new Set((row.brand || "").toLowerCase().split(/\s+/).filter(Boolean));
  if (model && !out.includes(model[1]) && !brandWords.has(model[1].toLowerCase())
      && !Object.keys(APPLIANCE_BRAND_AR).includes(model[1].toLowerCase())) {
    out += ` ${model[1]}`;
  }
  return { title: out.replace(/\s+/g, " ").trim() };
}
