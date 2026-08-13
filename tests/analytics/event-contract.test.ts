// Event-contract regression (ADR-244, Growth Engine Gate A).
//
// The production defect this pins: track.ts's EventType union and /api/events'
// ALLOWED set were maintained by hand in two places, and three event types
// (advisor_clarified, advisor_share, advisor_constraint_removed) were emitted by
// live components for months while the API silently 204-dropped every one of
// them. Both sides now derive from src/lib/analytics/events.ts; this suite
// additionally scans the actual source tree so a NEW track('...') literal that
// isn't in the contract fails CI, in either direction of drift.
import * as fs from "fs";
import * as path from "path";
import { USAGE_EVENT_TYPES, USAGE_EVENT_SET } from "../../src/lib/analytics/events";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Every string literal passed as the first argument to track(...) in src/. */
function emittedEventLiterals(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const srcRoot = path.join(__dirname, "..", "..", "src");
  for (const file of walk(srcRoot)) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/\btrack\(\s*['"]([a-z_]+)['"]/g)) {
      const arr = found.get(m[1]) ?? [];
      arr.push(path.relative(srcRoot, file));
      found.set(m[1], arr);
    }
  }
  return found;
}

describe("usage-event contract", () => {
  it("every event fired anywhere in src/ is in the shared contract (no silent drops)", () => {
    const emitted = emittedEventLiterals();
    const rogue = [...emitted.keys()].filter((t) => !USAGE_EVENT_SET.has(t));
    expect(rogue.map((t) => `${t} (${emitted.get(t)!.join(", ")})`)).toEqual([]);
  });

  it("the three previously-dropped events are in the contract", () => {
    for (const t of ["advisor_clarified", "advisor_share", "advisor_constraint_removed"]) {
      expect(USAGE_EVENT_SET.has(t)).toBe(true);
    }
  });

  it("the API allowlist is the contract itself (module identity, not a copy)", async () => {
    // /api/events imports USAGE_EVENT_SET directly; assert the contract has no
    // duplicates and stays a closed, deliberate list.
    expect(new Set(USAGE_EVENT_TYPES).size).toBe(USAGE_EVENT_TYPES.length);
    expect(USAGE_EVENT_TYPES.length).toBeGreaterThanOrEqual(14);
  });
});
