// scripts/tps-plugins/appliance/index.ts
// Materializes one CategoryPlugin bundle per appliance config. Import
// APPLIANCE_BUNDLES to register all appliance categories in the category-registry
// with a single loop (no per-category boilerplate).
import { makeAppliancePlugin, type AppliancePluginBundle } from "./factory";
import { APPLIANCE_CONFIGS } from "./configs";

export const APPLIANCE_BUNDLES: Record<string, AppliancePluginBundle> = Object.fromEntries(
  APPLIANCE_CONFIGS.map((cfg) => [cfg.category, makeAppliancePlugin(cfg)])
);

export const APPLIANCE_CATEGORIES = APPLIANCE_CONFIGS.map((c) => c.category);

export { makeAppliancePlugin, APPLIANCE_CONFIGS };
export type { AppliancePluginBundle };
