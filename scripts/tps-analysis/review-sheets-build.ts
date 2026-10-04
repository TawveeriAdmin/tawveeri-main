// scripts/tps-analysis/review-sheets-build.ts — label-free independent-review sheets (2026-10-04). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Builds the two reviewer sheets the founder asked for:
//   vacuum32 — EVERY Vacuum group the identity monitor classifies as `family_only` (no exact model key, no ≥ 2 agreeing stated codes);
//   tv22     — EVERY TV group whose verifier outcome changes under the proposed short-model evidence (replay-changed-groups.json).
// A reviewer sees only evidence a shopper could see: merchant, title, brand, source model fields, extracted attributes, condition /
// bundle / region hints, URL. NEVER the verifier verdict, the expected label, or (Vacuum) the identity key. Group order and listing
// order are shuffled with a fixed seed so neither carries a signal. The private answer key (group id → key + verdicts) is written
// separately and is not given to reviewers.
//
//   npx tsx scripts/tps-analysis/review-sheets-build.ts [--out=<dir>] [--key-out=<dir>]
import { config } from "dotenv";
import { resolve } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { normalize as tvNormalize } from "../tps-plugins/tv/parser";
import { titleShortModel, screenSizeOf } from "../../src/lib/identity/tv-short-model";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? null;
const OUT = arg("out") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/review";
const KEY_OUT = arg("key-out") ?? OUT;
const STORE_AR: Record<number, string> = { 1: "جرير", 2: "أمازون", 3: "نون", 4: "إكسترا", 5: "المنيع", 6: "سامسونج السعودية", 7: "شاكر", 8: "SWSG", 9: "نجم", 18: "الصندوق الأسود", 21: "شرف DG", 23: "النخيل" };
const STORE_EN: Record<number, string> = { 1: "Jarir", 2: "Amazon", 3: "Noon", 4: "Extra", 5: "Almanea", 6: "Samsung KSA", 7: "Shaker", 8: "SWSG", 9: "Najm", 18: "Blackbox", 21: "Sharaf DG", 23: "Alnakheel" };

// deterministic shuffle
let seed = 20261004;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ── the monitor's independent stated-code logic (copied on purpose: the sheet must classify exactly as the monitor did) ──
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const NOT_A_CODE = /INCH|SMART|QLED|LED|MINI|OLED|UHD|CRYSTAL|GOOGLE|VIDAA|HDR|DOLBY|FRAME|VACUUM|CLEANER|WATT|BAGLESS|CANISTER|POWER|DRUM|CORDLESS|STICK|ROBOT/;
const SHORT_CODE = /^\d{2,3}[A-Z]{1,2}\d[A-Z0-9]{0,3}(PRO)?$/;
const LONG_CODE = /^(?=.*\d)(?=.*[A-Z])[A-Z0-9]{8,18}$/;
const looksLikeCode = (t: string) => !NOT_A_CODE.test(t) && (SHORT_CODE.test(t) || LONG_CODE.test(t)) && !/^\d+(HZ|K|W|L|GB|TB)$/.test(t);
function statedCodes(name: string | null, payload: Record<string, unknown> | null): string[] {
  const out = new Set<string>();
  for (const f of ["modelNumber", "model_number", "mpn", "model"]) { const v = payload?.[f]; if (typeof v === "string" && v.length <= 22) { const t = norm(v); if (looksLikeCode(t)) out.add(t); } }
  for (const tok of String(name ?? "").split(/[\s,()/|–-]+/)) { const t = norm(tok); if (t && looksLikeCode(t)) out.add(t); }
  return [...out];
}
const sharedPrefix = (x: string, y: string) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
const compatible = (a: string[], b: string[]) => a.some((x) => b.some((y) => x === y || x.startsWith(y) || y.startsWith(x) || sharedPrefix(x, y) >= Math.max(8, Math.min(x.length, y.length) - 3)));

// ── shopper-visible hints (extracted from the title; informational) ──
const hint = (title: string) => ({
  condition: /refurbish|renewed|used|open box|مجدد|مستعمل/i.test(title) ? "مجدّد/مستعمل (مذكور)" : "لم تُذكر",
  bundle: /bundle|combo|\+ ?(?:extra|extension|brush|filter|bag)|with (?:extra|free|bag|brush|filter)|بكج|مع (?:كيس|فرشاة|ملحقات|فلتر)/i.test(title) ? "يوجد ما يوحي بحزمة/ملحقات" : "لا إشارة",
  region: /international|global version|uk version|us version|eu version|china|ksa version|saudi version|middle east|gcc|نسخة (?:دولية|السعودية|الخليج)/i.exec(title)?.[0] ?? "لا إشارة",
});
const vac = (title: string) => {
  const w = /(\d{3,4})\s?(?:w\b|watts?|واط)/i.exec(title); const l = /(\d+(?:\.\d+)?)\s?(?:l\b|ltr|lit(?:er|re)s?|لتر|ليتر)/i.exec(title);
  const forms = [...new Set((title.match(/cordless|stick|handheld|hand vacuum|robot|canister|drum|barrel|upright|wet\s*(?:&|and)?\s*dry|bagless|bagged|carpet|mop|برميل|لاسلكي|روبوت|مكنسة يدوية|عمودية/gi) ?? []).map((x) => x.toLowerCase()))];
  return { watt: w ? `${w[1]} واط` : "لم يُذكر", capacity: l ? `${l[1]} لتر` : "لم تُذكر", form: forms.length ? forms.join(" · ") : "لم يُذكر" };
};

type Offer = { identity_key: string; store_id: number; name: string | null; url: string | null; payload: Record<string, unknown> | null };

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const sel = `select co.identity_key, co.store_id, co.name, co.url,
      jsonb_build_object('brand', r.payload->'brand', 'mpn', r.payload->'mpn', 'modelNumber', r.payload->'modelNumber', 'model_number', r.payload->'model_number', 'model', r.payload->'model',
                         'specifications', r.payload->'specifications') as payload`;
  // ── Vacuum: verified groups (no signal on any listing), ≥ 2 stores, classified family_only exactly as the monitor does ──
  const vrows = (await pg.query(
    `${sel} from tps_current_offers co
       join canonical_products cp on cp.tps_identity_key = co.identity_key and cp.is_active and cp.category = 'vacuum'
       left join raw_observations r on r.id = co.raw_obs_id
       left join tps_offer_identity_signals s on s.canonical_product_id = cp.id and s.store_id = co.store_id
      where co.status = 'valid' and s.canonical_product_id is null order by 1, 2`)).rows as Offer[];
  const vby = new Map<string, Offer[]>(); for (const o of vrows) { const l = vby.get(o.identity_key); if (l) l.push(o); else vby.set(o.identity_key, [o]); }
  const family: { key: string; list: Offer[] }[] = [];
  for (const [key, L] of vby) {
    if (new Set(L.map((x) => x.store_id)).size < 2) continue;
    const cs = L.map((x) => statedCodes(x.name, x.payload));
    let bad = false; for (let i = 0; i < cs.length && !bad; i++) for (let j = i + 1; j < cs.length && !bad; j++) if (cs[i].length && cs[j].length && !compatible(cs[i], cs[j])) bad = true;
    if (bad || key.includes("|MODEL:") || cs.filter((c) => c.length).length >= 2) continue;
    family.push({ key, list: L });
  }
  // ── TV: the 22 groups whose outcome changes under the proposal ──
  const changed = JSON.parse(readFileSync(resolve(process.cwd(), "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/tv-short-model/replay-changed-groups.json"), "utf8")) as { key: string; P0: string[]; P3: string[] }[];
  const tvKeys = changed.map((c) => c.key);
  const trows = (await pg.query(
    `${sel} from tps_current_offers co
       join canonical_products cp on cp.tps_identity_key = co.identity_key and cp.is_active and cp.category = 'tv'
       left join raw_observations r on r.id = co.raw_obs_id
      where co.status = 'valid' and co.identity_key = any($1) and co.payload->>'_superseded_by_identity' is null order by 1, 2`, [tvKeys])).rows as Offer[];
  await pg.query("rollback"); await pg.end();
  const tby = new Map<string, Offer[]>(); for (const o of trows) { const l = tby.get(o.identity_key); if (l) l.push(o); else tby.set(o.identity_key, [o]); }

  const cleanUrl = (u: string | null) => { if (!u) return null; try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } };
  // The generic `model` field is shown, but labelled: at several merchants it is a title fragment, not a manufacturer model.
  const FIELD_LABEL: Record<string, string> = { mpn: "mpn", modelNumber: "modelNumber", model_number: "model_number", model: "model [حقل عام — كثيرًا ما يكون جزءًا من العنوان وليس رقم موديل]" };
  const sourceFields = (p: Record<string, unknown> | null) => Object.fromEntries((["mpn", "modelNumber", "model_number", "model"] as const).map((f) => [FIELD_LABEL[f], raw(p, f)]).filter(([, v]) => v));
  const raw = (p: Record<string, unknown> | null, f: string) => { const v = p?.[f]; return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null; };
  const specs = (p: Record<string, unknown> | null) => { const s = p?.specifications; if (!s || typeof s !== "object") return []; return Object.entries(s as Record<string, unknown>).filter(([, v]) => typeof v === "string" || typeof v === "number").slice(0, 10).map(([k, v]) => `${k}: ${String(v).slice(0, 38)}`); };

  // ── Vacuum sheet ──
  const vSheet: unknown[] = []; const vKey: unknown[] = [];
  shuffle(family).forEach((g, i) => {
    const id = `V${String(i + 1).padStart(2, "0")}`;
    const listings = shuffle(g.list).map((o) => ({
      merchant: STORE_AR[o.store_id] ?? STORE_EN[o.store_id] ?? String(o.store_id), title: o.name ?? "", brand: raw(o.payload, "brand") ?? "غير مذكور",
      source_model_fields: sourceFields(o.payload),
      attributes: { ...vac(o.name ?? ""), ...hint(o.name ?? "") }, merchant_specs: specs(o.payload), url: cleanUrl(o.url),
    }));
    vSheet.push({ id, category: "مكنسة", listings });
    vKey.push({ id, key: g.key, stores: g.list.map((o) => o.store_id) });
  });
  // ── TV sheet ──
  const tSheet: unknown[] = []; const tKey: unknown[] = [];
  shuffle([...tby.entries()]).forEach(([key, L], i) => {
    const id = `T${String(i + 1).padStart(2, "0")}`;
    const listings = shuffle(L).map((o) => {
      const n = tvNormalize("", o.name ?? "", null, o.payload ?? {});
      return {
        merchant: STORE_AR[o.store_id] ?? STORE_EN[o.store_id] ?? String(o.store_id), title: o.name ?? "", brand: raw(o.payload, "brand") ?? "غير مذكور",
        source_model_fields: sourceFields(o.payload),
        model_found_in_title: titleShortModel(o.name ?? "") ?? n.model_number ?? null,
        attributes: { size: n.payload.screen_size ? `${n.payload.screen_size} بوصة` : (screenSizeOf(o.name ?? "") ? `${screenSizeOf(o.name ?? "")} بوصة` : "لم يُذكر"), panel: n.payload.panel ?? "لم يُذكر", refresh: n.payload.refresh_rate ? `${n.payload.refresh_rate} هرتز` : "لم يُذكر", resolution: n.payload.resolution ?? "لم تُذكر", ...hint(o.name ?? "") },
        url: cleanUrl(o.url),
      };
    });
    tSheet.push({ id, category: "تلفزيون", key, listings });
    const rep = changed.find((c) => c.key === key);
    tKey.push({ id, key, verifier_before: rep?.P0 ?? null, verifier_after: rep?.P3 ?? null });
  });

  mkdirSync(resolve(process.cwd(), OUT), { recursive: true }); mkdirSync(resolve(process.cwd(), KEY_OUT), { recursive: true });
  writeFileSync(resolve(process.cwd(), OUT, "vacuum32-sheet.json"), JSON.stringify(vSheet, null, 1));
  writeFileSync(resolve(process.cwd(), KEY_OUT, "vacuum32-key.json"), JSON.stringify(vKey, null, 1));
  writeFileSync(resolve(process.cwd(), OUT, "tv22-sheet.json"), JSON.stringify(tSheet, null, 1));
  writeFileSync(resolve(process.cwd(), KEY_OUT, "tv22-key.json"), JSON.stringify(tKey, null, 1));
  console.log(JSON.stringify({ vacuum_family_groups: vSheet.length, tv_changed_groups_found: tSheet.length, tv_expected: changed.length, vacuum_listings: (vSheet as { listings: unknown[] }[]).reduce((a, g) => a + g.listings.length, 0), tv_listings: (tSheet as { listings: unknown[] }[]).reduce((a, g) => a + g.listings.length, 0) }));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
