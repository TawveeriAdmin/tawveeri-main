import type { ScraperConfig } from '../base/types';
import jarirConfig from './store-configs/jarir.json';
import extraConfig from './store-configs/extra.json';
import noonConfig from './store-configs/noon.json';
import amazonConfig from './store-configs/amazon.json';
import almaneaConfig from './store-configs/almanea.json';
import samsungKsaConfig from './store-configs/samsung_ksa.json';
import shakerConfig from './store-configs/shaker.json';
import swsgConfig from './store-configs/swsg.json';
import luluConfig from './store-configs/lulu.json';

/**
 * Active store scrapers (8 stores prioritized for MVP).
 * Add a new store by adding its JSON config + TS scraper + entry here.
 */
const STORE_CONFIGS: Record<string, unknown> = {
  jarir: jarirConfig,
  extra: extraConfig,
  noon: noonConfig,
  amazon: amazonConfig,
  almanea: almaneaConfig,
  samsung_ksa: samsungKsaConfig,
  shaker: shakerConfig,
  swsg: swsgConfig,
  lulu: luluConfig,
};

export const ACTIVE_STORE_SLUGS = Object.keys(STORE_CONFIGS);

/**
 * Load store configuration by slug
 */
export function loadStoreConfig(storeSlug: string): ScraperConfig {
  const config = STORE_CONFIGS[storeSlug];
  if (!config) {
    throw new Error(`No configuration found for store: ${storeSlug}`);
  }
  return validateConfig(config);
}

/**
 * Validate configuration structure
 */
export function validateConfig(config: unknown): ScraperConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.store_slug || typeof cfg.store_slug !== 'string') {
    throw new Error('Configuration must have store_slug (string)');
  }

  if (!cfg.base_url || typeof cfg.base_url !== 'string') {
    throw new Error('Configuration must have base_url (string)');
  }

  return config as ScraperConfig;
}

/**
 * Get all active store configurations
 */
export function getAllStoreConfigs(): ScraperConfig[] {
  const configs: ScraperConfig[] = [];
  for (const slug of ACTIVE_STORE_SLUGS) {
    try {
      configs.push(loadStoreConfig(slug));
    } catch (error) {
      console.error(`Failed to load config for ${slug}:`, error);
    }
  }
  return configs;
}
