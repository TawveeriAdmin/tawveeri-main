// Read-only camera buildability audit: per-store counts + cross-store matches on
// brand|model with titles (body vs kit-lens is the precision risk). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%camera%", "raw_name.ilike.%كاميرا%", "raw_name.ilike.%dslr%", "raw_name.ilike.%mirrorless%", "raw_name.ilike.%eos%", "raw_name.ilike.%كانون%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const norm = (t: string) => (t || "").toLowerCase();
const ACC = ["lens only", "case", "كفر", "bag", "حقيب", "tripod", "ترايبود", "حامل", "strap", "battery", "بطارية", "charger", "شاحن", "cable", "كابل", "filter", "فلتر", "sd card", "بطاقة", "mount adapter", "cleaning", "flash only", "microphone", "ميكروفون", "gimbal", "قاعدة"];
const isAcc = (t: string) => ACC.some((k) => norm(t).includes(k));

function brandOf(t: string): string | null { const x = norm(t); if (/canon|كانون|eos/.test(x)) return "canon"; if (/nikon|نيكون/.test(x)) return "nikon"; if (/sony|سوني|alpha/.test(x)) return "sony"; if (/fujifilm|فوجي|fuji/.test(x)) return "fujifilm"; if (/panasonic|lumix/.test(x)) return "panasonic"; if (/gopro|جو برو/.test(x)) return "gopro"; if (/dji|dji/.test(x)) return "dji"; return null; }
function modelOf(t: string): string | null {
  const x = norm(t);
  const canon = x.match(/eos\s*(r\d{1,3}\s*(?:mark\s*[iv]+|ii|iii)?|\d{3,4}d|m\d{1,2})/); if (canon) return "eos " + canon[1].replace(/\s+/g, " ").trim();
  const powershot = x.match(/powershot\s*([a-z]?\d{1,3}[a-z]?)/); if (powershot) return "powershot " + powershot[1];
  const nikon = x.match(/\b(z\s*\d{1,2}|d\d{3,4})\b/); if (nikon) return nikon[1].replace(/\s+/g, "");
  const sony = x.match(/(?:alpha|a)\s*(\d{4}|7\s*[a-z]{0,2}\s*[iv]{0,3}|6\d{3})/); if (sony) return "a" + sony[1].replace(/\s+/g, "");
  const fuji = x.match(/x-?([a-z]\d{1,2}|t\d{1,2}|s\d{2})/); if (fuji) return "x-" + fuji[1];
  const gopro = x.match(/hero\s*(\d{1,2})/); if (gopro) return "hero " + gopro[1];
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
        if (b && m) keysByStore[st.name].set(`${b}|${m}`, t.slice(0, 60));
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
    for (const k of a.keys()) if (b.has(k)) { total++; if (total <= 14) { console.log(`KEY ${k}  [${names[i]}+${names[j]}]`); console.log(`   ${names[i]}: ${a.get(k)}`); console.log(`   ${names[j]}: ${b.get(k)}`); } }
  }
  console.log(`\nTOTAL precise cross-store camera matches = ${total}`);
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
