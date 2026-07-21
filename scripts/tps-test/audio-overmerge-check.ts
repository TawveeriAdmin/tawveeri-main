// Read-only precision gate: print titles behind proposed audio keys to confirm
// single-model vs generation over-merge (e.g. FreeBuds SE vs SE 2/3). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { audioPlugin, normalize as N } from "../tps-plugins/audio";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%headphone%", "raw_name.ilike.%سماعة%", "raw_name.ilike.%earbuds%", "raw_name.ilike.%airpods%", "raw_name.ilike.%speaker%", "raw_name.ilike.%مكبر صوت%", "raw_name.ilike.%earphone%", "raw_name.ilike.%buds%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const TARGET = ["huawei|freebuds se", "apple|airpods pro 3", "apple|airpods 4", "jbl|go 4", "jbl|clip 5"];

(async () => {
  const byKey = new Map<string, { store: string; t: string; price: unknown }[]>();
  for (const st of STORES) {
    const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).limit(125);
    for (const row of (data ?? []) as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
      const p = row.payload ?? {};
      const nameAr = S(p.nameAr) ?? S(p.name_ar) ?? S(p.name) ?? S(row.raw_name) ?? "";
      const nameEn = S(p.nameEn) ?? S(p.name_en) ?? S(p.title) ?? "";
      const brand = S(p.brandEn) ?? S(p.brand) ?? S(p.brandAr) ?? null;
      if (!audioPlugin.detect(nameAr, nameEn)) continue;
      const norm = N(nameAr, nameEn, brand, p);
      const id = audioPlugin.buildIdentityKey(brand, norm.payload, {});
      if (!id.key || !TARGET.includes(id.key)) continue;
      if (!byKey.has(id.key)) byKey.set(id.key, []);
      byKey.get(id.key)!.push({ store: st.name, t: (nameEn || nameAr).slice(0, 62), price: p.current_price ?? p.price ?? p.sellingPrice });
    }
  }
  for (const k of TARGET) { const l = byKey.get(k) ?? []; console.log(`\n=== ${k} (${l.length}) ===`); l.slice(0, 6).forEach((o) => console.log(`   ${o.store} [${o.price}] ${o.t}`)); }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
