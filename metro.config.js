const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('ufw')) {
  config.resolver.assetExts.push('ufw');
}

module.exports = config;
