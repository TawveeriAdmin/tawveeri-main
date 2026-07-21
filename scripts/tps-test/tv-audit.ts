// Read-only TV audit: per-store payload structure + model-number availability +
// title patterns, and cross-store corroboration on a PROPER TV key
// (brand|size|resolution|panel) with actual matched titles printed so we can
// confirm TRUE same-product matches (not coincidental collisions). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%tv%", "raw_name.ilike.%تلفزيون%", "raw_name.ilike.%television%", "raw_name.ilike.%شاشة%", "raw_name.ilike.%smart tv%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (t: string) => (t || "").toLowerCase();

const ACC = ["mount", "حامل", "bracket", "ستاند", "stand for", "wall mount", "remote", "ريموت", "cable", "كابل", "protector", "واقي", "box", "رسيفر", "receiver", "antenna", "هوائي", "soundbar", "سماعة"];
const isAcc = (t: string) => ACC.some((k) => norm(t).includes(k));

function brandOf(t: string): string | null {
  const x = norm(t);
  const B: [string, string[]][] = [["samsung", ["samsung", "سامسون"]], ["lg", ["lg ", " lg", "ال جي", "إل جي"]], ["sony", ["sony", "سوني"]], ["tcl", ["tcl", "تي سي"]], ["hisense", ["hisense", "هايسنس", "هايسينس"]], ["toshiba", ["toshiba", "توشيبا"]], ["nikai", ["nikai", "نيكاي"]], ["panasonic", ["panasonic", "باناسونيك"]], ["philips", ["philips", "فيليبس"]], ["dansat", ["dansat", "دان سات"]], ["skyworth", ["skyworth"]], ["haier", ["haier", "هاير"]]];
  for (const [c, ks] of B) if (ks.some((k) => x.includes(k))) return c;
  return null;
}
function sizeOf(t: string): string | null { const m = norm(t).match(/\b(3[2-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|”|بوصة|انش|إنش)/); return m ? m[1] : null; }
function resOf(t: string): string | null { const x = norm(t); if (/8k/.test(x)) return "8k"; if (/4k|uhd|ultra hd/.test(x)) return "4k"; if (/full hd|fhd|1080/.test(x)) return "fhd"; if (/\bhd\b|720/.test(x)) return "hd"; return null; }
function panelOf(t: string): string | null { const x = norm(t); if (/neo\s*qled/.test(x)) return "neo_qled"; if (/\boled\b/.test(x)) return "oled"; if (/qned/.test(x)) return "qned"; if (/nanocell|nano cell/.test(x)) return "nanocell"; if (/\bqled\b/.test(x)) return "qled"; if (/mini\s*led/.test(x)) return "mini_led"; if (/crystal/.test(x)) return "crystal"; if (/\bled\b/.test(x)) return "led"; return null; }
function modelOf(payload: Record<string, unknown>): string | null {
  for (const c of [payload.model, payload.sku, payload.mpn]) { const s = typeof c === "string" ? c.trim() : ""; if (s && /^[A-Za-z0-9][A-Za-z0-9\-\/.]{4,18}$/.test(s) && /[A-Za-z]/.test(s) && /\d/.test(s) && !/^B0[A-Z0-9]{8}$/i.test(s) && !/^\d{5,8}$/.test(s)) return s.toUpperCase(); }
  return null;
}

(async () => {
  const keysByStore: Record<string, Map<string, string>> = {};
  const modelByStore: Record<string, Map<string, string>> = {};
  const stats: Record<string, { n: number; real: number; brand: number; size: number; res: number; panel: number; model: number }> = {};
  for (const st of STORES) {
    keysByStore[st.name] = new Map(); modelByStore[st.name] = new Map();
    const s = stats[st.name] = { n: 0, real: 0, brand: 0, size: 0, res: 0, panel: 0, model: 0 };
    let page = 0, sampled = 0;
    while (true) {
      const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const row of data as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
        const p = row.payload ?? {};
        const t = [S(p.nameEn), S(p.name_en), S(p.title), S(p.nameAr), S(p.name_ar), S(p.name), S(row.raw_name)].filter(Boolean).join(" ");
        s.n++;
        if (isAcc(t)) continue;
        const b = brandOf(t), sz = sizeOf(t), r = resOf(t), pan = panelOf(t), mdl = modelOf(p);
        if (!b || !sz) continue; // a TV needs at least brand + size
        s.real++;
        if (b) s.brand++; if (sz) s.size++; if (r) s.res++; if (pan) s.panel++; if (mdl) s.model++;
        const key = `${b}|${sz}|${r || "?"}|${pan || "?"}`;
        keysByStore[st.name].set(key, t.slice(0, 58));
        if (mdl) modelByStore[st.name].set(`${b}|MODEL:${mdl}`, t.slice(0, 58));
        if (sampled < 2 && st.name === "جرير") { console.log(`  [جرير sample] model=${mdl} keys=${p.model} | ${t.slice(0, 70)}`); sampled++; }
      }
      if (data.length < 1000) break; page++; if (page > 4) break;
    }
    const pct = (x: number) => s.real ? Math.round(x / s.real * 100) + "%" : "0%";
    console.log(`=== ${st.name} n=${s.n} real=${s.real} | brand ${pct(s.brand)} size ${pct(s.size)} res ${pct(s.res)} panel ${pct(s.panel)} model ${pct(s.model)} | keys=${keysByStore[st.name].size} modelKeys=${modelByStore[st.name].size}`);
  }
  const names = STORES.map((s) => s.name);
  console.log("\n=== FALLBACK key (brand|size|res|panel) corroboration ===");
  let fbTotal = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = keysByStore[names[i]], b = keysByStore[names[j]]; let ov = 0; const ex: string[] = [];
    for (const k of a.keys()) if (b.has(k) && !k.includes("|?|?")) { ov++; fbTotal++; if (ex.length < 3) ex.push(k); }
    if (ov) console.log(`  ${names[i]}∩${names[j]}=${ov}  e.g. ${ex.join(" ; ")}`);
  }
  console.log(`  FALLBACK total corroborated store-pairs = ${fbTotal}`);
  console.log("=== PRIMARY key (brand|MODEL) corroboration ===");
  let pmTotal = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = modelByStore[names[i]], b = modelByStore[names[j]]; let ov = 0; const ex: string[] = [];
    for (const k of a.keys()) if (b.has(k)) { ov++; pmTotal++; if (ex.length < 3) ex.push(k); }
    if (ov) console.log(`  ${names[i]}∩${names[j]}=${ov}  e.g. ${ex.join(" ; ")}`);
  }
  console.log(`  PRIMARY total = ${pmTotal}`);
  // Print a few full fallback matched pairs with titles to confirm TRUE match
  console.log("\n=== SAMPLE matched fallback pairs (confirm true same-product) ===");
  let shown = 0;
  const jr = keysByStore["جرير"], ex = keysByStore["اكسترا"];
  for (const k of jr.keys()) { if (ex.has(k) && !k.includes("|?|?") && shown < 6) { console.log(`KEY ${k}`); console.log(`   جرير:  ${jr.get(k)}`); console.log(`   اكسترا: ${ex.get(k)}`); shown++; } }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
