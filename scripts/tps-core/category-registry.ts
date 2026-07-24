// scripts/tps-core/category-registry.ts
// Single source of truth for progressive batching: maps each evidence-backed TPS
// category to its plugin, store set, raw_observations filter, canonical display
// names (reused from the verified matchers so the progressive engine produces
// IDENTICAL canonical rows — no regression), and a key→attributes decoder that
// matches each matcher's `attributes` shape. Mobile joined in ADR-061 once its
// parser earned registration by measured quality (see the entry below).
import type { CategoryPlugin, NormalizeResult } from "./types";
import { tvPlugin, normalize as tvN } from "../tps-plugins/tv";
import { monitorPlugin, normalize as monitorN } from "../tps-plugins/monitor";
import { printerPlugin, normalize as printerN } from "../tps-plugins/printer";
import { tabletPlugin, normalize as tabletN } from "../tps-plugins/tablet";
import { audioPlugin, normalize as audioN } from "../tps-plugins/audio";
import { cameraPlugin, normalize as cameraN } from "../tps-plugins/camera";
import { acPlugin } from "../tps-plugins/ac";
import { laptopPlugin, normalize as laptopN } from "../tps-plugins/laptop";
import { mobilePlugin, normalize as mobileN } from "../tps-plugins/mobile";
import { smartwatchPlugin, normalize as smartwatchN } from "../tps-plugins/smartwatch";
import { refrigeratorPlugin } from "../tps-plugins/refrigerator";
import { washingMachinePlugin } from "../tps-plugins/washing_machine";
import { APPLIANCE_BUNDLES, APPLIANCE_CATEGORIES } from "../tps-plugins/appliance";
import { buildNames as tvNames } from "../tps-matcher/tv-matcher-v1-dry";
import { buildNames as tabletNames } from "../tps-matcher/tablet-matcher-v1-dry";
import { buildNames as audioNames } from "../tps-matcher/audio-matcher-v1-dry";
import { buildNames as cameraNames } from "../tps-matcher/camera-matcher-v1-dry";
import { buildNames as acNames } from "../tps-matcher/ac-matcher-v1-dry";
import { buildNames as laptopNames } from "../tps-matcher/laptop-matcher-v1-dry";

// Stores in the recurring normalization sweep. ADR-060 adds Noon (3) and SWSG (8):
// both were ingesting but excluded here, so neither could ever produce a canonical.
// `name` is also the `price_history.store_name` label — a store missing from this
// list previously fell back to `String(id)`, which is why Noon's price-history rows
// carried the literal store_name "3".
export const TPS_STORES = [
  { id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" },
  { id: 5, name: "المنيع" }, { id: 3, name: "نون" }, { id: 8, name: "الشتاء والصيف" },
];

export interface CategoryDef {
  category: string;                 // canonical_products.category
  detected: string;                 // normalized_product_observations.detected_category
  plugin: CategoryPlugin;
  // payload-aware normalize (Almanea structured fields); falls back to plugin.normalize
  normalize: (nameAr: string, nameEn: string, brand: string | null, payload: Record<string, unknown>) => NormalizeResult;
  filterKeywords: string[];         // raw_name ILIKE %kw%
  version: string;                  // tps_version / plugin_version stamp
  names: (key: string, payload: Record<string, unknown>) => { nameAr: string; nameEn: string };
  attrs: (key: string, payload: Record<string, unknown>) => Record<string, unknown>;
  // stableUuid seeds — MUST match the original matchers exactly so the progressive
  // engine upserts the same canonical/normalized ids (no duplicates).
  canonSeed: (key: string) => string;
  normSeed: (obsId: number) => string;
  requireValidTier: boolean;  // corroborate only status==='valid' (tv/tablet/audio/camera)
  priceBand: number | null;   // drop offers > band*min before >=2-store check
}

const P = (v: unknown) => (v === undefined ? null : v);

export const CATEGORY_DEFS: Record<string, CategoryDef> = {
  tv: {
    category: "tv", detected: "tv", plugin: tvPlugin, normalize: tvN, version: "tv-v1",
    filterKeywords: ["tv", "تلفزيون", "television", "smart tv", "شاشة"],
    names: (k) => tvNames(k),
    attrs: (k) => { const p = k.split("|"); const isP = p[1]?.startsWith("MODEL:"); return isP ? {} : { screen_size: Number(p[1]), resolution: p[2] === "NO_RES" ? null : p[2], panel: p[3] === "NO_PANEL" ? null : p[3], refresh_rate: p[4] && p[4] !== "NO_HZ" ? Number(p[4]) : null }; },
    canonSeed: (k) => `canonical:tv:${k}`, normSeed: (o) => `norm:tv:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  // ADR-074 — monitor registered as a NEW category. It was unregistered (no
  // plugin), so ~500 listings and 271 comparison-possible ones produced zero
  // canonicals. Identity mirrors TV (brand|size|resolution|refresh|panel) but
  // refresh is central (gaming) and text is Arabic-folded. requireValidTier:true
  // — corroborate only the full-spec `valid` tier (precision over recall).
  monitor: {
    category: "monitor", detected: "monitor", plugin: monitorPlugin, normalize: monitorN, version: "monitor-v1",
    filterKeywords: ["monitor", "مونيتور", "شاشة كمبيوتر", "شاشة العاب", "gaming monitor", "شاشة قيمنج"],
    names: (k) => {
      const p = k.split("|");
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      if (p[1]?.startsWith("MODEL:")) { const m = p[1].slice(6); return { nameAr: `شاشة ${p[0]} ${m}`.trim(), nameEn: `${cap(p[0])} ${m} Monitor`.trim() }; }
      const [b, size, res, hz, panel] = p;
      const r = res && res !== "NO_RES" ? ` ${res.toUpperCase()}` : "";
      const h = hz && hz !== "NO_HZ" ? ` ${hz}Hz` : "";
      const pa = panel && panel !== "NO_PANEL" ? ` ${panel.toUpperCase()}` : "";
      return { nameAr: `شاشة ${b} ${size} بوصة${r}${h}${pa}`.replace(/\s+/g, " ").trim(), nameEn: `${cap(b)} ${size}"${r}${h}${pa} Monitor`.replace(/\s+/g, " ").trim() };
    },
    attrs: (k) => { const p = k.split("|"); const isP = p[1]?.startsWith("MODEL:"); return isP ? {} : { screen_size: Number(p[1]), resolution: p[2] === "NO_RES" ? null : p[2], refresh_rate: p[3] && p[3] !== "NO_HZ" ? Number(p[3]) : null, panel: p[4] === "NO_PANEL" ? null : p[4] }; },
    canonSeed: (k) => `canonical:monitor:${k}`, normSeed: (o) => `norm:monitor:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  // ADR-075 — printer registered as a new category. Line + model number is the
  // stable cross-store identity (hp|laserjet 1602w); model_number stays null (the
  // line lives in the key, off the (brand, model_number) unique index). Precision:
  // requireValidTier true — corroborate only rows with a recognised line+model.
  printer: {
    category: "printer", detected: "printer", plugin: printerPlugin, normalize: printerN, version: "printer-v1",
    filterKeywords: ["printer", "طابعة", "laserjet", "deskjet", "pixma", "ecotank", "طابعه"],
    names: (k) => {
      const [b, model] = k.split("|");
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return { nameAr: `طابعة ${b} ${model}`.replace(/\s+/g, " ").trim(), nameEn: `${cap(b)} ${model} Printer`.replace(/\s+/g, " ").trim() };
    },
    attrs: (k) => ({ model: k.split("|")[1] }),
    canonSeed: (k) => `canonical:printer:${k}`, normSeed: (o) => `norm:printer:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  tablet: {
    category: "tablet", detected: "tablet", plugin: tabletPlugin, normalize: tabletN, version: "tablet-v1",
    filterKeywords: ["tablet", "تابلت", "ipad", "ايباد", "galaxy tab", "جالكسي تاب", "matepad"],
    names: (k) => tabletNames(k),
    attrs: (k) => { const p = k.split("|"); const isP = p[1]?.startsWith("MODEL:"); return isP ? {} : { line: p[1], gen: p[2] === "NO_GEN" ? null : p[2], storage: Number(p[3]), connectivity: p[4] === "NO_CONN" ? null : p[4], screen_size: p[5] === "NO_SIZE" ? null : Number(p[5]) }; },
    canonSeed: (k) => `canonical:tablet:${k}`, normSeed: (o) => `norm:tablet:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  audio: {
    category: "audio", detected: "audio", plugin: audioPlugin, normalize: audioN, version: "audio-v1",
    filterKeywords: ["headphone", "سماعة", "earbuds", "airpods", "speaker", "مكبر صوت", "earphone", "buds"],
    names: (k, pl) => audioNames(k, (pl.type as string) ?? null),
    attrs: (k, pl) => ({ model: k.split("|")[1], type: P(pl.type) }),
    canonSeed: (k) => `canonical:audio:${k}`, normSeed: (o) => `norm:audio:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  camera: {
    category: "camera", detected: "camera", plugin: cameraPlugin, normalize: cameraN, version: "camera-v1",
    filterKeywords: ["camera", "كاميرا", "dslr", "mirrorless", "eos", "كانون"],
    names: (k) => cameraNames(k),
    attrs: (k) => { const p = k.split("|"); return { model: p[1], config: p[2] }; },
    canonSeed: (k) => `canonical:camera:${k}`, normSeed: (o) => `norm:camera:raw_observations:${o}`, requireValidTier: true, priceBand: 1.5,
  },
  air_conditioner: {
    category: "air_conditioner", detected: "ac", plugin: acPlugin,
    normalize: (a, b, br) => acPlugin.normalize(a, b, br), version: "ac-v1",
    filterKeywords: ["مكيف جداري", "مكيف سبليت", "Split Air Conditioner", "Split AC"],
    names: (k) => acNames(k),
    attrs: (k) => { const p = k.split("|"); return { ac_type: p[1], series_or_platform: p[2] === "NO_SERIES" ? null : p[2], capacity_btu: Number(p[3]), technology: p[4], cooling_mode: p[5] }; },
    // ADR-077: keep requireValidTier FALSE. The audit showed most NO_SERIES AC
    // corroborations are LEGITIMATE (low price spread = the same simple/budget
    // unit across stores). The false merges came specifically from LG design lines
    // (Art Cool vs Fresh DV) at the same BTU — fixed by extracting those series in
    // the parser, not by dropping every series-less comparison.
    canonSeed: (k) => `canonical:${k}`, normSeed: (o) => `norm:raw_observations:${o}`, requireValidTier: false, priceBand: null,
  },
  // ADR-061 — mobile registered. It was deliberately excluded while its plugin
  // was Apple/Samsung-only with no accessory rejection and no storage validation.
  // After the parser rebuild it identifies 64.8% of the listings it claims (was
  // 13.6%) and yields 71 cross-store corroborations (was 11), including 4-store
  // comparisons. `canonSeed` is `canonical:${k}` — verified empirically against
  // the 38 canonicals mobile-v1 already wrote, so registration UPSERTS them
  // rather than creating duplicate cards.
  mobile: {
    category: "mobile", detected: "mobile", plugin: mobilePlugin,
    normalize: (a, b, br, pl) => mobileN(a, b, br, pl), version: "mobile-v1",
    filterKeywords: ["iphone", "ايفون", "galaxy", "جالاكسي", "جوال", "هاتف", "smartphone", "redmi", "ريدمي"],
    names: (k) => {
      const [brand, family, gen, variant, storage] = k.split("|");
      const v = variant && variant !== "Standard" ? ` ${variant}` : "";
      const en = `${family} ${gen}${v} ${storage}GB`.replace(/\s+/g, " ").trim();
      return { nameAr: `${brand} ${en}`, nameEn: `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${en}` };
    },
    attrs: (k) => {
      const p = k.split("|");
      return { family: p[1], generation: p[2], variant: p[3], storage_gb: Number(p[4]) };
    },
    canonSeed: (k) => `canonical:${k}`, normSeed: (o) => `norm:raw_observations:${o}`,
    requireValidTier: true, priceBand: 1.5,
  },
  // ADR-068 — smartwatch registered on COMPARISON VALUE, not the blended headline.
  // Measured: 91.9% identified among brands sold by >=2 merchants (mobile, the
  // reference, is 80.1%); the blended 61.8% is dragged down by a large tail of
  // single-merchant no-name brands where no comparison is possible at any parser
  // quality. Case size and connectivity are identity — a 42mm GPS and a 49mm
  // Cellular are different SKUs at different prices.
  smartwatch: {
    category: "smartwatch", detected: "smartwatch", plugin: smartwatchPlugin,
    normalize: (a, b, br, pl) => smartwatchN(a, b, br, pl), version: "smartwatch-v1",
    filterKeywords: ["ساعة ذكية", "smartwatch", "smart watch", "apple watch", "galaxy watch", "watch fit", "watch gt"],
    names: (k) => {
      const [brand, family, gen, variant, size, conn] = k.split("|");
      const v = variant && variant !== "Standard" ? ` ${variant}` : "";
      const sz = size && size !== "NO_SIZE" ? ` ${size}mm` : "";
      const c = conn === "cellular" ? " Cellular" : "";
      const label = `${family} ${gen}${v}${sz}${c}`.replace(/\s+/g, " ").trim();
      return { nameAr: `${brand} ${label}`, nameEn: `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${label}` };
    },
    attrs: (k) => {
      const p = k.split("|");
      return {
        family: p[1], generation: p[2], variant: p[3],
        size_mm: p[4] === "NO_SIZE" ? null : Number(p[4]), connectivity: p[5],
      };
    },
    canonSeed: (k) => `canonical:smartwatch:${k}`,
    normSeed: (o) => `norm:smartwatch:raw_observations:${o}`,
    requireValidTier: true, priceBand: 1.5,
  },
  laptop: {
    category: "laptop", detected: "laptop", plugin: laptopPlugin, normalize: laptopN, version: "laptop-v1",
    filterKeywords: ["laptop", "لابتوب", "لاب توب", "notebook", "macbook", "ماك بوك"],
    names: (k) => laptopNames(k),
    attrs: (k) => { const p = k.split("|"); const isP = p[1]?.startsWith("MODEL:"); return isP ? {} : { family: p[1] === "NO_FAMILY" ? null : p[1], cpu: p[2], ram: Number(p[3]), storage: Number(p[4]), screen: p[5] === "NO_SCREEN" ? null : Number(p[5]), gpu: p[6] }; },
    canonSeed: (k) => `canonical:laptop:${k}`, normSeed: (o) => `norm:laptop:raw_observations:${o}`, requireValidTier: false, priceBand: null,
  },
  refrigerator: {
    category: "refrigerator", detected: "refrigerator", plugin: refrigeratorPlugin,
    normalize: (a, b, br) => refrigeratorPlugin.normalize(a, b, br), version: "refrigerator-v1",
    filterKeywords: ["ثلاجة", "refrigerator", "fridge"],
    // key = brand|type|capacity_liters|tech(inverter|standard)
    names: (k) => { const p = k.split("|"); const b = p[0], ty = p[1].replace(/_/g, " "), L = p[2], tech = p[3] === "inverter" ? " انفرتر" : ""; return { nameAr: `ثلاجة ${b} ${ty} ${L} لتر${tech}`.trim(), nameEn: `${b} ${ty} refrigerator ${L}L${p[3] === "inverter" ? " inverter" : ""}`.trim() }; },
    attrs: (k) => { const p = k.split("|"); return { fridge_type: p[1], capacity_liters: Number(p[2]), inverter: p[3] === "inverter" }; },
    canonSeed: (k) => `canonical:refrigerator:${k}`, normSeed: (o) => `norm:refrigerator:raw_observations:${o}`, requireValidTier: false, priceBand: null,
  },
  washing_machine: {
    category: "washing_machine", detected: "washing_machine", plugin: washingMachinePlugin,
    normalize: (a, b, br) => washingMachinePlugin.normalize(a, b, br), version: "washing_machine-v1",
    filterKeywords: ["غسالة", "washing machine", "washer"],
    // key = brand|type|capacity_kg|dryer(combo|washer)
    names: (k) => { const p = k.split("|"); const b = p[0], ty = p[1].replace(/_/g, " "), kg = p[2], combo = p[3] === "combo"; return { nameAr: `غسالة ${b} ${ty} ${kg} كجم${combo ? " ونشافة" : ""}`.trim(), nameEn: `${b} ${ty} ${combo ? "washer/dryer" : "washer"} ${kg}kg`.trim() }; },
    attrs: (k) => { const p = k.split("|"); return { washer_type: p[1], capacity_kg: Number(p[2]), has_dryer: p[3] === "combo" }; },
    canonSeed: (k) => `canonical:washing_machine:${k}`, normSeed: (o) => `norm:washing_machine:raw_observations:${o}`, requireValidTier: false, priceBand: null,
  },
};

// Config-driven appliance categories (dishwasher, microwave, vacuum, air_purifier,
// coffee_maker, kettle, air_fryer, toaster, blender, oven). One factory implements
// the plugin + registry helpers; registration is a loop, not per-category code.
// All are structurally single-store (Layer 2) like the other appliances:
// requireValidTier:false, priceBand:null.
for (const cat of APPLIANCE_CATEGORIES) {
  const b = APPLIANCE_BUNDLES[cat];
  CATEGORY_DEFS[cat] = {
    category: cat, detected: cat, plugin: b.plugin,
    normalize: (a, bb, br) => b.plugin.normalize(a, bb, br),
    filterKeywords: [b.config.nounEn.split(" ")[0], b.config.nounAr],
    version: b.config.version,
    names: (k) => b.names(k),
    attrs: (k, rep) => b.attrs(k, rep),
    canonSeed: (k) => `canonical:${cat}:${k}`, normSeed: (o) => `norm:${cat}:raw_observations:${o}`,
    // ADR-076: corroborate only the `valid` tier. The factory now marks a
    // capacity-less `brand|type|NA` key as low_confidence, so this stops it from
    // merging distinct models into one false comparison (single-store catalogue is unaffected).
    requireValidTier: true, priceBand: null,
  };
}
