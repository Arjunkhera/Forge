"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalConfigSchema = exports.ReposConfigSchema = exports.McpEndpointsSchema = exports.McpEndpointSchema = exports.WorkspaceSettingsSchema = void 0;
const zod_1 = require("zod");
const forge_config_js_1 = require("./forge-config.js");
/**
 * Workspace settings section.
 */
exports.WorkspaceSettingsSchema = zod_1.z.object({
    mount_path: zod_1.z.string().default('~/forge-workspaces'),
    default_config: zod_1.z.string().default('sdlc-default'),
    retention_days: zod_1.z.number().default(30),
});
/**
 * MCP endpoint entry.
 */
exports.McpEndpointSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    transport: zod_1.z.enum(['http', 'stdio']).default('http'),
});
/**
 * MCP endpoints section (maps endpoint names to their configurations).
 */
exports.McpEndpointsSchema = zod_1.z.object({
    anvil: exports.McpEndpointSchema.optional(),
    vault: exports.McpEndpointSchema.optional(),
});
/**
 * Repository configuration section.
 */
exports.ReposConfigSchema = zod_1.z.object({
    scan_paths: zod_1.z.array(zod_1.z.string()).default([]),
    index_path: zod_1.z.string().default('~/.forge/repos.json'),
});
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
exports.GlobalConfigSchema = zod_1.z.object({
    registries: zod_1.z.array(forge_config_js_1.RegistryConfigSchema).default([]),
    workspace: exports.WorkspaceSettingsSchema.default({}),
    mcp_endpoints: exports.McpEndpointsSchema.default({}),
    repos: exports.ReposConfigSchema.default({}),
});
//# sourceMappingURL=global-config.js.map