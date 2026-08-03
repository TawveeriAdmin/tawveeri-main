// scripts/tps-analysis/sitemap-verify.ts
// ADR-189 — DOES THE SITEMAP POINT AT PAGES THAT EXIST?
//
// It did not. Measured on production 2026-08-03: **1,190 of 1,190 product URLs returned 404**
// (`/product/` 307 → `/products/` → 404), because the sitemap published KNOWLEDGE-layer identity
// slugs at a route that resolves STOREFRONT `products.slug`. Nothing in the repo checked, so the
// only symptom was that search engines surfaced our «المنتج غير موجود» page for «توفيري».
//
// Same failure class as ADR-186: a thing the customer depends on, owned by nobody, watched by
// nothing. This is the watcher. It samples each URL class in the LIVE sitemap and asserts the
// pages resolve — because a sitemap is a claim, and we do not publish claims we have not checked.
//
//   npx tsx scripts/tps-analysis/sitemap-verify.ts [--base https://tawveeri.com] [--sample 12]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("--base", "https://tawveeri.com").replace(/\/$/, "");
const SAMPLE = Number(arg("--sample", "12"));

let failures = 0;
const check = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

/** Deterministic spread across a list — never just the first N, which are the ones most likely to work. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

type Klass = "compare" | "product" | "static";
const classify = (u: string): Klass =>
  /\/compare\//.test(u) ? "compare" : /\/products\//.test(u) ? "product" : "static";

(async () => {
  console.log(`\nSITEMAP VERIFICATION — ${BASE}`);
  console.log("=".repeat(72) + "\n");

  const res = await fetch(`${BASE}/sitemap.xml`);
  check(res.ok, "sitemap.xml is served", `status ${res.status}`);
  if (!res.ok) { console.log(`\nGATE: FAIL — ${failures} check(s) failing\n`); process.exit(1); }

  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const byClass: Record<Klass, string[]> = { compare: [], product: [], static: [] };
  for (const u of urls) byClass[classify(u)].push(u);

  console.log(`  ${urls.length} URLs — compare ${byClass.compare.length} · product ${byClass.product.length} · static ${byClass.static.length}\n`);

  // The comparison pages are the reason this file exists. Their absence is a failure, not a note.
  check(byClass.compare.length > 0, "comparison pages are offered for indexing", `${byClass.compare.length} present`);
  check(byClass.product.length > 0, "product pages are offered for indexing", `${byClass.product.length} present`);

  for (const klass of ["compare", "product", "static"] as Klass[]) {
    const sample = spread(byClass[klass], SAMPLE);
    if (!sample.length) continue;
    let ok = 0; const dead: string[] = [];
    for (const u of sample) {
      // `redirect: follow` on purpose — a URL that only works after a redirect is still a URL we
      // published wrongly, and the FINAL status is what a crawler records.
      const r = await fetch(u, { redirect: "follow" }).catch(() => null);
      if (r && r.status === 200) ok++;
      else dead.push(`${r?.status ?? "ERR"} ${u.replace(BASE, "")}`);
    }
    check(dead.length === 0, `every sampled ${klass} URL resolves 200`, `${ok}/${sample.length} ok`);
    for (const d of dead.slice(0, 5)) console.log(`        ✗ ${d}`);
  }

  // robots.txt must not forbid what the sitemap offers. These two files disagreed for months:
  // the comparison pages were disallowed AND absent, and nothing compared them.
  const robots = await (await fetch(`${BASE}/robots.txt`)).text().catch(() => "");
  const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
  const conflict = byClass.compare.length > 0 && disallows.some((d) => /\/compare\/?\*?$|\/\*\/compare\/$/.test(d));
  check(!conflict, "robots.txt does not disallow what the sitemap offers", conflict ? `disallow rules: ${disallows.join(" ")}` : "no conflict");

  console.log("\n" + "=".repeat(72));
  console.log(failures === 0 ? "GATE: PASS" : `GATE: FAIL — ${failures} check(s) failing`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
