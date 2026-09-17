// scripts/worker/fetch-tini.js
//
// Downloads tini (the static, zero-dependency init binary krallin/tini
// publishes on GitHub Releases — the same tool Docker's own `--init` flag
// uses) into ./bin/tini for the isolated worker service to run as PID 1.
//
// RUNS AT CONTAINER START, NOT BUILD TIME — invoked as a prefix in
// railway.worker.toml's startCommand, not buildCommand. Proven live,
// 2026-09-17 (two full deploy cycles, the second a genuine cache-busted
// rebuild — not a caching artifact): a serviceInstanceUpdate `buildCommand`
// override is accepted, persisted, and echoed back by Railway's API, but
// Railpack does NOT actually apply it for this auto-detected Node/Next.js
// project — the real build kept running the ROOT railway.toml's buildCommand
// regardless. `startCommand` overrides, by contrast, are reliably applied
// (proven by the crash loop when bin/tini was referenced there before this
// fetch step existed at start time, and by the clean revert that followed).
// Running the fetch here avoids depending on the build-time path entirely.
// Cheap either way (~23KB, checked against its own hash first — see below),
// and self-healing: any container that starts without bin/tini re-fetches it.
//
// `curl` was confirmed ABSENT from the live tawveeri-worker runtime container
// (`railway ssh`, 2026-09-17); Node's own fetch() (18+, follows the GitHub
// release redirect automatically) avoids any external-binary dependency.
//
// The pinned sha256 is tini v0.19.0's own published checksum
// (github.com/krallin/tini/releases/download/v0.19.0/tini-amd64.sha256sum) —
// the download is verified against it and this script exits non-zero (so
// `&&` in startCommand stops before tini/node ever run) on any mismatch, so
// a compromised or altered asset can never silently become PID 1. Confirmed
// live (`railway ssh`) that the worker container is x86_64, so the amd64
// build is correct without runtime arch detection.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const TINI_VERSION = 'v0.19.0';
const TINI_URL = `https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-amd64`;
const TINI_SHA256 = '93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c';
const OUT_PATH = path.join(__dirname, '..', '..', 'bin', 'tini');

function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  // Skip the network round-trip on an ordinary restart-policy restart, which
  // reuses the same container filesystem (only a fresh deploy gets a new,
  // empty one) — but still verify the hash rather than trusting the file's
  // mere presence, since a partial/corrupted write must not silently pass.
  if (fs.existsSync(OUT_PATH)) {
    const existing = fs.readFileSync(OUT_PATH);
    if (sha256Of(existing) === TINI_SHA256) {
      console.log(`[fetch-tini] ${OUT_PATH} already present and verified — skipping download`);
      return;
    }
    console.log(`[fetch-tini] ${OUT_PATH} present but hash mismatch — re-downloading`);
  }

  console.log(`[fetch-tini] downloading ${TINI_URL}`);
  const res = await fetch(TINI_URL);
  if (!res.ok) {
    throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const actualSha256 = sha256Of(buf);
  if (actualSha256 !== TINI_SHA256) {
    throw new Error(
      `sha256 mismatch — expected ${TINI_SHA256}, got ${actualSha256}. ` +
      `Refusing to install a tini binary that doesn't match its published checksum.`,
    );
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, buf, { mode: 0o755 });
  fs.chmodSync(OUT_PATH, 0o755);
  console.log(`[fetch-tini] verified sha256 and installed to ${OUT_PATH} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error('[fetch-tini] FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
