// scripts/tps-plugins/laptop/index.ts
// Assembles the four files into one CategoryPlugin per the tps-core contract.
// The laptop matcher calls `normalize` directly (payload-aware overload) for
// Almanea's structured ram/storage/model fields; detect/buildIdentityKey/
// scoreConfidence are consumed via this plugin object.
import type { CategoryPlugin } from "../../tps-core/types";
import { detect } from "./detector";
import { normalize } from "./parser";
import { buildIdentityKey } from "./identity";
import { scoreConfidence } from "./validator";

export const laptopPlugin: CategoryPlugin = {
  category: "laptop",
  version: "1.0.0",
  detect,
  normalize,
  buildIdentityKey,
  scoreConfidence,
};

export { detect, normalize, buildIdentityKey, scoreConfidence };
