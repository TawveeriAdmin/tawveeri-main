// tests/catalog/mobile-display-name.test.ts
// ADR-084 regression: the ADR-081 NO_STORAGE sentinel is INTERNAL and must never
// reach the customer as "NO_STORAGEGB" in a display name, nor as NaN in attrs.
import { CATEGORY_DEFS } from "../../scripts/tps-core/category-registry";

const mobile = (CATEGORY_DEFS as unknown as Record<string, {
  names: (k: string) => { nameAr: string; nameEn: string };
  attrs: (k: string) => Record<string, unknown>;
}>).mobile;

describe("mobile display name — NO_STORAGE sentinel never leaks", () => {
  it("omits the storage segment for a NO_STORAGE canonical (no 'NO_STORAGEGB')", () => {
    const n = mobile.names("samsung|Galaxy S|S25|Ultra|NO_STORAGE");
    expect(n.nameAr).not.toMatch(/NO_STORAGE/);
    expect(n.nameEn).not.toMatch(/NO_STORAGE/);
    expect(n.nameAr).toBe("samsung Galaxy S S25 Ultra");
    expect(n.nameEn).toBe("Samsung Galaxy S S25 Ultra");
  });

  it("still renders storage for a specified canonical", () => {
    expect(mobile.names("apple|iPhone|17|Pro Max|256").nameEn).toBe("Apple iPhone 17 Pro Max 256GB");
  });

  it("attrs returns storage_gb = null (never NaN) for NO_STORAGE", () => {
    expect(mobile.attrs("samsung|Galaxy S|S25|Ultra|NO_STORAGE").storage_gb).toBeNull();
    expect(mobile.attrs("apple|iPhone|17|Pro Max|256").storage_gb).toBe(256);
  });
});
