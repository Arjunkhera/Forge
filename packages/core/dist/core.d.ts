import type { ArtifactSummary, ArtifactType, InstallReport, SearchResult, ResolvedArtifact } from './models/index.js';
import type { ForgeConfig } from './models/forge-config.js';
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
export declare class ForgeCore {
    private readonly workspaceRoot;
    private readonly workspaceManager;
    private readonly compiler;
    constructor(workspaceRoot?: string);
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
    list(scope?: 'installed' | 'available'): Promise<ArtifactSummary[]>;
    /**
     * Read the current forge.yaml config.
     */
    getConfig(): Promise<ForgeConfig>;
    private buildRegistry;
    private resolveRegistryPath;
    private parseRef;
}
export { Registry } from './registry/registry.js';
//# sourceMappingURL=core.d.ts.map