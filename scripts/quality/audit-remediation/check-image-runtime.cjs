/* eslint-disable @typescript-eslint/no-require-imports */
// Bounded in-memory images only: no external requests or exploit payloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sharp = require('sharp');
const { imageOptimizer } = require('next/dist/server/image-optimizer');
const results = [];
const config = { images: { dangerouslyAllowSVG: false, minimumCacheTTL: 60 }, experimental: { imgOptConcurrency: 1, imgOptMaxInputPixels: 4096, imgOptTimeoutInSeconds: 5 } };
const optimize = buffer => imageOptimizer({ buffer, contentType: null, cacheControl: null, etag: 'isolated-fixture' }, { href: '/fixture', width: 16, quality: 75, mimeType: 'image/webp' }, config, { silent: true });
(async () => {
  for (const format of ['png', 'jpeg', 'webp', 'avif']) {
    const buffer = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#123456' } }).toFormat(format).toBuffer();
    const output = await optimize(buffer);
    assert.equal(output.error, undefined);
    const metadata = await sharp(output.buffer).metadata();
    assert.equal(metadata.width, 16);
    results.push({ format, passed: true, output: metadata.format, width: metadata.width });
  }
  for (const [name, buffer] of [
    ['invalid bytes', Buffer.from('not an image')],
    ['disallowed SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')],
  ]) {
    await assert.rejects(() => optimize(buffer), error => error.statusCode === 400);
    results.push({ name, rejected: true, status: 400 });
  }
  const evidence = { at: new Date().toISOString(), next: require('next/package.json').version, node: process.version, platform: process.platform, sharp: sharp.versions, results };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
})().catch(error => { console.error(error); process.exitCode = 1; });
