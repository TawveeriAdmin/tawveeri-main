// Read-only diagnosis: per-store attribute extraction hit-rates + why Jarir/Extra
// laptop identity keys don't intersect. No writes.
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
  const perStore: Record<string, { n: number; brand: number; family: number; cpu: number; ram: number; storage: number; screen: number; keys: Set<string>; specKeys: Set<string>; sampleKeys: string[] }> = {};
  for (const st of STORES) {
    const s = perStore[st.name] = { n: 0, brand: 0, family: 0, cpu: 0, ram: 0, storage: 0, screen: 0, keys: new Set<string>(), specKeys: new Set<string>(), sampleKeys: [] as string[] };
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
        s.n++;
        const norm = N(nameAr, nameEn, brand, p);
        const pl = norm.payload as Record<string, unknown>;
        if (pl.brand) s.brand++;
        if (pl.family) s.family++;
        if (pl.cpu) s.cpu++;
        if (pl.ram) s.ram++;
        if (pl.storage) s.storage++;
        if (pl.screen) s.screen++;
        const id = laptopPlugin.buildIdentityKey(brand, pl, { model_number: norm.model_number });
        if (id.key && id.status !== "invalid") {
          s.keys.add(id.key);
          // spec-only key (brand|cpu|ram|storage) for looser overlap check
          s.specKeys.add(`${pl.brand}|${pl.cpu}|${pl.ram}|${pl.storage}`);
          if (s.sampleKeys.length < 6) s.sampleKeys.push(id.key);
        }
      }
      if (data.length < 1000) break; page++; if (page > 5) break;
    }
    const pct = (x: number) => s.n ? Math.round(x / s.n * 100) + "%" : "0%";
    console.log(`=== ${st.name} n=${s.n} | brand ${pct(s.brand)} family ${pct(s.family)} cpu ${pct(s.cpu)} ram ${pct(s.ram)} storage ${pct(s.storage)} screen ${pct(s.screen)} | fullKeys=${s.keys.size} specKeys=${s.specKeys.size}`);
    s.sampleKeys.forEach((k) => console.log("     " + k));
  }
  // Intersections
  const names = STORES.map((s) => s.name);
  console.log("\n=== full-key ∩ ===");
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = perStore[names[i]].keys, b = perStore[names[j]].keys; let ov = 0; const ex: string[] = [];
    for (const k of a) if (b.has(k)) { ov++; if (ex.length < 3) ex.push(k); }
    console.log(`  ${names[i]} ∩ ${names[j]} = ${ov}` + (ex.length ? " e.g. " + ex.join(" ; ") : ""));
  }
  console.log("=== spec-only key (brand|cpu|ram|storage) ∩ ===");
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = perStore[names[i]].specKeys, b = perStore[names[j]].specKeys; let ov = 0; const ex: string[] = [];
    for (const k of a) if (b.has(k) && !k.startsWith("null|") && !k.includes("|null|null")) { ov++; if (ex.length < 4) ex.push(k); }
    console.log(`  ${names[i]} ∩ ${names[j]} = ${ov}` + (ex.length ? " e.g. " + ex.join(" ; ") : ""));
  }
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
