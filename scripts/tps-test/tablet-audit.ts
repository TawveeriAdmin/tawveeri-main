// Read-only tablet buildability audit: per-store counts + whether cross-store
// matches on brand|model|generation|storage are TRUE same-product (like TV) or
// coincidental (like laptop). Prints actual titles behind each match. No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%tablet%", "raw_name.ilike.%تابلت%", "raw_name.ilike.%ipad%", "raw_name.ilike.%ايباد%", "raw_name.ilike.%galaxy tab%", "raw_name.ilike.%جالكسي تاب%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (t: string) => (t || "").toLowerCase();
const ACC = ["case", "كفر", "cover", "غطاء", "screen protector", "واقي", "keyboard", "لوحة مفاتيح", "pencil", "قلم", "stand", "حامل", "cable", "كابل", "charger", "شاحن", "bag", "حقيب"];
const isAcc = (t: string) => ACC.some((k) => norm(t).includes(k));

function brandOf(t: string): string | null { const x = norm(t); if (/ipad|ايباد|apple|ابل/.test(x)) return "apple"; if (/galaxy tab|جالكسي تاب|samsung|سامسون/.test(x)) return "samsung"; if (/huawei|هواوي|matepad/.test(x)) return "huawei"; if (/lenovo|لينوفو/.test(x)) return "lenovo"; if (/xiaomi|شاومي|redmi pad/.test(x)) return "xiaomi"; if (/nokia|نوكيا/.test(x)) return "nokia"; return null; }
function modelOf(t: string): string | null {
  const x = norm(t);
  // Apple iPad line + generation
  if (/ipad|ايباد/.test(x)) {
    if (/ipad pro/.test(x)) { const m = x.match(/ipad pro\s*(\d{1,2}\.?\d?)/); return "ipad pro" + (m ? " " + m[1] : ""); }
    if (/ipad air/.test(x)) { const m = x.match(/ipad air\s*(\d{1,2})|air\s*\(?(m\d)\)?/); return "ipad air" + (m ? " " + (m[1] || m[2]) : ""); }
    if (/ipad mini/.test(x)) { const m = x.match(/mini\s*(\d)/); return "ipad mini" + (m ? " " + m[1] : ""); }
    const g = x.match(/ipad\s*\(?(\d{1,2})(?:th|st|nd|rd)?\s*gen/); return "ipad" + (g ? " " + g[1] : "");
  }
  const gt = x.match(/galaxy tab\s*(s\d{1,2}\s*(?:ultra|plus|fe)?|a\d{1,2})/); if (gt) return "galaxy tab " + gt[1].trim();
  const mp = x.match(/matepad\s*(pro|air|\d{1,2}\.?\d?)?/); if (mp) return "matepad" + (mp[1] ? " " + mp[1] : "");
  return null;
}
function storageOf(t: string): string | null { const m = norm(t).match(/(\d{2,4})\s*gb|(\d)\s*tb/); if (!m) return null; if (m[2]) return (Number(m[2]) * 1024) + ""; const n = Number(m[1]); return [32, 64, 128, 256, 512, 1024].includes(n) ? n + "" : null; }

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
        const b = brandOf(t), m = modelOf(t), sto = storageOf(t);
        if (b && m && sto) keysByStore[st.name].set(`${b}|${m}|${sto}`, t.slice(0, 60));
      }
      if (data.length < 1000) break; page++; if (page > 4) break;
    }
    counts[st.name] = n;
  }
  const names = STORES.map((s) => s.name);
  console.log("counts:", names.map((n) => n + "=" + counts[n]).join(" "));
  console.log("precise-keys/store:", names.map((n) => n + "=" + keysByStore[n].size).join(" "));
  console.log("\n=== cross-store matches (brand|model|storage) with titles ===");
  let total = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = keysByStore[names[i]], b = keysByStore[names[j]];
    for (const k of a.keys()) if (b.has(k)) { total++; if (total <= 14) { console.log(`KEY ${k}  [${names[i]}+${names[j]}]`); console.log(`   ${names[i]}: ${a.get(k)}`); console.log(`   ${names[j]}: ${b.get(k)}`); } }
  }
  console.log(`\nTOTAL precise cross-store tablet matches = ${total}`);
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
