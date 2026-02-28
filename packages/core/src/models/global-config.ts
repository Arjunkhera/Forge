import { z } from 'zod';
import { RegistryConfigSchema } from './forge-config.js';

/**
 * Schema for the global Forge configuration (~/.forge/config.yaml).
 *
 * Global registries act as fallbacks — workspace-local registries
 * take priority, and global registries are appended as lower-priority
 * sources.
 *
 * @example
 * # ~/.forge/config.yaml
 * registries:
 *   - type: git
 *     name: team-registry
 *     url: https://github.com/myorg/forge-registry.git
 *     branch: main
 *     path: registry
 */
export const GlobalConfigSchema = z.object({
  registries: z.array(RegistryConfigSchema).default([]),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
