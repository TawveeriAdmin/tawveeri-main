// scripts/tps-acquisition/discover.ts
// ─────────────────────────────────────────────────────────────────────────────
// ACQUISITION ENGINE · Discovery layer (credential-free, no WebSearch).
//
// Enumerates candidate store hosts on a platform's default-domain space using the public
// Common Crawl URL index (CDX) — a free, massive web index queryable by domain. This finds
// stores on platform-provided subdomains (e.g. *.zid.store, *.salla.sa). High-value stores
// often use CUSTOM domains (invisible to a domain-scoped index), so this is ONE source of a
// pluggable set — its yield is measured, not assumed. Writes nothing; prints candidate hosts.
//
// Usage: npx tsx scripts/tps-acquisition/discover.ts <platform-domain> [--limit N]
//   e.g. npx tsx scripts/tps-acquisition/discover.ts zid.store
//        npx tsx scripts/tps-acquisition/discover.ts salla.sa --limit 30000
// ─────────────────────────────────────────────────────────────────────────────

const CC_INDEX = "CC-MAIN-2026-25";
const INFRA_PREFIXES = ["www.", "media.", "cdn.", "assets.", "api.", "img.", "images.", "static.", "s.", "cdn-"];

/** Query the Common Crawl CDX index for all crawled URLs under a domain (+ subdomains),
 *  return unique store-like hostnames (infra/CDN subdomains filtered out). */
export async function discoverFromCommonCrawl(platformDomain: string, limit = 20000): Promise<string[]> {
  const url = `https://index.commoncrawl.org/${CC_INDEX}-index?url=${encodeURIComponent(platformDomain)}&matchType=domain&fl=url&output=json&limit=${limit}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 150000);
  let text: string;
  try {
    const res = await fetch(url, { headers: { "user-agent": "TawveeriBot/1.0 (+acquisition)" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
    text = await res.text();
  } finally { clearTimeout(t); }

  const hosts = new Set<string>();
  let lines = 0;
  for (const line of text.split(/\n/)) {
    if (!line.trim()) continue;
    lines++;
    try {
      const host = new URL(JSON.parse(line).url).hostname.toLowerCase();
      if (!host.endsWith("." + platformDomain) && host !== platformDomain) continue;
      if (host === platformDomain || INFRA_PREFIXES.some((p) => host.startsWith(p))) continue;
      hosts.add(host);
    } catch { /* skip malformed */ }
  }
  console.error(`[cc] ${platformDomain}: ${lines} index rows → ${hosts.size} unique store hosts`);
  return [...hosts].sort();
}

if (require.main === module) {
  (async () => {
    const domain = process.argv[2];
    if (!domain) { console.error("usage: discover <platform-domain> [--limit N]"); process.exit(1); }
    const li = process.argv.indexOf("--limit");
    const limit = li > -1 ? Number(process.argv[li + 1]) || 20000 : 20000;
    const hosts = await discoverFromCommonCrawl(domain, limit);
    for (const h of hosts) console.log(h);
  })().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
}
