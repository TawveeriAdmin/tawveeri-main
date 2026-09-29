/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

for (const [source, destination] of [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
]) fs.cpSync(source, destination, { recursive: true });

const sourceFile = path.resolve('deployment-source.json');
const attestation = {
  builtAt: new Date().toISOString(),
  source: fs.existsSync(sourceFile) ? JSON.parse(fs.readFileSync(sourceFile, 'utf8')) : null,
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  next: require('next/package.json').version,
  react: require('react/package.json').version,
  sharp: require('sharp').versions,
  lockfileSha256: crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'),
  buildId: fs.readFileSync('.next/BUILD_ID', 'utf8').trim(),
};
fs.writeFileSync('.next/build-attestation.json', JSON.stringify(attestation, null, 2));
fs.copyFileSync('.next/build-attestation.json', '.next/standalone/build-attestation.json');
console.log('[build-attestation]', JSON.stringify(attestation));
