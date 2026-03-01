import { z } from 'zod';
import { RegistryConfigSchema } from './forge-config.js';

/**
 * Workspace settings section.
 */
export const WorkspaceSettingsSchema = z.object({
  mount_path: z.string().default('~/forge-workspaces'),
  default_config: z.string().default('sdlc-default'),
  retention_days: z.number().default(30),
});

export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

/**
 * MCP endpoint entry.
 */
export const McpEndpointSchema = z.object({
  url: z.string().url(),
  transport: z.enum(['http', 'stdio']).default('http'),
});

export type McpEndpoint = z.infer<typeof McpEndpointSchema>;

/**
 * MCP endpoints section (maps endpoint names to their configurations).
 */
export const McpEndpointsSchema = z.object({
  anvil: McpEndpointSchema.optional(),
  vault: McpEndpointSchema.optional(),
});

export type McpEndpoints = z.infer<typeof McpEndpointsSchema>;

/**
 * Repository configuration section.
 */
export const ReposConfigSchema = z.object({
  scan_paths: z.array(z.string()).default([]),
  index_path: z.string().default('~/.forge/repos.json'),
});

export type ReposConfig = z.infer<typeof ReposConfigSchema>;

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
 *
 * workspace:
 *   mount_path: ~/workspaces
 *   default_config: sdlc-default
 *   retention_days: 30
 *
 * mcp_endpoints:
 *   anvil:
 *     url: http://localhost:3002
 *     transport: http
 *   vault:
 *     url: http://localhost:8000
 *     transport: http
 *
 * repos:
 *   scan_paths:
 *     - ~/Repositories
 *     - ~/Projects
 *   index_path: ~/.forge/repos.json
 */
export const GlobalConfigSchema = z.object({
  registries: z.array(RegistryConfigSchema).default([]),
  workspace: WorkspaceSettingsSchema.default({}),
  mcp_endpoints: McpEndpointsSchema.default({}),
  repos: ReposConfigSchema.default({}),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
