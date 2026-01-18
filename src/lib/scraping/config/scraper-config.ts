import type { ScraperConfig } from '../base/types';
import jarirConfig from './store-configs/jarir.json';
import extraConfig from './store-configs/extra.json';
import noonConfig from './store-configs/noon.json';
import amazonConfig from './store-configs/amazon.json';
import almaneaConfig from './store-configs/almanea.json';

/**
 * Load store configuration by slug
 */
export function loadStoreConfig(storeSlug: string): ScraperConfig {
  const configs: Record<string, unknown> = {
    jarir: jarirConfig,
    extra: extraConfig,
    noon: noonConfig,
    amazon: amazonConfig,
    almanea: almaneaConfig,
  };

  const config = configs[storeSlug];
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

  // Required fields
  if (!cfg.store_slug || typeof cfg.store_slug !== 'string') {
    throw new Error('Configuration must have store_slug (string)');
  }

  if (!cfg.base_url || typeof cfg.base_url !== 'string') {
    throw new Error('Configuration must have base_url (string)');
  }

  // Return as ScraperConfig (type assertion after validation)
  return config as ScraperConfig;
}

/**
 * Get all store configurations
 */
export function getAllStoreConfigs(): ScraperConfig[] {
  const slugs = ['jarir', 'extra', 'noon', 'amazon', 'almanea'];
  const configs: ScraperConfig[] = [];

  for (const slug of slugs) {
    try {
      const config = loadStoreConfig(slug);
      configs.push(config);
    } catch (error) {
      console.error(`Failed to load config for ${slug}:`, error);
    }
  }

  return configs;
}

