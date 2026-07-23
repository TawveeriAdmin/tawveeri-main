// scripts/tps-plugins/mobile/text.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mobile-specific text helpers. The generic Arabic normalization (ADR-061) was
// promoted to tps-core/text.ts (ADR-072) once the laptop plugin became a second
// consumer; it is re-exported here so existing mobile imports are unchanged.
// The tier sets below stay local — they encode what real PHONES ship with.
// ─────────────────────────────────────────────────────────────────────────────
export { normalizeArabic, LB, RB, bounded } from "../../tps-core/text";

/**
 * Storage tiers that real phones ship with. Anything else is not storage —
 * this is what stops "8 جيجابايت رام" (8GB RAM) becoming a storage identity.
 * Measured harm: `samsung|Galaxy A|A07|Standard|4` used 4GB of RAM as storage.
 */
export const STORAGE_TIERS = new Set([16, 32, 64, 128, 256, 512, 1024, 2048]);

/** RAM sizes real phones ship with — used to positively exclude RAM figures. */
export const RAM_TIERS = new Set([2, 3, 4, 6, 8, 12, 16, 24]);
