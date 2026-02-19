const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch only the shared messages/ directory from the parent (for translations)
const monorepoRoot = path.resolve(__dirname, '..');
config.watchFolders = [
  path.resolve(monorepoRoot, 'messages'),
];

// Resolve node_modules ONLY from mobile's own directory
// This prevents Metro from picking up the parent's react/react-native/etc.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
