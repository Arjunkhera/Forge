"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registry = exports.ForgeCore = void 0;
const path_1 = __importDefault(require("path"));
const workspace_manager_js_1 = require("./workspace/workspace-manager.js");
const workspace_creator_js_1 = require("./workspace/workspace-creator.js");
const workspace_lifecycle_js_1 = require("./workspace/workspace-lifecycle.js");
const workspace_metadata_store_js_1 = require("./workspace/workspace-metadata-store.js");
const registry_js_1 = require("./registry/registry.js");
const resolver_js_1 = require("./resolver/resolver.js");
const compiler_js_1 = require("./compiler/compiler.js");
const claude_code_strategy_js_1 = require("./compiler/claude-code-strategy.js");
const filesystem_adapter_js_1 = require("./adapters/filesystem-adapter.js");
const composite_adapter_js_1 = require("./adapters/composite-adapter.js");
const git_adapter_js_1 = require("./adapters/git-adapter.js");
const errors_js_1 = require("./adapters/errors.js");
const global_config_loader_js_1 = require("./config/global-config-loader.js");
const repo_scanner_js_1 = require("./repo/repo-scanner.js");
const repo_index_store_js_1 = require("./repo/repo-index-store.js");
const repo_index_query_js_1 = require("./repo/repo-index-query.js");
class ForgeCore {
    workspaceRoot;
    workspaceManager;
    compiler;
    globalConfigPath;
    lifecycleManager;
    metadataStore;
    constructor(workspaceRoot = process.cwd(), options) {
        this.workspaceRoot = workspaceRoot;
        this.workspaceManager = new workspace_manager_js_1.WorkspaceManager(workspaceRoot);
        this.compiler = new compiler_js_1.Compiler();
        this.compiler.register(new claude_code_strategy_js_1.ClaudeCodeStrategy());
        this.globalConfigPath = options?.globalConfigPath;
        this.metadataStore = new workspace_metadata_store_js_1.WorkspaceMetadataStore();
        this.lifecycleManager = new workspace_lifecycle_js_1.WorkspaceLifecycleManager(undefined, this.metadataStore);
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
            // Best-effort check: warn if artifact not found in any registry
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
                // Skip workspace-config artifacts — only skill|agent|plugin go in the lock file
                if (artifact.ref.type === 'workspace-config') {
                    continue;
                }
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
    async list(scope = 'available', type) {
        if (scope === 'installed') {
            const lock = await this.workspaceManager.readLock();
            let artifacts = Object.values(lock.artifacts).map(a => ({
                ref: { type: a.type, id: a.id, version: a.version },
                name: a.id,
                description: '',
                tags: [],
            }));
            if (type) {
                artifacts = artifacts.filter(a => a.ref.type === type);
            }
            return artifacts;
        }
        const registry = await this.buildRegistry();
        return registry.list(type);
    }
    /**
     * Read the current forge.yaml config.
     */
    async getConfig() {
        return this.workspaceManager.readConfig();
    }
    /**
     * Scan configured directories for git repositories and update the index.
     */
    async repoScan() {
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)(this.globalConfigPath);
        const { scan_paths, index_path } = globalConfig.repos;
        if (scan_paths.length === 0) {
            throw new Error('No scan paths configured. Run: forge config set repos.scan_paths ~/Repositories');
        }
        const existing = await (0, repo_index_store_js_1.loadRepoIndex)(index_path);
        const index = await (0, repo_scanner_js_1.scan)(scan_paths, existing ?? undefined);
        await (0, repo_index_store_js_1.saveRepoIndex)(index, index_path);
        return index;
    }
    /**
     * List repositories from the index, optionally filtered by query.
     */
    async repoList(query) {
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)(this.globalConfigPath);
        const { index_path, scan_paths } = globalConfig.repos;
        let index = await (0, repo_index_store_js_1.loadRepoIndex)(index_path);
        // Auto-scan if no index exists and scan_paths configured
        if (!index && scan_paths.length > 0) {
            console.log('[Forge] No repo index found. Running initial scan...');
            index = await this.repoScan();
        }
        if (!index)
            return [];
        const query_obj = new repo_index_query_js_1.RepoIndexQuery(index.repos);
        return query ? query_obj.search(query) : query_obj.listAll();
    }
    /**
     * Resolve a repository by name or remote URL.
     */
    async repoResolve(opts) {
        if (!opts.name && !opts.remoteUrl) {
            throw new Error('Either name or remoteUrl must be provided');
        }
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)(this.globalConfigPath);
        const { index_path, scan_paths } = globalConfig.repos;
        let index = await (0, repo_index_store_js_1.loadRepoIndex)(index_path);
        // Auto-scan if no index exists
        if (!index && scan_paths.length > 0) {
            console.log('[Forge] No repo index found. Running initial scan...');
            index = await this.repoScan();
        }
        if (!index)
            return null;
        const q = new repo_index_query_js_1.RepoIndexQuery(index.repos);
        if (opts.name)
            return q.findByName(opts.name);
        if (opts.remoteUrl)
            return q.findByRemoteUrl(opts.remoteUrl);
        return null;
    }
    /**
     * Create a new workspace from a workspace config artifact.
     * Resolves the workspace config, sets up folders, installs plugins,
     * creates git worktrees, and registers in metadata store.
     */
    async workspaceCreate(options) {
        const creator = new workspace_creator_js_1.WorkspaceCreator(this);
        return creator.create(options);
    }
    /**
     * List workspaces, optionally filtered by status.
     */
    async workspaceList(filter) {
        const filterObj = filter?.status ? { status: filter.status } : undefined;
        return this.metadataStore.list(filterObj);
    }
    /**
     * Get status of a workspace.
     */
    async workspaceStatus(id) {
        return this.metadataStore.get(id);
    }
    /**
     * Pause a workspace.
     */
    async workspacePause(id) {
        return this.lifecycleManager.pause(id);
    }
    /**
     * Complete a workspace.
     */
    async workspaceComplete(id) {
        return this.lifecycleManager.complete(id);
    }
    /**
     * Delete a workspace.
     */
    async workspaceDelete(id, opts) {
        return this.lifecycleManager.delete(id, opts);
    }
    /**
     * Archive a workspace.
     */
    async workspaceArchive(id) {
        return this.lifecycleManager.archive(id);
    }
    /**
     * Clean workspaces based on retention policy.
     */
    async workspaceClean(opts) {
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)(this.globalConfigPath);
        const retentionDays = globalConfig.workspace.retention_days;
        return this.lifecycleManager.clean(retentionDays, opts);
    }
    // Internal helpers
    async buildRegistry() {
        let config = null;
        try {
            config = await this.workspaceManager.readConfig();
        }
        catch {
            // No workspace config — fall through to global config below
        }
        // Load global config (~/.forge/config.yaml) for fallback registries
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)(this.globalConfigPath);
        if (!config) {
            // No workspace forge.yaml — use global config registries only
            const adapters = [];
            for (const reg of globalConfig.registries) {
                try {
                    adapters.push(this.buildAdapter(reg));
                }
                catch (err) {
                    console.warn(`[ForgeCore] Skipping registry '${reg.name}': ${err.message}`);
                }
            }
            if (adapters.length === 0) {
                return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(path_1.default.join(this.workspaceRoot, 'registry')));
            }
            const adapter = adapters.length === 1 ? adapters[0] : new composite_adapter_js_1.CompositeAdapter({ adapters });
            return new registry_js_1.Registry(adapter);
        }
        // Workspace registries first (higher priority), then global as fallbacks.
        // Deduplicate by name — workspace overrides global.
        const workspaceNames = new Set(config.registries.map(r => r.name));
        const globalFallbacks = globalConfig.registries.filter(r => !workspaceNames.has(r.name));
        const allRegistries = [...config.registries, ...globalFallbacks];
        if (allRegistries.length === 0) {
            return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(path_1.default.join(this.workspaceRoot, 'registry')));
        }
        // Build an adapter for each configured registry
        const adapters = [];
        for (const reg of allRegistries) {
            try {
                adapters.push(this.buildAdapter(reg));
            }
            catch (err) {
                console.warn(`[ForgeCore] Skipping registry '${reg.name}': ${err.message}`);
            }
        }
        if (adapters.length === 0) {
            // All registries failed to construct — fall back to local default
            return new registry_js_1.Registry(new filesystem_adapter_js_1.FilesystemAdapter(path_1.default.join(this.workspaceRoot, 'registry')));
        }
        // Single adapter → use directly; multiple → compose with priority ordering
        const adapter = adapters.length === 1
            ? adapters[0]
            : new composite_adapter_js_1.CompositeAdapter({ adapters });
        return new registry_js_1.Registry(adapter);
    }
    /**
     * Instantiate the correct DataAdapter for a registry config entry.
     */
    buildAdapter(reg) {
        switch (reg.type) {
            case 'filesystem': {
                const registryPath = path_1.default.isAbsolute(reg.path)
                    ? reg.path
                    : path_1.default.join(this.workspaceRoot, reg.path);
                return new filesystem_adapter_js_1.FilesystemAdapter(registryPath);
            }
            case 'git': {
                return new git_adapter_js_1.GitAdapter({
                    url: reg.url,
                    ref: reg.branch,
                    registryPath: reg.path,
                });
            }
            case 'http':
                throw new errors_js_1.ForgeError('UNSUPPORTED', `HTTP registries are not yet implemented (registry: '${reg.name}')`, 'Use a filesystem or git registry instead.');
            default:
                throw new errors_js_1.ForgeError('INVALID_CONFIG', `Unknown registry type in config`, 'Supported types: filesystem, git');
        }
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
        else if (remaining.startsWith('workspace-config:')) {
            type = 'workspace-config';
            remaining = remaining.slice(17);
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