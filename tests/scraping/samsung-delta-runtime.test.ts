import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const { resolveSamsungDeltaRuntime } = require('../../scripts/tps-core/samsung-delta-runtime');

describe('Samsung worker runtime in a standalone deployment', () => {
  let root: string;
  function sourceTree(dir: string) {
    for (const file of ['tsconfig.json', 'scripts/tps-core/samsung-delta-watch.ts', 'scripts/tps-core/category-registry.ts', 'src/lib/scraping/stores/samsung-ksa-scraper.ts', 'src/lib/scraping/config/store-configs/samsung_ksa.json']) {
      const target = join(dir, file);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, '');
    }
  }
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'samsung-runtime-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });
  it('runs from the retained source root when standalone has only the scheduler', () => {
    sourceTree(root);
    const standalone = join(root, '.next', 'standalone');
    mkdirSync(standalone, { recursive: true });
    expect(resolveSamsungDeltaRuntime(standalone)).toEqual({ cwd: root, script: join(root, 'scripts/tps-core/samsung-delta-watch.ts') });
  });
  it('works from an ordinary source checkout', () => {
    sourceTree(root);
    expect(resolveSamsungDeltaRuntime(root).cwd).toBe(root);
  });
  it('accepts a complete standalone tree if no retained root exists', () => {
    const standalone = join(root, '.next', 'standalone');
    sourceTree(standalone);
    expect(resolveSamsungDeltaRuntime(standalone).cwd).toBe(standalone);
  });
  it('fails visibly when the source dependencies are missing', () => {
    mkdirSync(join(root, 'scripts/tps-core'), { recursive: true });
    writeFileSync(join(root, 'scripts/tps-core/samsung-delta-watch.ts'), '');
    expect(() => resolveSamsungDeltaRuntime(root)).toThrow('runtime incomplete');
  });
});
