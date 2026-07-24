// scripts/tps-core/pooler-url.js  (plain CommonJS — used by scheduler.js AND the
// Next debug route, so it must not be TS/ESM.)
//
// WHY (ADR-078): Supabase's DIRECT connection (db.<ref>.supabase.co:5432) is
// IPv6-only. Railway's runtime network is IPv4-only, so the scheduler's pg
// connections failed with "connect ENETUNREACH <ipv6>". The IPv4-reachable path
// is the Supabase POOLER. For this project the working endpoint (discovered by
// probing) is the aws-1 cluster in ap-southeast-2, session pooler on 5432, with
// the pooler username form `postgres.<ref>`.
//
// This rewrites a direct URL to the pooler form. It is a no-op for a URL that is
// already a pooler URL or not a Supabase direct URL, and every piece is
// overridable by env (SUPABASE_POOLER_HOST / _PORT) so a future region/cluster
// change needs a var, not a code edit. Locally (IPv6 works) it is harmless — the
// pooler is reachable from anywhere.

function toPoolerDbUrl(raw) {
  if (!raw) return raw;
  let url;
  try { url = new URL(raw); } catch { return raw; }
  if (url.hostname.includes('pooler.supabase.com')) return raw; // already pooled
  const m = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/i);
  if (!m) return raw; // not a Supabase direct URL — leave it alone
  const ref = m[1];
  const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com';
  const port = process.env.SUPABASE_POOLER_PORT || '5432';
  // url.password is already percent-encoded as it appeared in the URL.
  return `postgresql://postgres.${ref}:${url.password}@${host}:${port}/postgres`;
}

module.exports = { toPoolerDbUrl };
