const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files from the parent monorepo root
// This is needed to import shared translation files from messages/
const monorepoRoot = path.resolve(__dirname, '..');
config.watchFolders = [monorepoRoot];

// Ensure node_modules resolution still prefers mobile's own modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
