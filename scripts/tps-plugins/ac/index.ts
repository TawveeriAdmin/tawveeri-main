// scripts/tps-plugins/ac/index.ts
// يجمع الملفات الأربعة في CategoryPlugin واحد متوافق مع العقد في tps-core/types.ts

import type { CategoryPlugin } from "../../tps-core/types";
import { detect } from "./detector";
import { normalize } from "./parser";
import { buildIdentityKey } from "./identity";
import { scoreConfidence } from "./validator";

export const acPlugin: CategoryPlugin = {
  category: "ac",
  version: "1.0.0",
  detect,
  normalize,
  buildIdentityKey,
  scoreConfidence,
};