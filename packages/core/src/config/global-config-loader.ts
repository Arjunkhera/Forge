import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { GlobalConfigSchema, type GlobalConfig } from '../models/global-config.js';
import type { RegistryConfig } from '../models/forge-config.js';

/**
 * Default location for the global Forge configuration.
 */
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.forge');
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');

/**
 * Load the global Forge configuration from ~/.forge/config.yaml.
 * Returns an empty config (no registries) if the file doesn't exist.
 *
 * @param configPath - Override the default path (useful for testing).
 */
export async function loadGlobalConfig(
  configPath: string = GLOBAL_CONFIG_PATH,
): Promise<GlobalConfig> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = parseYaml(raw);
    return GlobalConfigSchema.parse(parsed);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      // No global config — return empty defaults
      return { registries: [] };
    }
    // File exists but is malformed — warn and return empty
    console.warn(
      `[Forge] Warning: Could not parse global config at ${configPath}: ${err.message}. Using defaults.`,
    );
    return { registries: [] };
  }
}

/**
 * Save a global config to ~/.forge/config.yaml.
 * Creates the ~/.forge directory if it doesn't exist.
 *
 * @param config - The global config to write.
 * @param configPath - Override the default path (useful for testing).
 */
export async function saveGlobalConfig(
  config: GlobalConfig,
  configPath: string = GLOBAL_CONFIG_PATH,
): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  const yaml = stringifyYaml(config);
  await fs.writeFile(configPath, yaml, 'utf-8');
}

/**
 * Add a registry to the global config. Deduplicates by name.
 *
 * @param registry - The registry config to add.
 * @param configPath - Override the default path (useful for testing).
 */
export async function addGlobalRegistry(
  registry: RegistryConfig,
  configPath: string = GLOBAL_CONFIG_PATH,
): Promise<GlobalConfig> {
  const config = await loadGlobalConfig(configPath);
  // Remove any existing registry with the same name
  config.registries = config.registries.filter(r => r.name !== registry.name);
  config.registries.push(registry);
  await saveGlobalConfig(config, configPath);
  return config;
}

/**
 * Remove a registry from the global config by name.
 *
 * @param registryName - The name of the registry to remove.
 * @param configPath - Override the default path (useful for testing).
 */
export async function removeGlobalRegistry(
  registryName: string,
  configPath: string = GLOBAL_CONFIG_PATH,
): Promise<GlobalConfig> {
  const config = await loadGlobalConfig(configPath);
  config.registries = config.registries.filter(r => r.name !== registryName);
  await saveGlobalConfig(config, configPath);
  return config;
}
