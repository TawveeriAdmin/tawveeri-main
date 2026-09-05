// tests/campaigns/product-type-guard.test.ts — Amazon × Noon internal commerce, systemic
// product-type/category sanity (2026-09-05, §4/§16).
import { looksLikeCategoryMismatch } from '@/lib/campaigns/product-type-guard';

describe('looksLikeCategoryMismatch', () => {
  it('is false for a missing title — no evidence, no guess', () => {
    expect(looksLikeCategoryMismatch(null, 'tv')).toBe(false);
  });

  it('is true for the exact TV/speaker case this mission found and fixed as data remediation', () => {
    expect(looksLikeCategoryMismatch(
      'Ciglow Full Range Smart TV Speaker 2Pcs 8 Ohm 10W Television LCD TV 200HZ-20KH Full Range Speaker(134 x 35 x 25 mm)',
      'tv',
    )).toBe(true);
  });

  it('is false for a real TV listing that happens to mention a built-in speaker, since it also carries a size/spec marker', () => {
    expect(looksLikeCategoryMismatch('Samsung 65" QLED 4K Smart TV with Built-in Speaker System', 'tv')).toBe(false);
  });

  it('does not flag "speaker" outside the tv category — a real speaker product in audio is not an accessory', () => {
    expect(looksLikeCategoryMismatch('JBL Flip 6 Bluetooth Speaker', 'audio')).toBe(false);
  });

  it('reuses the existing general accessory vocabulary for laptop/tablet/phone/AC cases', () => {
    expect(looksLikeCategoryMismatch('Laptop Sleeve Case 14 inch', 'laptop')).toBe(true);
    expect(looksLikeCategoryMismatch('Tablet Screen Protector Tempered Glass', 'tablet')).toBe(true);
    expect(looksLikeCategoryMismatch('Phone Charger Cable USB-C', 'mobile')).toBe(true);
    expect(looksLikeCategoryMismatch('AC Remote Control Replacement Holder', 'air_conditioner')).toBe(true);
  });

  it('is false for genuine main products in each category', () => {
    expect(looksLikeCategoryMismatch('Lenovo Legion Ultra7 32GB 1TB 15.1" RTX5050', 'laptop')).toBe(false);
    expect(looksLikeCategoryMismatch('Apple Ipad Air M3 128GB Cellular', 'tablet')).toBe(false);
    expect(looksLikeCategoryMismatch('Samsung Galaxy S24 Ultra 256GB', 'mobile')).toBe(false);
  });
});
