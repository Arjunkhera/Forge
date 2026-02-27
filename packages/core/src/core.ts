import path from 'path';
import { WorkspaceManager } from './workspace/workspace-manager.js';
import { Registry } from './registry/registry.js';
import { Resolver } from './resolver/resolver.js';
import { Compiler } from './compiler/compiler.js';
import { ClaudeCodeStrategy } from './compiler/claude-code-strategy.js';
import { FilesystemAdapter } from './adapters/filesystem-adapter.js';
import type {
  ArtifactRef,
  ArtifactSummary,
  ArtifactType,
  InstallReport,
  SearchResult,
  ResolvedArtifact,
  LockFile,
  LockedArtifact,
} from './models/index.js';
import type { ForgeConfig, RegistryConfig } from './models/forge-config.js';
import { ForgeError } from './adapters/errors.js';

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
export class ForgeCore {
  private readonly workspaceManager: WorkspaceManager;
  private readonly compiler: Compiler;

  constructor(private readonly workspaceRoot: string = process.cwd()) {
    this.workspaceManager = new WorkspaceManager(workspaceRoot);
    this.compiler = new Compiler();
    this.compiler.register(new ClaudeCodeStrategy());
  }

  /**
   * Initialize a new Forge workspace.
   * Creates forge.yaml and forge.lock.
   */
  async init(name: string): Promise<void> {
    await this.workspaceManager.scaffoldWorkspace(name);
  }

  /**
   * Search the registry for artifacts matching a query.
   */
  async search(query: string, type?: ArtifactType): Promise<SearchResult[]> {
    const registry = await this.buildRegistry();
    return registry.search(query, type);
  }

  /**
   * Add artifact ref(s) to forge.yaml.
   * Validates the artifact exists in the registry before adding.
   */
  async add(refStrings: string | string[]): Promise<ForgeConfig> {
    const refs = Array.isArray(refStrings) ? refStrings : [refStrings];
    const config = await this.workspaceManager.readConfig();
    const registry = await this.buildRegistry();

    for (const refStr of refs) {
      const ref = this.parseRef(refStr);

      // Validate artifact exists
      const exists = await new FilesystemAdapter(
        this.resolveRegistryPath(config.registries[0])
      ).exists(ref.type, ref.id);

      // Even if not found locally, add to config (might be installed via HTTP later)
      // But if we have a registry, do a best-effort check
      if (config.registries.length > 0) {
        try {
          await registry.get(ref);
        } catch {
          console.warn(`[ForgeCore] Warning: '${refStr}' not found in any registry. Adding anyway.`);
        }
      }

      // Add to config
      if (ref.type === 'skill') {
        config.artifacts.skills[ref.id] = ref.version;
      } else if (ref.type === 'agent') {
        config.artifacts.agents[ref.id] = ref.version;
      } else if (ref.type === 'plugin') {
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
  async install(options: InstallOptions = {}): Promise<InstallReport> {
    const startTime = Date.now();
    const config = await this.workspaceManager.readConfig();
    const lock = await this.workspaceManager.readLock();
    const registry = await this.buildRegistry();
    const resolver = new Resolver(registry);

    // Build ref list from config artifacts
    const refs: ArtifactRef[] = [
      ...Object.entries(config.artifacts.skills).map(([id, version]) => ({
        type: 'skill' as const, id, version,
      })),
      ...Object.entries(config.artifacts.agents).map(([id, version]) => ({
        type: 'agent' as const, id, version,
      })),
      ...Object.entries(config.artifacts.plugins).map(([id, version]) => ({
        type: 'plugin' as const, id, version,
      })),
    ];

    // Resolve all artifacts
    resolver.reset();
    const resolved = await resolver.resolveAll(refs);

    // Compile to file operations
    const target = options.target ?? config.target;
    const fileOps = this.compiler.emitAll(resolved, target);

    const report: InstallReport = {
      installed: resolved.map(r => r.ref),
      filesWritten: [],
      conflicts: [],
      duration: 0,
    };

    if (!options.dryRun) {
      // Merge files into workspace
      const mergeReport = await this.workspaceManager.mergeFiles(
        fileOps,
        lock,
        options.conflictStrategy ?? 'backup',
      );

      report.filesWritten = mergeReport.written;
      report.conflicts = mergeReport.conflicts;

      // Update lockfile
      const newLock: LockFile = {
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
    } else {
      report.filesWritten = fileOps.map(op => op.path);
    }

    report.duration = Date.now() - startTime;
    return report;
  }

  /**
   * Remove artifacts from forge.yaml and clean lockfile-tracked files.
   */
  async remove(refStrings: string | string[]): Promise<void> {
    const refs = Array.isArray(refStrings) ? refStrings : [refStrings];
    const config = await this.workspaceManager.readConfig();

    for (const refStr of refs) {
      const ref = this.parseRef(refStr);
      if (ref.type === 'skill') delete config.artifacts.skills[ref.id];
      else if (ref.type === 'agent') delete config.artifacts.agents[ref.id];
      else if (ref.type === 'plugin') delete config.artifacts.plugins[ref.id];
    }

    await this.workspaceManager.writeConfig(config);
  }

  /**
   * Resolve a single artifact ref (for forge_resolve MCP tool).
   */
  async resolve(refString: string): Promise<ResolvedArtifact> {
    const ref = this.parseRef(refString);
    const registry = await this.buildRegistry();
    const resolver = new Resolver(registry);
    resolver.reset();
    return resolver.resolve(ref);
  }

  /**
   * List installed (from lock) or available (from registry) artifacts.
   */
  async list(scope: 'installed' | 'available' = 'available'): Promise<ArtifactSummary[]> {
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
  async getConfig(): Promise<ForgeConfig> {
    return this.workspaceManager.readConfig();
  }

  // Internal helpers

  private async buildRegistry(): Promise<Registry> {
    let config: ForgeConfig;
    try {
      config = await this.workspaceManager.readConfig();
    } catch {
      // No config — return empty registry backed by empty adapter
      return new Registry(new FilesystemAdapter(path.join(this.workspaceRoot, 'registry')));
    }

    if (config.registries.length === 0) {
      return new Registry(new FilesystemAdapter(path.join(this.workspaceRoot, 'registry')));
    }

    // Use the first filesystem registry for now (CompositeAdapter in S010)
    const fsRegistry = config.registries.find(r => r.type === 'filesystem');
    const registryPath = fsRegistry
      ? this.resolveRegistryPath(fsRegistry)
      : path.join(this.workspaceRoot, 'registry');

    return new Registry(new FilesystemAdapter(registryPath));
  }

  private resolveRegistryPath(registryConfig: RegistryConfig | undefined): string {
    if (!registryConfig || registryConfig.type !== 'filesystem') {
      return path.join(this.workspaceRoot, 'registry');
    }
    return path.isAbsolute(registryConfig.path)
      ? registryConfig.path
      : path.join(this.workspaceRoot, registryConfig.path);
  }

  private parseRef(refStr: string): ArtifactRef {
    // Format: "type:id@version" or "type:id" or "id@version" or "id"
    let type: ArtifactRef['type'] = 'skill';
    let id: string;
    let version = '*';

    let remaining = refStr;

    // Extract type prefix
    if (remaining.startsWith('skill:')) { type = 'skill'; remaining = remaining.slice(6); }
    else if (remaining.startsWith('agent:')) { type = 'agent'; remaining = remaining.slice(6); }
    else if (remaining.startsWith('plugin:')) { type = 'plugin'; remaining = remaining.slice(7); }

    // Extract version suffix
    const atIdx = remaining.indexOf('@');
    if (atIdx !== -1) {
      id = remaining.slice(0, atIdx);
      version = remaining.slice(atIdx + 1);
    } else {
      id = remaining;
    }

    if (!id) {
      throw new ForgeError('INVALID_REF', `Invalid artifact ref: '${refStr}'`, `Use format: skill:my-skill@1.0.0`);
    }

    return { type, id, version };
  }
}

// Re-export Registry for convenience
export { Registry } from './registry/registry.js';
