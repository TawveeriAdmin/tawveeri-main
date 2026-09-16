const fs = require('fs');
const path = require('path');

// Next standalone changes cwd and only copies traced files. The scheduled TS
// worker needs the source tree and tsconfig, which Railway retains at /app.
// Resolve this worker alone; do not change the cwd of other scheduled jobs.
function resolveSamsungDeltaRuntime(cwd) {
  const required = [
    'tsconfig.json',
    'scripts/tps-core/samsung-delta-watch.ts',
    'scripts/tps-core/category-registry.ts',
    'src/lib/scraping/stores/samsung-ksa-scraper.ts',
    'src/lib/scraping/config/store-configs/samsung_ksa.json',
  ];
  const candidates = [cwd];
  if (path.basename(cwd) === 'standalone' && path.basename(path.dirname(cwd)) === '.next') {
    candidates.unshift(path.resolve(cwd, '..', '..'));
  }
  for (const root of candidates) {
    if (required.every(file => fs.existsSync(path.join(root, file)))) {
      return { cwd: root, script: path.join(root, 'scripts/tps-core/samsung-delta-watch.ts') };
    }
  }
  throw new Error(`Samsung delta runtime incomplete in ${candidates.join(', ')}`);
}

module.exports = { resolveSamsungDeltaRuntime };
