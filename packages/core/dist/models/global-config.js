"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalConfigSchema = void 0;
const zod_1 = require("zod");
const forge_config_js_1 = require("./forge-config.js");
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
exports.GlobalConfigSchema = zod_1.z.object({
    registries: zod_1.z.array(forge_config_js_1.RegistryConfigSchema).default([]),
});
//# sourceMappingURL=global-config.js.map