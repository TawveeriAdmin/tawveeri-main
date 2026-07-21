// Read-only: for each candidate category, count per-store real products AND
// measure the cross-store corroboration ceiling on a category-appropriate proxy
// identity. Picks the next-highest-impact TPS category by EVIDENCE, not by raw
// counts (laptop taught us counts != corroboration). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (t: string) => (t || "").toLowerCase();

function brandOf(t: string): string | null {
  const x = norm(t);
  const B: [string, string[]][] = [
    ["samsung", ["samsung", "سامسون"]], ["lg", ["lg", "ال جي", "إل جي"]], ["sony", ["sony", "سوني"]],
    ["tcl", ["tcl", "تي سي"]], ["hisense", ["hisense", "هايسنس"]], ["toshiba", ["toshiba", "توشيبا"]],
    ["apple", ["apple", "ابل", "ايباد", "ipad", "airpods"]], ["huawei", ["huawei", "هواوي"]],
    ["dell", ["dell"]], ["nikon", ["nikon", "نيكون"]], ["canon", ["canon", "كانون"]],
    ["jbl", ["jbl"]], ["bose", ["bose", "بوز"]], ["anker", ["anker", "انكر"]], ["xiaomi", ["xiaomi", "شاومي", "redmi"]],
    ["panasonic", ["panasonic", "باناسونيك"]], ["philips", ["philips", "فيليبس"]], ["daikin", ["daikin"]],
  ];
  for (const [c, ks] of B) if (ks.some((k) => x.includes(k))) return c;
  return null;
}
// proxies per category (identity-ish tokens)
function tvKey(t: string): string | null { const b = brandOf(t); const x = norm(t); const inch = (x.match(/\b(3[0-9]|[4-9][0-9]|1[0-9]{2})\s*(?:inch|"|بوصة|انش)/) || [])[1]; const res = x.match(/8k/) ? "8k" : x.match(/4k|uhd/) ? "4k" : x.match(/full hd|fhd|1080/) ? "fhd" : null; return b && inch ? `${b}|${inch}|${res || "?"}` : null; }
function tabletKey(t: string): string | null { const b = brandOf(t); const x = norm(t); const sto = (x.match(/(\d{2,4})\s*gb/) || [])[1]; const model = (x.match(/(ipad(?:\s*(?:air|pro|mini))?|galaxy\s*tab\s*[a-z]?\d*|tab\s*[a-z]\d)/) || [])[1]; return b && (model || sto) ? `${b}|${model || "?"}|${sto || "?"}` : null; }
function applianceKey(t: string): string | null { const b = brandOf(t); const x = norm(t); const cap = (x.match(/(\d{1,2}(?:\.\d)?)\s*(?:kg|كجم|كيلو|cu|قدم|لتر|liter)/) || [])[1]; const type = x.match(/wash|غسال/) ? "washer" : x.match(/fridge|refriger|ثلاج/) ? "fridge" : x.match(/dryer|نشاف/) ? "dryer" : x.match(/dishwash|جلاي/) ? "dishwasher" : null; return b && type && cap ? `${b}|${type}|${cap}` : null; }
function audioKey(t: string): string | null { const b = brandOf(t); const x = norm(t); const model = (x.match(/(airpods(?:\s*pro|\s*max)?|wh-\d{4}|wf-\d{4}|quietcomfort|flip\s*\d|charge\s*\d|tune\s*\d{3})/) || [])[1]; return b && model ? `${b}|${model}` : null; }
function cameraKey(t: string): string | null { const b = brandOf(t); const x = norm(t); const model = (x.match(/(eos\s*[a-z0-9]+|z\s*\d{1,2}|d\d{3,4}|alpha\s*[a-z0-9]+|a\d{4})/) || [])[1]; return b && model ? `${b}|${model}` : null; }

const CATS: { name: string; filters: string[]; key: (t: string) => string | null }[] = [
  { name: "TV", filters: ["%tv%", "%تلفزيون%", "%television%", "%led tv%", "%شاشة تلفزيون%", "%smart tv%"], key: tvKey },
  { name: "TABLET", filters: ["%tablet%", "%تابلت%", "%ipad%", "%ايباد%", "%galaxy tab%", "%جالكسي تاب%"], key: tabletKey },
  { name: "APPLIANCE", filters: ["%washing machine%", "%غسالة%", "%refrigerator%", "%ثلاجة%", "%dryer%", "%dishwasher%"], key: applianceKey },
  { name: "AUDIO", filters: ["%headphone%", "%سماعة%", "%earbuds%", "%airpods%", "%speaker%", "%مكبر صوت%"], key: audioKey },
  { name: "CAMERA", filters: ["%camera%", "%كاميرا%", "%dslr%", "%mirrorless%"], key: cameraKey },
];

(async () => {
  for (const cat of CATS) {
    const orF = cat.filters.map((f) => `raw_name.ilike.${f}`).join(",");
    const keysByStore: Record<string, Map<string, string>> = {};
    const counts: Record<string, number> = {};
    for (const st of STORES) {
      keysByStore[st.name] = new Map();
      let page = 0, n = 0;
      while (true) {
        const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(orF).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
        if (!data || !data.length) break;
        for (const row of data as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
          const p = row.payload ?? {};
          const t = [S(p.nameEn), S(p.name_en), S(p.title), S(p.nameAr), S(p.name_ar), S(p.name), S(row.raw_name)].filter(Boolean).join(" ");
          n++;
          const k = cat.key(t);
          if (k) keysByStore[st.name].set(k, t.slice(0, 55));
        }
        if (data.length < 1000) break; page++; if (page > 4) break;
      }
      counts[st.name] = n;
    }
    // cross-store overlap
    const names = STORES.map((s) => s.name);
    let bestPair = "", bestOv = 0; const examples: string[] = [];
    let totalCorr = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = keysByStore[names[i]], b = keysByStore[names[j]]; let ov = 0;
      for (const k of a.keys()) if (b.has(k) && !k.includes("|?|?") && !k.endsWith("|?")) { ov++; if (examples.length < 4) examples.push(`${k}  [${names[i]}+${names[j]}]`); }
      totalCorr += ov; if (ov > bestOv) { bestOv = ov; bestPair = `${names[i]}∩${names[j]}`; }
    }
    console.log(`\n=== ${cat.name} ===  counts: ${names.map((n) => n + "=" + counts[n]).join(" ")}`);
    console.log(`   proxy-keys/store: ${names.map((n) => n + "=" + keysByStore[n].size).join(" ")}`);
    console.log(`   CORROBORATION (sum over pairs) = ${totalCorr} | best ${bestPair}=${bestOv}`);
    examples.forEach((e) => console.log("     e.g. " + e));
  }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
