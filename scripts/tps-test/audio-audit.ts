// Read-only audio buildability audit: per-store counts + whether cross-store
// matches on brand|line|generation are TRUE same-product. Prints titles. No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%headphone%", "raw_name.ilike.%سماعة%", "raw_name.ilike.%earbuds%", "raw_name.ilike.%airpods%", "raw_name.ilike.%speaker%", "raw_name.ilike.%مكبر صوت%", "raw_name.ilike.%earphone%", "raw_name.ilike.%buds%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (t: string) => (t || "").toLowerCase();
const ACC = ["case", "كفر", "cover", "غطاء", "tips", "ear tips", "cable", "كابل", "stand", "حامل", "adapter", "محول", "replacement", "بديل", "mount", "holder"];
const isAcc = (t: string) => ACC.some((k) => norm(t).includes(k));

function brandOf(t: string): string | null {
  const x = norm(t);
  const B: [string, string[]][] = [["apple", ["apple", "ابل", "airpods", "ايربودز", "beats"]], ["sony", ["sony", "سوني"]], ["bose", ["bose", "بوز"]], ["jbl", ["jbl", "جي بي ال"]], ["samsung", ["samsung", "سامسون", "galaxy buds"]], ["anker", ["anker", "انكر", "soundcore", "ساوند كور"]], ["huawei", ["huawei", "هواوي", "freebuds"]], ["sennheiser", ["sennheiser"]], ["marshall", ["marshall", "مارشال"]]];
  for (const [c, ks] of B) if (ks.some((k) => x.includes(k))) return c;
  return null;
}
function modelOf(t: string): string | null {
  const x = norm(t);
  // Apple
  if (/airpods\s*max/.test(x)) return "airpods max";
  if (/airpods\s*pro/.test(x)) { const g = x.match(/airpods\s*pro\s*(\d)/); return "airpods pro" + (g ? " " + g[1] : (/2nd|gen\s*2/.test(x) ? " 2" : "")); }
  if (/airpods/.test(x)) { const g = x.match(/airpods\s*(\d)/); return "airpods" + (g ? " " + g[1] : ""); }
  if (/beats\s*(studio|solo|fit|flex)\s*(pro|buds|\d)?/.test(x)) { const m = x.match(/beats\s*(studio|solo|fit|flex)\s*(pro|buds|\d)?/); return "beats " + m![1] + (m![2] ? " " + m![2] : ""); }
  // Sony WH/WF
  const sony = x.match(/w[hf]-?(\d{4})([a-z]{0,2})/); if (sony) return "w" + (x.includes("wf") || x.includes("wf-") ? "f" : "h") + sony[1];
  // JBL
  const jbl = x.match(/(flip|charge|tune|clip|go|boombox|xtreme|live|wave)\s*(\d{1,3})/); if (jbl) return jbl[1] + " " + jbl[2];
  // Bose
  if (/quietcomfort\s*ultra/.test(x)) return "qc ultra";
  const bose = x.match(/quietcomfort\s*(\d{1,2})?|qc\s*(\d{1,2})/); if (bose) return "qc" + (bose[1] || bose[2] || "");
  // Samsung Galaxy Buds
  const gb = x.match(/galaxy buds\s*(\d|fe|pro|live|plus)?\s*(pro|fe)?/); if (gb) return "galaxy buds " + [gb[1], gb[2]].filter(Boolean).join(" ");
  // Anker soundcore
  const sc = x.match(/soundcore\s*([a-z0-9\s]{1,12})/); if (sc) return "soundcore " + sc[1].trim().split(/\s+/).slice(0, 2).join(" ");
  return null;
}

(async () => {
  const keysByStore: Record<string, Map<string, string>> = {};
  const counts: Record<string, number> = {};
  for (const st of STORES) {
    keysByStore[st.name] = new Map();
    let page = 0, n = 0;
    while (true) {
      const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const row of data as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
        const p = row.payload ?? {};
        const t = [S(p.nameEn), S(p.name_en), S(p.title), S(p.nameAr), S(p.name_ar), S(p.name), S(row.raw_name)].filter(Boolean).join(" ");
        if (isAcc(t)) continue;
        n++;
        const b = brandOf(t), m = modelOf(t);
        if (b && m) keysByStore[st.name].set(`${b}|${m}`, t.slice(0, 58));
      }
      if (data.length < 1000) break; page++; if (page > 4) break;
    }
    counts[st.name] = n;
  }
  const names = STORES.map((s) => s.name);
  console.log("counts:", names.map((n) => n + "=" + counts[n]).join(" "));
  console.log("precise-keys/store:", names.map((n) => n + "=" + keysByStore[n].size).join(" "));
  console.log("\n=== cross-store matches (brand|model) with titles ===");
  let total = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = keysByStore[names[i]], b = keysByStore[names[j]];
    for (const k of a.keys()) if (b.has(k)) { total++; if (total <= 16) { console.log(`KEY ${k}  [${names[i]}+${names[j]}]`); console.log(`   ${names[i]}: ${a.get(k)}`); console.log(`   ${names[j]}: ${b.get(k)}`); } }
  }
  console.log(`\nTOTAL precise cross-store audio matches = ${total}`);
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
