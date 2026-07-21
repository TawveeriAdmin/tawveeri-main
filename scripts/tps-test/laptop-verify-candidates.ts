// Read-only: for each cross-store spec-only overlap key (brand|cpu|ram|storage),
// print the ACTUAL product titles from each store so we can judge by evidence
// whether they are the SAME laptop model (true corroboration) or a coincidental
// spec collision (must NOT merge — precision over recall). No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { laptopPlugin, normalize as N } from "../tps-plugins/laptop";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%laptop%", "raw_name.ilike.%لابتوب%", "raw_name.ilike.%لاب توب%", "raw_name.ilike.%notebook%", "raw_name.ilike.%macbook%", "raw_name.ilike.%ماك بوك%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

(async () => {
  // Collect spec-key -> {store -> [titles]}
  const bySpec = new Map<string, Map<string, string[]>>();
  for (const st of STORES) {
    let page = 0;
    while (true) {
      const { data } = await sb.from("raw_observations").select("id,raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const row of data as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
        const p = row.payload ?? {};
        const nameAr = S(p.nameAr) ?? S(p.name_ar) ?? S(p.name) ?? S(row.raw_name) ?? "";
        const nameEn = S(p.nameEn) ?? S(p.name_en) ?? S(p.title) ?? "";
        const brand = S(p.brandEn) ?? S(p.brand) ?? S(p.brandAr) ?? null;
        if (!laptopPlugin.detect(nameAr, nameEn)) continue;
        const norm = N(nameAr, nameEn, brand, p);
        const pl = norm.payload as Record<string, unknown>;
        if (!pl.brand || !pl.cpu || !pl.ram || !pl.storage) continue;
        const spec = `${pl.brand}|${pl.cpu}|${pl.ram}|${pl.storage}`;
        if (!bySpec.has(spec)) bySpec.set(spec, new Map());
        const m = bySpec.get(spec)!;
        if (!m.has(st.name)) m.set(st.name, []);
        m.get(st.name)!.push((nameEn || nameAr).slice(0, 70));
      }
      if (data.length < 1000) break; page++; if (page > 5) break;
    }
  }
  // Only specs present in >=2 stores
  const multi = [...bySpec.entries()].filter(([, m]) => m.size >= 2);
  console.log(`cross-store spec candidates = ${multi.length}\n`);
  for (const [spec, m] of multi) {
    console.log("SPEC:", spec);
    for (const [store, titles] of m) titles.slice(0, 3).forEach((t) => console.log(`   ${store}: ${t}`));
    console.log("");
  }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
