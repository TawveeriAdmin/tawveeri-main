/**
 * Audio TPS Plugin — identity-contract invariants (Audio Identity Contract v1).
 * Pure-logic unit tests: detection vs accessory/charger rejection, and the
 * audit-proven precision guards — generation never merges (FreeBuds SE 2 ≠ 3,
 * AirPods Pro 2 ≠ 3, JBL Flip 6 ≠ 7) and AirPods 4 base ≠ ANC.
 */
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { audioPlugin, normalize } from '../../scripts/tps-plugins/audio';

const idOf = (en: string, brand: string | null) => {
  const n = normalize('', en, brand, {});
  return audioPlugin.buildIdentityKey(brand, n.payload, {});
};

describe('Audio detection (accessory/charger hard-reject)', () => {
  it('detects real audio products', () => {
    expect(audioPlugin.detect('', 'Apple AirPods Pro 3 Earbuds, ANC')).toBe(true);
    expect(audioPlugin.detect('', 'JBL Flip 7 Portable Speaker Bluetooth')).toBe(true);
    expect(audioPlugin.detect('سماعة سوني WH-1000XM5', '')).toBe(true);
  });
  it('rejects audio accessories (charger/case/tips/cable)', () => {
    expect(audioPlugin.detect('', 'Promate Wireless Charger Station MagSafe for AirPods')).toBe(false);
    expect(audioPlugin.detect('', 'Silicone Case Cover for AirPods Pro')).toBe(false);
    expect(audioPlugin.detect('', 'Replacement Ear Tips for Sony WF-1000XM5')).toBe(false);
    expect(audioPlugin.detect('', 'Charging Cable for JBL Speaker')).toBe(false);
  });
});

describe('Audio brand canonicalization', () => {
  it('maps AR/EN audio brands', () => {
    expect(canonicalizeBrand('جي بي إل')).toBe('jbl');
    expect(canonicalizeBrand('بوز')).toBe('bose');
    expect(canonicalizeBrand('soundcore')).toBe('anker');
    expect(idOf('AirPods Pro 3', null).key).toBe('apple|airpods pro 3'); // airpods ⇒ apple
  });
});

describe('Audio identity (generation precision guards)', () => {
  it('FreeBuds SE 2 ≠ SE 3 ≠ SE 4', () => {
    const s2 = idOf('Huawei FreeBuds SE 2 Earbuds', 'Huawei').key;
    const s3 = idOf('Huawei FreeBuds SE 3 Earbuds', 'Huawei').key;
    const s4 = idOf('Huawei FreeBuds SE 4 ANC Earbuds', 'Huawei').key;
    expect(new Set([s2, s3, s4]).size).toBe(3);
  });
  it('AirPods Pro 2 ≠ Pro 3; AirPods 3 ≠ 4', () => {
    const p2 = idOf('Apple AirPods Pro 2', 'Apple').key;
    const p3 = idOf('Apple AirPods Pro 3', 'Apple').key;
    const a3 = idOf('Apple AirPods 3', 'Apple').key;
    const a4 = idOf('Apple AirPods 4', 'Apple').key;
    expect(new Set([p2, p3, a3, a4]).size).toBe(4);
  });
  it('AirPods 4 base ≠ AirPods 4 ANC', () => {
    const base = idOf('Apple AirPods 4 Earbuds, Bluetooth, USB-C', 'Apple').key;
    const anc = idOf('Apple AirPods 4 Earbuds, Active Noise Cancelling', 'Apple').key;
    expect(base).not.toBe(anc);
    expect(anc).toContain('anc');
  });
  it('JBL Flip 6 ≠ Flip 7; Sony WH-1000XM4 ≠ XM5', () => {
    expect(idOf('JBL Flip 6 Speaker', 'JBL').key).not.toBe(idOf('JBL Flip 7 Speaker', 'JBL').key);
    expect(idOf('Sony WH-1000XM4 Headphones', 'Sony').key).not.toBe(idOf('Sony WH-1000XM5 Headphones', 'Sony').key);
  });
  it('bare brand without a model is invalid (not an identity)', () => {
    expect(idOf('Sony Wireless Headphones', 'Sony').status).toBe('invalid');
    expect(idOf('JBL Speaker Bluetooth', 'JBL').status).toBe('invalid');
  });
});

describe('Audio category isolation', () => {
  it('plugin declares the audio category and a version', () => {
    expect(audioPlugin.category).toBe('audio');
    expect(audioPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
