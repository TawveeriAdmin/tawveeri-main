// Assembles the smartwatch plugin per the tps-core CategoryPlugin contract.
import type { CategoryPlugin } from "../../tps-core/types";
import { detect } from "./detector";
import { normalize } from "./parser";
import { buildIdentityKey } from "./identity";
import { scoreConfidence } from "./validator";

export const smartwatchPlugin: CategoryPlugin = {
  category: "smartwatch",
  version: "1.0.0",
  detect,
  normalize,
  buildIdentityKey,
  scoreConfidence,
};

export { detect, normalize, buildIdentityKey, scoreConfidence };
