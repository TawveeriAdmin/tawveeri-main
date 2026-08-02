// scripts/tps-analysis/tv-lowconf-sample.ts
// READ-ONLY. Answers CHECKPOINT #51's question for the TV slice: WHY do the
// low_confidence_candidate TVs score low — is the missing attribute present in
// the text we already hold (a parser fix) or genuinely absent (correctly
// rejected)? Sample BEFORE touching any threshold (the founder-prohibited move).
//
// Nothing is written. Every count is derived by re-running the SHIPPED tv
// parser/identity over the SAME source rows the sweep read (raw_observations),
// so a bucket here is reproducible by the pipeline, not by this script's opinion.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { tvPlugin } from "../tps-plugins/tv";
import { extractManufacturerModelFromName } from "../../src/lib/identity/store-identifiers";

const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const N = Number(process.argv[process.argv.indexOf("--n") + 1]) || 12;

// ── Recovery probes ──────────────────────────────────────────────────────────
// Deliberately LOOSER than the shipped parser. A hit means the evidence exists in
// the source record and the parser missed it; a miss means the listing genuinely
// never states it. These probes are NOT a proposed parser — they are the test.
const LOOSE_HZ = /(\d{2,3})\s*(?:hz|هرتز|هيرتز)/i;
const STRICT_HZ = /\b(60|75|100|120|144|165|240)\s*hz/i;   // what the parser accepts today
const MOTION_RATE = /motion\s*rate|mem[c]?\b|pqi|picture quality index|trumotion|clearmotion/i;
// Arabic phonetic spellings included: Extra publishes panel/resolution as transliterated
// Arabic in structured fields ('ميني ليد', 'كيو أل أي دي', '4كي فائق الوضوح').
const LOOSE_PANEL = /\b(lcd|uled|dled|d-?led|e-?led|mini[\s-]?led|micro[\s-]?led|nano[\s-]?cell|neo[\s-]?qled|qd[\s-]?oled|led\b)|شاشة\s*(?:ليد|إل\s*إي\s*دي)|او\s*ليد|أوليد|كيو\s*ليد|ميني\s*ليد|كيو\s*أل\s*أي\s*دي|ال\s*إي\s*دي|أو\s*أل\s*إي\s*دي|نانو|كريستال/i;
const LOOSE_RES = /\b(8k|4k|uhd|ultra\s*hd|fhd|full\s*hd|qhd|hd\b|2160p?|1080p?|1440p?|720p?|3840\s*[x×]\s*2160|1920\s*[x×]\s*1080|1366\s*[x×]\s*768)\b|فائق(?:ة)?\s*الوضوح|دقة|الترا\s*اتش\s*دي|فور\s*كي|\d\s*كي\b|يو\s*أتش\s*دي|اف\s*اتش\s*دي/i;

type Row = {
  raw_obs_id: number; store_id: number | null; identity_key: string; url: string | null;
  raw_name: string | null; payload: Record<string, unknown> | null; store_name: string | null;
};

function specText(p: Record<string, unknown>): string {
  // Everything the observation carries beyond the title — specs/attributes/description.
  // If a value lives here and not in the title, the parser (title-only) cannot see it.
  //
  // DO NOT TRUNCATE. A first version of this probe sliced at 4,000 chars and reported
  // Extra's refresh rate as "absent from evidence" — Extra's payload is ~19,500 chars and
  // its `featureAr*` fields sit past that cut. The instrument was manufacturing the finding.
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (/^(image|images|image_urls|url|productUrl|product_url)$/i.test(k)) continue;
    if (typeof v === "string") parts.push(`${k}=${v}`);
    else if (v && typeof v === "object") { try { parts.push(`${k}=${JSON.stringify(v)}`); } catch {} }
  }
  return parts.join(" | ");
}

(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // ── §1 population, at every unit that matters ──────────────────────────────
  const pop = await pg.query(`
    select count(*)::int obs, count(distinct identity_key)::int keys,
           count(distinct store_id)::int stores, count(distinct url)::int listings
    from tps_identity_staging where category='tv' and status='low_confidence_candidate'`);
  const valid = await pg.query(`
    select count(*)::int obs, count(distinct identity_key)::int keys
    from tps_identity_staging where category='tv' and status='valid'`);

  // The prize: low-conf keys ALREADY spanning >=2 stores. Only these can become
  // comparisons; the rest would add single-store inventory (the #49 verified rule).
  const spread = await pg.query(`
    select count(*)::int keys, sum(case when s>=2 then 1 else 0 end)::int multi_store,
           sum(case when s>=2 then obs else 0 end)::int multi_store_obs
    from (select identity_key, count(distinct store_id)::int s, count(*)::int obs
          from tps_identity_staging where category='tv' and status='low_confidence_candidate'
          group by 1) t`);

  console.log("═══ TV low_confidence_candidate — population ═══");
  console.log(pop.rows[0], "\nvalid tier for contrast:", valid.rows[0]);
  console.log("key spread:", spread.rows[0]);

  // ── §2 re-run the shipped parser over the SAME source rows ────────────────
  const rows: Row[] = [];
  let cursor = 0;
  for (;;) {
    const page = await pg.query<Row>(`
      select s.raw_obs_id, s.store_id, s.identity_key, s.url,
             r.raw_name, r.payload, st.name store_name
      from tps_identity_staging s
      join raw_observations r on r.id = s.raw_obs_id
      left join stores st on st.id = s.store_id
      where s.category='tv' and s.status='low_confidence_candidate' and s.raw_obs_id > $1
      order by s.raw_obs_id asc limit 5000`, [cursor]);
    if (!page.rows.length) break;
    rows.push(...page.rows);
    cursor = Number(page.rows[page.rows.length - 1].raw_obs_id);
  }
  console.log(`\nfetched ${rows.length} low-conf TV observations (joined to source)`);

  type Bucket = { obs: number; keys: Set<string>; listings: Set<string>; samples: { t: string; s: string; why: string }[] };
  const mk = (): Bucket => ({ obs: 0, keys: new Set(), listings: new Set(), samples: [] });
  const buckets = new Map<string, Bucket>();
  const add = (name: string, r: Row, title: string, why: string) => {
    const b = buckets.get(name) ?? mk(); buckets.set(name, b);
    b.obs++; b.keys.add(r.identity_key); if (r.url) b.listings.add(r.url);
    if (b.samples.length < N && !b.samples.some(x => x.t === title)) b.samples.push({ t: title, s: r.store_name ?? String(r.store_id), why });
  };

  let modelRecoverable = 0; const modelSamples: string[] = [];
  const modelKeys = new Set<string>();
  const axisMiss = { hz: 0, panel: 0, res: 0 };

  for (const r of rows) {
    const p = r.payload ?? {};
    const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(r.raw_name) ?? "";
    const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
    const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
    const title = (nameEn || nameAr).replace(/\s+/g, " ").slice(0, 110);
    const fullText = `${nameAr} ${nameEn}`;
    const specs = specText(p);

    const norm = tvPlugin.normalize(nameAr, nameEn, brand, p);
    const pay = norm.payload as Record<string, unknown>;
    const missHz = pay.refresh_rate == null, missPanel = !pay.panel, missRes = !pay.resolution;
    if (missHz) axisMiss.hz++; if (missPanel) axisMiss.panel++; if (missRes) axisMiss.res++;

    // Lever measured separately: ADR-175's title-model path (shipped, used by
    // laptop, NOT wired into tv). A hit here jumps the row to the PRIMARY valid
    // tier and skips the fallback key entirely — no threshold touched.
    const titleModel = extractManufacturerModelFromName(fullText);
    if (titleModel) {
      modelRecoverable++; modelKeys.add(r.identity_key);
      if (modelSamples.length < N) modelSamples.push(`${titleModel.padEnd(18)} ← ${title}`);
    }

    const axes = [missRes && "RES", missPanel && "PANEL", missHz && "HZ"].filter(Boolean).join("+") || "(none)";
    // Why did each missing axis miss? Evidence present vs genuinely absent.
    const why: string[] = [];
    if (missHz) {
      const looseTitle = LOOSE_HZ.exec(fullText);
      const looseSpec = LOOSE_HZ.exec(specs);
      if (looseTitle && !STRICT_HZ.test(fullText)) why.push(`HZ:value-not-in-allowlist(${looseTitle[1]})`);
      else if (looseTitle) why.push(`HZ:parser-miss(${looseTitle[1]})`);
      else if (looseSpec) why.push(`HZ:in-payload-not-title(${looseSpec[1]})`);
      else if (MOTION_RATE.test(fullText)) why.push("HZ:marketing-motion-rate-only");
      else why.push("HZ:absent-from-evidence");
    }
    if (missPanel) why.push(LOOSE_PANEL.test(fullText) ? "PANEL:vocab-gap" : LOOSE_PANEL.test(specs) ? "PANEL:in-payload-not-title" : "PANEL:absent-from-evidence");
    if (missRes) why.push(LOOSE_RES.test(fullText) ? "RES:vocab-gap" : LOOSE_RES.test(specs) ? "RES:in-payload-not-title" : "RES:absent-from-evidence");

    add(`missing=${axes}`, r, title, why.join(" · "));
    for (const w of why) {
      add(`why:${w.split("(")[0]}`, r, title, w);
      add(`store:${(r.store_name ?? String(r.store_id)).slice(0, 14)} :: ${w.split("(")[0]}`, r, title, w);
    }
  }

  const sorted = [...buckets].sort((a, b) => b[1].obs - a[1].obs);
  console.log(`\n═══ axis miss counts (observation level) ═══\n`, axisMiss);
  console.log(`\n═══ buckets — obs / distinct keys / distinct listings ═══`);
  for (const [name, b] of sorted) {
    if (name.startsWith("store:")) continue;
    console.log(`${name.padEnd(38)} obs=${String(b.obs).padStart(5)}  keys=${String(b.keys.size).padStart(4)}  listings=${String(b.listings.size).padStart(5)}`);
  }
  console.log(`\n═══ reason × store ═══`);
  for (const [name, b] of sorted) {
    if (!name.startsWith("store:")) continue;
    console.log(`${name.slice(6).padEnd(46)} obs=${String(b.obs).padStart(5)}  keys=${String(b.keys.size).padStart(4)}  listings=${String(b.listings.size).padStart(5)}`);
  }

  console.log(`\n═══ ADR-175 title-model lever (not wired into tv today) ═══`);
  console.log(`rows that WOULD yield a MODEL: primary key from the title: ${modelRecoverable}/${rows.length} (${(100 * modelRecoverable / Math.max(1, rows.length)).toFixed(1)}%), across ${modelKeys.size} of the low-conf keys`);
  for (const s of modelSamples) console.log("   " + s);

  console.log(`\n═══ samples per bucket ═══`);
  for (const [name, b] of sorted) {
    if (name.startsWith("why:")) continue;
    console.log(`\n── ${name}  (obs=${b.obs}, keys=${b.keys.size})`);
    for (const s of b.samples) console.log(`   [${(s.s ?? "").slice(0, 10).padEnd(10)}] ${s.t}\n        → ${s.why}`);
  }
  console.log(`\n═══ samples per REASON ═══`);
  for (const [name, b] of sorted) {
    if (!name.startsWith("why:")) continue;
    console.log(`\n── ${name}  (obs=${b.obs}, keys=${b.keys.size}, listings=${b.listings.size})`);
    for (const s of b.samples.slice(0, 6)) console.log(`   [${(s.s ?? "").slice(0, 10).padEnd(10)}] ${s.t}`);
  }

  await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
