// Read-only precision gate: print actual titles behind the proposed tablet keys
// to confirm single-model (safe) vs sibling over-merge. Also verifies A11 did not
// absorb A11+. No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { tabletPlugin, normalize as N } from "../tps-plugins/tablet";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%tablet%", "raw_name.ilike.%تابلت%", "raw_name.ilike.%ipad%", "raw_name.ilike.%ايباد%", "raw_name.ilike.%galaxy tab%", "raw_name.ilike.%جالكسي تاب%", "raw_name.ilike.%matepad%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const TARGET = ["huawei|matepad|NO_GEN|256|wifi|12", "huawei|matepad se|NO_GEN|128|wifi|11", "samsung|galaxy tab a11|NO_GEN|128|wifi|8.7"];

(async () => {
  const byKey = new Map<string, { store: string; title: string; price: unknown }[]>();
  const a11plus: string[] = [];
  for (const st of STORES) {
    const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).limit(125);
    for (const row of (data ?? []) as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
      const p = row.payload ?? {};
      const nameAr = S(p.nameAr) ?? S(p.name_ar) ?? S(p.name) ?? S(row.raw_name) ?? "";
      const nameEn = S(p.nameEn) ?? S(p.name_en) ?? S(p.title) ?? "";
      const brand = S(p.brandEn) ?? S(p.brand) ?? S(p.brandAr) ?? null;
      if (!tabletPlugin.detect(nameAr, nameEn)) continue;
      const norm = N(nameAr, nameEn, brand, p);
      const id = tabletPlugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (!id.key) continue;
      if (TARGET.includes(id.key)) {
        if (!byKey.has(id.key)) byKey.set(id.key, []);
        byKey.get(id.key)!.push({ store: st.name, title: (nameEn || nameAr).slice(0, 64), price: p.current_price ?? p.price ?? p.sellingPrice });
      }
      // capture how A11+ is keyed (should be "galaxy tab a11 plus", NOT a11)
      if (/a11\s*\+|a11\s*plus/i.test((nameEn || nameAr))) a11plus.push(`${(norm.payload as any).line}  <= ${(nameEn || nameAr).slice(0, 55)}`);
    }
  }
  for (const k of TARGET) {
    const list = byKey.get(k) ?? [];
    console.log(`\n=== ${k} (${list.length}) ===`);
    list.forEach((o) => console.log(`   ${o.store} [${o.price}]  ${o.title}`));
  }
  console.log("\n=== A11+ items — how are they keyed (must be 'a11 plus', not 'a11') ===");
  [...new Set(a11plus)].slice(0, 8).forEach((s) => console.log("   " + s));
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
