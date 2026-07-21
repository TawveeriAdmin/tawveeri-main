// Read-only precision gate: for the multi-offer TV keys proposed by the bounded
// matcher, print the ACTUAL titles per store so we can judge whether a key
// collapses ONE model (duplicate listings / price variants — safe) or DIFFERENT
// sub-models (over-merge — must refine the key). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { tvPlugin, normalize as N } from "../tps-plugins/tv";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%tv%", "raw_name.ilike.%تلفزيون%", "raw_name.ilike.%television%", "raw_name.ilike.%smart tv%", "raw_name.ilike.%شاشة%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const TARGET = ["hisense|65|4k|qled|144","tcl|65|4k|qled|60","skyworth|65|4k|qled|144","samsung|65|4k|oled|120","samsung|75|4k|neo_qled|144"];

(async () => {
  const byKey = new Map<string, { store: string; title: string; price: unknown; series: unknown }[]>();
  for (const st of STORES) {
    const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).limit(125);
    for (const row of (data ?? []) as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
      const p = row.payload ?? {};
      const nameAr = S(p.nameAr) ?? S(p.name_ar) ?? S(p.name) ?? S(row.raw_name) ?? "";
      const nameEn = S(p.nameEn) ?? S(p.name_en) ?? S(p.title) ?? "";
      const brand = S(p.brandEn) ?? S(p.brand) ?? S(p.brandAr) ?? null;
      if (!tvPlugin.detect(nameAr, nameEn)) continue;
      const norm = N(nameAr, nameEn, brand, p);
      const id = tvPlugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (!id.key || !TARGET.includes(id.key)) continue;
      if (!byKey.has(id.key)) byKey.set(id.key, []);
      byKey.get(id.key)!.push({ store: st.name, title: (nameEn || nameAr).slice(0, 62), price: p.current_price ?? p.price ?? p.sellingPrice, series: (norm.payload as Record<string, unknown>).series });
    }
  }
  for (const k of TARGET) {
    const list = byKey.get(k) ?? [];
    console.log(`\n=== ${k}  (${list.length} offers) ===`);
    list.forEach((o) => console.log(`   ${o.store} [${o.price}] series=${o.series ?? "-"}  ${o.title}`));
  }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
