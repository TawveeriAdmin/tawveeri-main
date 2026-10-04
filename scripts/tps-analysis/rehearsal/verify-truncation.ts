// verify-truncation.ts — proves the local PostgREST reproduces production's db-max-rows truncation (ADR-172).
//   npx tsx scripts/tps-analysis/rehearsal/verify-truncation.ts
import { createClient } from "@supabase/supabase-js";
import { LOCAL_URL, serviceKey } from "./lib";
(async () => {
  const sb = createClient(LOCAL_URL, serviceKey(), { auth: { persistSession: false } });
  const bare = await sb.from("normalized_product_observations").select("id").limit(5000);
  const lim = await sb.from("normalized_product_observations").select("id");
  const exact = await sb.from("normalized_product_observations").select("id", { count: "exact", head: true });
  const range = await sb.from("normalized_product_observations").select("id").order("id").range(0, 2999);
  console.log(JSON.stringify({ bareLimit5000_rows: bare.data?.length, bareLimit5000_error: bare.error?.message ?? null, noLimit_rows: lim.data?.length, range0_2999_rows: range.data?.length, exactCountHead: exact.count }));
  const ok = bare.data?.length === 1000 && lim.data?.length === 1000 && (exact.count ?? 0) > 1000;
  console.log(ok ? "PASS: truncation at 1000 reproduced silently (error=null); head count exact" : "FAIL");
  process.exitCode = ok ? 0 : 1;
})();
