"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registry = exports.ForgeCore = void 0;
const path_1 = __importDefault(require("path"));
const workspace_manager_js_1 = require("./workspace/workspace-manager.js");
const registry_js_1 = require("./registry/registry.js");
const resolver_js_1 = require("./resolver/resolver.js");
const compiler_js_1 = require("./compiler/compiler.js");
const claude_code_strategy_js_1 = require("./compiler/claude-code-strategy.js");
const filesystem_adapter_js_1 = require("./adapters/filesystem-adapter.js");
const errors_js_1 = require("./adapters/errors.js");
/**
 * Main orchestration class for Forge. Wires together Registry, Resolver,
 * Compiler, and WorkspaceManager. Both the CLI and MCP server call this.
 *
 * @example
 * const forge = new ForgeCore('./my-workspace');
 * await forge.init('my-workspace');
 * await forge.add('skill:developer@1.0.0');
 * const report = await forge.install();
 */
class ForgeCore {
    workspaceRoot;
    workspaceManager;
    compiler;
    constructor(workspaceRoot = process.cwd()) {
        this.workspaceRoot = workspaceRoot;
        this.workspaceManager = new workspace_manager_js_1.WorkspaceManager(workspaceRoot);
        this.compiler = new compiler_js_1.Compiler();
        this.compiler.register(new claude_code_strategy_js_1.ClaudeCodeStrategy());
    }
    /**
     * Initialize a new Forge workspace.
     * Creates forge.yaml and forge.lock.
     */
    async init(name) {
        await this.workspaceManager.scaffoldWorkspace(name);
    }
    /**
     * Search the registry for artifacts matching a query.
     */
    async search(query, type) {
        const registry = await this.buildRegistry();
        return registry.search(query, type);
    }
    /**
     * Add artifact ref(s) to forge.yaml.
     * Validates the artifact exists in the registry before adding.
     */
    async add(refStrings) {
        const refs = Array.isArray(refStrings) ? refStrings : [refStrings];
        const config = await this.workspaceManager.readConfig();
        const registry = await this.buildRegistry();
        for (const refStr of refs) {
            const ref = this.parseRef(refStr);
            // Validate artifact exists
            const exists = await new filesystem_adapter_js_1.FilesystemAdapter(this.resolveRegistryPath(config.registries[0])).exists(ref.type, ref.id);
            // Even if not found locally, add to config (might be installed via HTTP later)
            // But if we have a registry, do a best-effort check
            if (config.registries.length > 0) {
                try {
                    await registry.get(ref);
                }
                catch {
                    console.warn(`[ForgeCore] Warning: '${refStr}' not found in any registry. Adding anyway.`);
                }
            }
            // Add to config
            if (ref.type === 'skill') {
                config.artifacts.skills[ref.id] = ref.version;
            }
            else if (ref.type === 'agent') {
                config.artifacts.agents[ref.id] = ref.version;
            }
            else if (ref.type === 'plugin') {
                config.artifacts.plugins[ref.id] = ref.version;
            }
        }
        await this.workspaceManager.writeConfig(config);
        return config;
    }
    /**
     * Run the full install pipeline:
     * readConfig → resolveAll → emitAll → mergeFiles → writeLock
     */
    async install(options = {}) {
        const startTime = Date.now();
        const config = await this.workspaceManager.readConfig();
        const lock = await this.workspaceManager.readLock();
        const registry = await this.buildRegistry();
        const resolver = new resolver_js_1.Resolver(registry);
        // Build ref list from config artifacts
        const refs = [
            ...Object.entries(config.artifacts.skills).map(([id, version]) => ({
                type: 'skill', id, version,
            })),
            ...Object.entries(config.artifacts.agents).map(([id, version]) => ({
                type: 'agent', id, version,
            })),
            ...Object.entries(config.artifacts.plugins).map(([id, version]) => ({
                type: 'plugin', id, version,
            })),
        ];
        // Resolve all artifacts
        resolver.reset();
        const resolved = await resolver.resolveAll(refs);
        // Compile to file operations
        const target = options.target ?? config.target;
        const fileOps = this.compiler.emitAll(resolved, target);
        const report = {
            installed: resolved.map(r => r.ref),
            filesWritten: [],
            conflicts: [],
            duration: 0,
        };
        if (!options.dryRun) {
            // Merge files into workspace
            const mergeReport = await this.workspaceManager.mergeFiles(fileOps, lock, options.conflictStrategy ?? 'backup');
            report.filesWritten = mergeReport.written;
            report.conflicts = mergeReport.conflicts;
            // Update lockfile
            const newLock = {
                version: '1',
                lockedAt: new Date().toISOString(),
                artifacts: {},
            };
            for (const artifact of resolved) {
                const files = fileOps
                    .filter(op => op.sourceRef.id === artifact.ref.id && op.sourceRef.type === artifact.ref.type)
                    .map(op => op.path);
                const sha = this.workspaceManager.computeSha256(artifact.bundle.content);
                const lockKey = `${artifact.ref.type}:${artifact.ref.id}`;
                newLock.artifacts[lockKey] = {
                    id: artifact.ref.id,
                    type: artifact.ref.type,
                    version: artifact.bundle.meta.version,
                    registry: 'local',
                    sha256: sha,
                    files,
                    resolvedAt: new Date().toISOString(),
                };
            }
            await this.workspaceManager.writeLock(newLock);
        }
        else {
            report.filesWritten = fileOps.map(op => op.path);
        }
        report.duration = Date.now() - startTime;
        return report;
    }
    /**
     * Remove artifacts from forge.yaml and clean lockfile-tracked files.
     */
    async remove(refStrings) {
        const refs = Array.isArray(refStrings) ? refStrings : [refStrings];
        const config = await this.workspaceManager.readConfig();
        for (const refStr of refs) {
            const ref = this.parseRef(refStr);
            if (ref.type === 'skill')
                delete config.artifacts.skills[ref.id];
            else if (ref.type === 'agent')
                delete config.artifacts.agents[ref.id];
            else if (ref.type === 'plugin')
                delete config.artifacts.plugins[ref.id];
        }
        await this.workspaceManager.writeConfig(config);
    }
    /**
     * Resolve a single artifact ref (for forge_resolve MCP tool).
     */
    async resolve(refString) {
        const ref = this.parseRef(refString);
        const registry = await this.buildRegistry();
        const resolver = new resolver_js_1.Resolver(registry);
        resolver.reset();
        return resolver.resolve(ref);
    }
    /**
     * List installed (from lock) or available (from registry) artifacts.
     */
    async list(scope = 'available') {
        if (scope === 'installed') {
            const lock = await this.workspaceManager.readLock();
            return Object.values(lock.artifacts).map(a => ({
                ref: { type: a.type, id: a.id, version: a.version },
                name: a.id,
                description: '',
                tags: [],
            }));
        }
        const registry = await this.buildRegistry();
        return registry.list();
    }
    /**
     * Read the current forge.yaml config.
     */
    async getConfig() {
        return this.workspaceManager.readConfig();
    }
    // Internal helpers
    async buildRegistry() {
        let config;
        try {
            config = await this.workspaceManager.readConfig();
        }
        catch {
            // No config — return empty registry backed by empty adapter
            return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(path_1.default.join(this.workspaceRoot, 'registry')));
        }
        if (config.registries.length === 0) {
            return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(path_1.default.join(this.workspaceRoot, 'registry')));
        }
        // Use the first filesystem registry for now (CompositeAdapter in S010)
        const fsRegistry = config.registries.find(r => r.type === 'filesystem');
        const registryPath = fsRegistry
            ? this.resolveRegistryPath(fsRegistry)
            : path_1.default.join(this.workspaceRoot, 'registry');
        return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(registryPath));
    }
    resolveRegistryPath(registryConfig) {
        if (!registryConfig || registryConfig.type !== 'filesystem') {
            return path_1.default.join(this.workspaceRoot, 'registry');
        }
        return path_1.default.isAbsolute(registryConfig.path)
            ? registryConfig.path
            : path_1.default.join(this.workspaceRoot, registryConfig.path);
    }
    parseRef(refStr) {
        // Format: "type:id@version" or "type:id" or "id@version" or "id"
        let type = 'skill';
        let id;
        let version = '*';
        let remaining = refStr;
        // Extract type prefix
        if (remaining.startsWith('skill:')) {
            type = 'skill';
            remaining = remaining.slice(6);
        }
        else if (remaining.startsWith('agent:')) {
            type = 'agent';
            remaining = remaining.slice(6);
        }
        else if (remaining.startsWith('plugin:')) {
            type = 'plugin';
            remaining = remaining.slice(7);
        }
        // Extract version suffix
        const atIdx = remaining.indexOf('@');
        if (atIdx !== -1) {
            id = remaining.slice(0, atIdx);
            version = remaining.slice(atIdx + 1);
        }
        else {
            id = remaining;
        }
        if (!id) {
            throw new errors_js_1.ForgeError('INVALID_REF', `Invalid artifact ref: '${refStr}'`, `Use format: skill:my-skill@1.0.0`);
        }
        return { type, id, version };
    }
}
exports.ForgeCore = ForgeCore;
// Re-export Registry for convenience
var registry_js_2 = require("./registry/registry.js");
Object.defineProperty(exports, "Registry", { enumerable: true, get: function () { return registry_js_2.Registry; } });
//# sourceMappingURL=core.js.map