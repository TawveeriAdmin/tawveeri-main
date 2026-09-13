// tests/identity/tv-parser.test.ts
// Regression gate for two proven, live-catalog defects found during the Samsung
// KSA official-gateway audit (2026-09-13): a merchandising bundle/combo page must
// never mint a single-TV identity, and two structurally different panel
// technologies (Micro RGB vs QLED/OLED/Neo QLED family lines) must never share
// one identity merely because neither's panel type was extractable from a
// marketing title.
import { detect } from "../../scripts/tps-plugins/tv/detector";
import { normalize } from "../../scripts/tps-plugins/tv/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/tv/identity";

const build = (en: string, brand: string | null = "samsung") => {
  const n = normalize("", en, brand, {});
  return { ...buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
};

describe("detector — a bundle/combo page must not mint a single-TV identity", () => {
  it.each([
    ['85" The Frame LS03HE 4K (2026) + Frame Bezel Bundle F-FA01COMBO55', "the exact live-catalog false positive (mis-read a power-supply voltage spec as a model number)"],
    ["65\" The Frame QLED 27\" Odyssey G5 QHD Frame Bezel Bundle F-FA01COMBO48", "TV + gaming monitor bundle"],
    ["77\" OLED S95F TV Hard Bundle F-FA01COMBO27", "TV hard bundle, internal Samsung SKU prefix"],
    ["83\" OLED 65\" The Frame QLED Frame Bezel TV Bundle F-FA01COMBO47", "TV + accessory combo"],
    ["حزمة تلفزيون 75 بوصة", "Arabic 'bundle' (حزمة)"],
  ])("rejects bundle/combo page: %s (%s)", (title) => {
    expect(detect("", title)).toBe(false);
  });

  it("a manufacturer bundle's OWN real SKU/MPN never mints a TV identity either — the detect() gate blocks normalize()/buildIdentityKey() entirely, regardless of what a model-number field contains", () => {
    // Even though Samsung's bundle SKU (F-FA01COMBO33) is a real, stable code
    // Samsung itself assigns, a bundle is a multi-item listing, never a single
    // television — MANUFACTURER_BUNDLE / OUT_OF_CURRENT_SCOPE, not a TV.
    const title = "TV Hard Bundle 33 F-FA01COMBO33";
    expect(detect("", title)).toBe(false);
    // The real production sweep never calls normalize()/buildIdentityKey() when
    // detect() is false (progressive-engine.ts: `if (!detect(...)) continue;`),
    // so no identity — bundle-SKU-derived or otherwise — is ever computed here.
  });

  it("a standalone TV PDP for the same panel/size remains independently eligible", () => {
    // The real, standalone Q7F 65" QLED TV that the bundle in the first case
    // above previously collapsed onto — must still detect and identify on its
    // own, un-bundled listing.
    expect(detect("", "Q7F 65 inch QLED 4K Smart TV 60Hz")).toBe(true);
    const r = build("Q7F 65 inch QLED 4K Smart TV 60Hz");
    expect(r.key).not.toBeNull();
    expect(r.status).not.toBe("invalid");
  });
});

describe("panel technology — Micro RGB is a distinct, stable, generic panel value", () => {
  it("Micro RGB and The Frame's QLED panel never collapse into one identity", () => {
    // The proven collision: LS03FW (The Frame) vs R95H (Micro RGB), 85-inch,
    // both previously fell to NO_PANEL and shared one identity.
    const frame = build('The Frame LS03FW 85 inch QLED 4K Smart TV 60Hz');
    const microRgb = build('Micro RGB R95H 85 inch 4K Smart TV 60Hz');
    expect(frame.p.panel).toBe("qled");
    expect(microRgb.p.panel).toBe("micro_rgb");
    expect(frame.key).not.toBeNull();
    expect(microRgb.key).not.toBeNull();
    expect(frame.key).not.toBe(microRgb.key);
  });

  it("Micro RGB is recognized hyphen/space tolerant, and in Arabic", () => {
    expect(build("Micro-RGB 75 inch 4K TV 60Hz").p.panel).toBe("micro_rgb");
    expect(build("MicroRGB 75 inch 4K TV 60Hz").p.panel).toBe("micro_rgb");
    expect(build("", "").p.panel).toBeFalsy();
    expect(build("تلفزيون مايكرو ار جي بي 75 بوصة 4K 60 هرتز").p.panel).toBe("micro_rgb");
  });
});
