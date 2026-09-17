// scripts/worker/fetch-tini.js
//
// Downloads tini (the static, zero-dependency init binary krallin/tini
// publishes on GitHub Releases — the same tool Docker's own `--init` flag
// uses) into ./bin/tini for the isolated worker service to run as PID 1.
//
// WHY a Node script instead of a shell one-liner in railway.worker.toml's
// buildCommand: `curl` was confirmed ABSENT from the live tawveeri-worker
// runtime container (checked via `railway ssh`, 2026-09-17); whether
// Railpack's build stage has curl/wget is undocumented and not worth
// depending on. Node itself is guaranteed present in both stages (buildCommand
// already runs npm), and Node 18+'s global fetch() follows redirects
// automatically (GitHub release asset URLs redirect to a signed blob URL) —
// so this has no external-binary dependency at all.
//
// The pinned sha256 is tini v0.19.0's own published checksum
// (github.com/krallin/tini/releases/download/v0.19.0/tini-amd64.sha256sum) —
// the download is verified against it and the build fails closed on any
// mismatch, so a compromised or altered asset can never silently become PID 1.
// Confirmed live (2026-09-17, `railway ssh`) that the worker container is
// x86_64, so the amd64 build is correct without runtime arch detection.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const TINI_VERSION = 'v0.19.0';
const TINI_URL = `https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-amd64`;
const TINI_SHA256 = '93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c';
const OUT_PATH = path.join(__dirname, '..', '..', 'bin', 'tini');

async function main() {
  console.log(`[fetch-tini] downloading ${TINI_URL}`);
  const res = await fetch(TINI_URL);
  if (!res.ok) {
    throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const actualSha256 = crypto.createHash('sha256').update(buf).digest('hex');
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
