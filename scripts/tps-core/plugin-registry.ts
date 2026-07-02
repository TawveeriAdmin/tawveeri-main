// scripts/tps-core/plugin-registry.ts
// السجل المركزي لكل Category Plugins في TPS
// الـ Core يعرف هذه القائمة فقط — لا يعرف تفاصيل أي فئة بعينها
// إضافة فئة جديدة لاحقاً = استيراد الـ plugin + سطر واحد هنا

import type { CategoryPlugin } from "./types";
import { acPlugin } from "../tps-plugins/ac";
import { mobilePlugin } from "../tps-plugins/mobile";

export const plugins: CategoryPlugin[] = [
  acPlugin,
  mobilePlugin,
  // tvPlugin,            ← يُضاف لاحقاً
  // refrigeratorPlugin,  ← يُضاف لاحقاً
];

/**
 * يكتشف أي Plugin يطابق النص، بترتيب القائمة أعلاه.
 * يرجع null إذا لم يطابق أي Plugin (= "unknown").
 */
export function detectPlugin(nameAr: string, nameEn: string): CategoryPlugin | null {
  for (const plugin of plugins) {
    if (plugin.detect(nameAr, nameEn)) return plugin;
  }
  return null;
}

export function getPluginByCategory(category: string): CategoryPlugin | null {
  return plugins.find(p => p.category === category) ?? null;
}