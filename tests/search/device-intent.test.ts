import { deviceIntentOf, isDeviceItself, DEVICE_INTENTS } from '@/lib/search/device-intent';

describe('device intent (2026-10-06): «ps5» asks for the device, not for what is sold for it', () => {
  it('recognises the device a query names, in both scripts, and nothing else', () => {
    expect(deviceIntentOf('ps5')?.id).toBe('ps5');
    expect(deviceIntentOf('PlayStation 5')?.id).toBe('ps5');
    expect(deviceIntentOf('بلايستيشن 5')?.id).toBe('ps5');
    expect(deviceIntentOf('Nintendo Switch')?.id).toBe('switch');
    expect(deviceIntentOf('xbox series x')?.id).toBe('xbox');
    expect(deviceIntentOf('iphone 15')).toBeNull();
    expect(deviceIntentOf('ps5 headset')?.id).toBe('ps5');              // the caller decides accessory-shaped queries separately
    expect(deviceIntentOf('ps5 xbox')).toBeNull();                       // two devices → ambiguous
    expect(deviceIntentOf('ps50 tv')).toBeNull();                        // whole words only
  });

  it('accepts a title that IS the device and rejects accessories/software of it', () => {
    const ps5 = DEVICE_INTENTS.find((d) => d.id === 'ps5')!;
    const sw = DEVICE_INTENTS.find((d) => d.id === 'switch')!;
    expect(isDeviceItself('Sony PlayStation 5 Console Slim Digital Edition', ps5)).toBe(true);
    expect(isDeviceItself('بلايستيشن 5 سوني نسخة ديجيتال', ps5)).toBe(true);
    expect(isDeviceItself('ASA A20 Pro Wired Gaming Headset with Noise-Isolating Microphone for PS5, PS4, Xbox', ps5)).toBe(false);
    expect(isDeviceItself('Sony PS5 DualSense Wireless Controller', ps5)).toBe(false);
    expect(isDeviceItself('Razer Kaira X PlayStation Licensed Wired Gaming Headset', ps5)).toBe(false);
    expect(isDeviceItself('Nintendo Switch OLED Model Console White', sw)).toBe(true);
    expect(isDeviceItself('Mario Kart 8 Deluxe - Nintendo Switch', sw)).toBe(false);
    expect(isDeviceItself('Logitech G321 LIGHTSPEED Wireless Bluetooth Headset for Nintendo Switch', sw)).toBe(false);
  });
});

import fs from 'fs';
import path from 'path';
describe('device queries put the device first (wired in the route)', () => {
  const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'api', 'search', 'route.ts'), 'utf8');
  it('partitions device items ahead of accessories and picks the decision among devices only', () => {
    expect(routeSrc).toMatch(/const deviceItems = deviceIntent \? products\.filter\(\(p\) => isDeviceItself\(/);
    expect(routeSrc).toMatch(/products = \[\.\.\.deviceItems, \.\.\.products\.filter\(\(p\) => !isDev\.has\(p\)\)\]/);
    expect(routeSrc).toMatch(/buildDecisionLayer\(deviceItems\.length \? deviceItems : products,/);
    expect(routeSrc).toMatch(/const deviceNotFound = deviceIntent && deviceItems\.length === 0/);
  });
});
