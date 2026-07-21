// Read-only: measures the TRUE >=2-store laptop corroboration ceiling across the
// FULL catalog using the actual laptop plugin. No writes. Diagnostic only.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { laptopPlugin, normalize as N } from "../tps-plugins/laptop";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 2, name: "أمازون" }, { id: 4, name: "اكسترا" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%laptop%", "raw_name.ilike.%لابتوب%", "raw_name.ilike.%لاب توب%", "raw_name.ilike.%notebook%", "raw_name.ilike.%macbook%", "raw_name.ilike.%ماك بوك%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

(async () => {
  const groups = new Map<string, { stores: Set<number>; ex: string[] }>();
  let total = 0, considered = 0, valid = 0;
  for (const st of STORES) {
    let page = 0, got = 0;
    while (true) {
      const { data, error } = await sb.from("raw_observations").select("id,store_id,raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (error) { console.log("ERR fetch", st.name, error.message); break; }
      if (!data || !data.length) break;
      total += data.length; got += data.length;
      for (const row of data as { id: number; store_id: number; raw_name: string | null; payload: Record<string, unknown> | null }[]) {
        const p = row.payload ?? {};
        const nameAr = S(p.nameAr) ?? S(p.name_ar) ?? S(p.name) ?? S(row.raw_name) ?? "";
        const nameEn = S(p.nameEn) ?? S(p.name_en) ?? S(p.title) ?? "";
        const brand = S(p.brandEn) ?? S(p.brand) ?? S(p.brandAr) ?? null;
        if (!laptopPlugin.detect(nameAr, nameEn)) continue; considered++;
        const norm = N(nameAr, nameEn, brand, p);
        const id = laptopPlugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (!id.key || id.status === "invalid") continue; valid++;
        if (!groups.has(id.key)) groups.set(id.key, { stores: new Set(), ex: [] });
        const g = groups.get(id.key)!; g.stores.add(row.store_id);
        if (g.ex.length < 3) g.ex.push(st.name + ": " + (nameEn || nameAr).slice(0, 48));
      }
      if (data.length < 1000) break; page++; if (page > 5) break;
    }
    console.log(`  scanned ${st.name}: ${got} rows`);
  }
  const multi = [...groups.entries()].filter(([, g]) => g.stores.size >= 2);
  console.log(`\ntotal_rows=${total} considered=${considered} valid_identity=${valid} distinct_keys=${groups.size}`);
  console.log(`>=2-STORE CORROBORATED KEYS = ${multi.length}\n`);
  multi.sort((a, b) => b[1].stores.size - a[1].stores.size).slice(0, 30).forEach(([k, g]) => {
    console.log(`[${[...g.stores].join(",")}] ${k}`);
    g.ex.forEach((e) => console.log("     " + e));
  });
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
