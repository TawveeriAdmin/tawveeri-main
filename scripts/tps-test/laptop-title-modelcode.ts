// Read-only: extract MANUFACTURER model codes from TITLES (not retailer SKU
// fields) across all stores and check cross-store overlap. A shared manufacturer
// model code = genuine primary corroboration. No writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const F = ["raw_name.ilike.%laptop%", "raw_name.ilike.%لابتوب%", "raw_name.ilike.%لاب توب%", "raw_name.ilike.%notebook%", "raw_name.ilike.%macbook%", "raw_name.ilike.%ماك بوك%"].join(",");
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Manufacturer model-code patterns seen in titles across brands.
const CODE_PATTERNS: RegExp[] = [
  /\b1[0-9]-[a-z]{2}\d{3,4}[a-z]{2,3}\b/gi,     // HP 15-fd0056nx, 14-em0xxx
  /\b\d{2}[A-Z]{2,3}\d{2,4}[A-Z]{0,3}\b/g,       // Lenovo 15IRH10, 83K1..., 15IAN8
  /\b8[0-9][A-Z0-9]{5,7}\b/g,                     // Lenovo 82xx / 83xx machine types
  /\ba[0-9][a-z]{2,5}\d?\b/gi,                    // MSI A2xwjg style
  /\b(?:fa|fx|ga|gu|k|x|ux| um)\d{3}[a-z]{0,3}\b/gi, // Asus FA507, GA402, UX3405
  /\b(?:an|ph|nc|a)\d{3}-\d{2}[a-z]?\b/gi,        // Acer AN515-58, PH315
];
function codes(t: string): string[] {
  const out = new Set<string>();
  for (const re of CODE_PATTERNS) { const m = t.match(re); if (m) m.forEach((x) => { const v = x.toLowerCase().replace(/\s/g, ""); if (v.length >= 5 && /\d/.test(v) && /[a-z]/i.test(v)) out.add(v); }); }
  return [...out];
}

(async () => {
  const byCode = new Map<string, Map<string, string>>();
  let withCode = 0, total = 0;
  for (const st of STORES) {
    let page = 0;
    while (true) {
      const { data } = await sb.from("raw_observations").select("raw_name,payload").eq("store_id", st.id).or(F).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const row of data as { raw_name: string | null; payload: Record<string, unknown> | null }[]) {
        const p = row.payload ?? {};
        const title = [S(p.nameEn), S(p.name_en), S(p.title), S(p.nameAr), S(p.name_ar), S(p.name), S(row.raw_name)].filter(Boolean).join(" ");
        total++;
        const cs = codes(title);
        if (cs.length) withCode++;
        for (const c of cs) { if (!byCode.has(c)) byCode.set(c, new Map()); byCode.get(c)!.set(st.name, title.slice(0, 60)); }
      }
      if (data.length < 1000) break; page++; if (page > 5) break;
    }
  }
  const multi = [...byCode.entries()].filter(([, m]) => m.size >= 2);
  console.log(`rows=${total} rows_with_code=${withCode} distinct_codes=${byCode.size}`);
  console.log(`>=2-STORE SHARED MODEL CODES = ${multi.length}\n`);
  multi.slice(0, 40).forEach(([c, m]) => { console.log("CODE:", c); for (const [s, t] of m) console.log(`   ${s}: ${t}`); });
})().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
