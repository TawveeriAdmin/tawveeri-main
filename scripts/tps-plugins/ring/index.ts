// scripts/tps-plugins/ring/index.ts
// Assembles the four files into one CategoryPlugin per the tps-core contract.
import type { CategoryPlugin } from "../../tps-core/types";
import { detect } from "./detector";
import { normalize } from "./parser";
import { buildIdentityKey } from "./identity";
import { scoreConfidence } from "./validator";

export const ringPlugin: CategoryPlugin = {
  category: "ring",
  version: "1.0.0",
  detect,
  normalize,
  buildIdentityKey,
  scoreConfidence,
};

export { detect, normalize, buildIdentityKey, scoreConfidence };
