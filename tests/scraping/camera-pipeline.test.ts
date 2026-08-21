/**
 * Camera TPS Plugin — identity-contract invariants (Camera Identity Contract v1).
 * Detection vs accessory rejection; precision guards: EOS R50 ≠ R50 V (variant),
 * body ≠ kit ≠ different kit (config), model separation.
 */
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { cameraPlugin, normalize } from '../../scripts/tps-plugins/camera';

const idOf = (en: string, brand: string | null) => {
  const n = normalize('', en, brand, {});
  return cameraPlugin.buildIdentityKey(brand, n.payload, {});
};

describe('Camera detection (accessory hard-reject)', () => {
  it('detects real cameras (incl. lens kits)', () => {
    expect(cameraPlugin.detect('', 'Canon EOS R100 Mirrorless Camera with RF-S 18-45mm')).toBe(true);
    expect(cameraPlugin.detect('كاميرا كانون EOS 2000D', '')).toBe(true);
  });
  it('rejects camera accessories and non-cameras', () => {
    expect(cameraPlugin.detect('', 'Camera Bag for DSLR')).toBe(false);
    expect(cameraPlugin.detect('', 'Canon Battery LP-E17 for EOS')).toBe(false);
    expect(cameraPlugin.detect('', 'Tripod Stand for Camera')).toBe(false);
    expect(cameraPlugin.detect('', 'Security Camera IP Wi-Fi')).toBe(false);
  });
  // MEASURED DEFECT (2026-08-22): a production canonical_products row in category
  // 'camera' was a third-party clip-on attachment lens, live-reachable via
  // decide()/Waffar/search under the exact model name of the camera it fits.
  it('rejects a standalone attachment lens (2026-08-22 audit) while keeping bundled kit lenses real', () => {
    expect(cameraPlugin.detect('', 'Altura Photo 49MM 0.43x Professional HD Wide Angle Lens (w/Macro Portion) for Canon EOS M50 M M2 M3 M5 M6 Mark II M10 M100 M200 R50 R100 Mirrorless Cameras')).toBe(false);
    // no regression: a genuine camera bundled with its own kit lens is still a camera
    expect(cameraPlugin.detect('', 'Canon EOS R100 Mirrorless Camera with RF-S 18-45mm')).toBe(true);
  });
});

describe('Camera identity (precision guards)', () => {
  it('maps brands; EOS ⇒ Canon', () => {
    expect(canonicalizeBrand('كانون')).toBe('canon');
    expect(idOf('EOS R100 with RF-S 18-45mm', null).key?.startsWith('canon|')).toBe(true);
  });
  it('EOS R50 ≠ R50 V (variant must not merge)', () => {
    const r50 = idOf('Canon EOS R50 RF-S 18-45mm', 'Canon').key;
    const r50v = idOf('Canon EOS R50 V RF-S 14-30mm', 'Canon').key;
    expect(r50).not.toBe(r50v);
    expect(r50v).toContain('r50 v');
  });
  it('body ≠ kit ≠ different kit (config)', () => {
    const body = idOf('Canon EOS R8 Mirrorless Camera Body Only', 'Canon').key;
    const kit1 = idOf('Canon EOS R8 with 24-105mm', 'Canon').key;
    const kit2 = idOf('Canon EOS R8 with 18-45mm', 'Canon').key;
    expect(new Set([body, kit1, kit2]).size).toBe(3);
  });
  it('different models never merge; bare brand invalid', () => {
    expect(idOf('Canon EOS R100 18-45mm', 'Canon').key).not.toBe(idOf('Canon EOS R50 18-45mm', 'Canon').key);
    expect(idOf('Canon DSLR Camera', 'Canon').status).toBe('invalid');
  });
});

describe('Camera category isolation', () => {
  it('plugin declares the camera category and a version', () => {
    expect(cameraPlugin.category).toBe('camera');
    expect(cameraPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
