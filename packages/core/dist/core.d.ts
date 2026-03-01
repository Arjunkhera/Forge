import { type WorkspaceCreateOptions } from './workspace/workspace-creator.js';
import type { ArtifactSummary, ArtifactType, InstallReport, SearchResult, ResolvedArtifact, WorkspaceRecord } from './models/index.js';
import type { ForgeConfig } from './models/forge-config.js';
import type { RepoIndex, RepoIndexEntry } from './models/repo-index.js';
export interface InstallOptions {
    target?: ForgeConfig['target'];
    conflictStrategy?: 'overwrite' | 'skip' | 'backup';
    dryRun?: boolean;
}
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
export interface ForgeCoreOptions {
    /** Override the global config path (default: ~/.forge/config.yaml). Useful for testing. */
    globalConfigPath?: string;
}
export declare class ForgeCore {
    private readonly workspaceRoot;
    private readonly workspaceManager;
    private readonly compiler;
    private readonly globalConfigPath;
    private readonly lifecycleManager;
    private readonly metadataStore;
    constructor(workspaceRoot?: string, options?: ForgeCoreOptions);
    /**
     * Initialize a new Forge workspace.
     * Creates forge.yaml and forge.lock.
     */
    init(name: string): Promise<void>;
    /**
     * Search the registry for artifacts matching a query.
     */
    search(query: string, type?: ArtifactType): Promise<SearchResult[]>;
    /**
     * Add artifact ref(s) to forge.yaml.
     * Validates the artifact exists in the registry before adding.
     */
    add(refStrings: string | string[]): Promise<ForgeConfig>;
    /**
     * Run the full install pipeline:
     * readConfig → resolveAll → emitAll → mergeFiles → writeLock
     */
    install(options?: InstallOptions): Promise<InstallReport>;
    /**
     * Remove artifacts from forge.yaml and clean lockfile-tracked files.
     */
    remove(refStrings: string | string[]): Promise<void>;
    /**
     * Resolve a single artifact ref (for forge_resolve MCP tool).
     */
    resolve(refString: string): Promise<ResolvedArtifact>;
    /**
     * List installed (from lock) or available (from registry) artifacts.
     */
    list(scope?: 'installed' | 'available', type?: ArtifactType): Promise<ArtifactSummary[]>;
    /**
     * Read the current forge.yaml config.
     */
    getConfig(): Promise<ForgeConfig>;
    /**
     * Scan configured directories for git repositories and update the index.
     */
    repoScan(): Promise<RepoIndex>;
    /**
     * List repositories from the index, optionally filtered by query.
     */
    repoList(query?: string): Promise<RepoIndexEntry[]>;
    /**
     * Resolve a repository by name or remote URL.
     */
    repoResolve(opts: {
        name?: string;
        remoteUrl?: string;
    }): Promise<RepoIndexEntry | null>;
    /**
     * Create a new workspace from a workspace config artifact.
     * Resolves the workspace config, sets up folders, installs plugins,
     * creates git worktrees, and registers in metadata store.
     */
    workspaceCreate(options: WorkspaceCreateOptions): Promise<WorkspaceRecord>;
    /**
     * List workspaces, optionally filtered by status.
     */
    workspaceList(filter?: {
        status?: string;
    }): Promise<WorkspaceRecord[]>;
    /**
     * Get status of a workspace.
     */
    workspaceStatus(id: string): Promise<WorkspaceRecord | null>;
    /**
     * Pause a workspace.
     */
    workspacePause(id: string): Promise<WorkspaceRecord>;
    /**
     * Complete a workspace.
     */
    workspaceComplete(id: string): Promise<WorkspaceRecord>;
    /**
     * Delete a workspace.
     */
    workspaceDelete(id: string, opts?: {
        force?: boolean;
    }): Promise<void>;
    /**
     * Archive a workspace.
     */
    workspaceArchive(id: string): Promise<WorkspaceRecord>;
    /**
     * Clean workspaces based on retention policy.
     */
    workspaceClean(opts?: {
        dryRun?: boolean;
    }): Promise<{
        cleaned: string[];
        skipped: string[];
    }>;
    private buildRegistry;
    /**
     * Instantiate the correct DataAdapter for a registry config entry.
     */
    private buildAdapter;
    private parseRef;
}
export { Registry } from './registry/registry.js';
//# sourceMappingURL=core.d.ts.map