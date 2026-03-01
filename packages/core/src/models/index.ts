// Skill Meta
export {
  SkillMetaSchema,
  SemVerSchema,
  SemVerRangeSchema,
  type SkillMeta,
} from './skill-meta.js';

// Agent Meta
export { AgentMetaSchema, type AgentMeta } from './agent-meta.js';

// Plugin Meta
export { PluginMetaSchema, type PluginMeta } from './plugin-meta.js';

// Workspace Config Meta
export {
  WorkspaceConfigMetaSchema,
  type WorkspaceConfigMeta,
  type GitWorkflowConfig,
  type McpServerConfig,
  type WorkspaceSettingsConfig,
} from './workspace-config-meta.js';

// Forge Config
export {
  ForgeConfigSchema,
  RegistryConfigSchema,
  type ForgeConfig,
  type RegistryConfig,
  type Target,
} from './forge-config.js';

// Global Config
export {
  GlobalConfigSchema,
  WorkspaceSettingsSchema,
  McpEndpointSchema,
  McpEndpointsSchema,
  ReposConfigSchema,
  type GlobalConfig,
  type WorkspaceSettings,
  type McpEndpoint,
  type McpEndpoints,
  type ReposConfig,
} from './global-config.js';

// Lock File
export {
  LockFileSchema,
  LockedArtifactSchema,
  type LockFile,
  type LockedArtifact,
} from './lock-file.js';

// Shared Types
export type {
  ArtifactType,
  ArtifactRef,
  ArtifactMeta,
  ArtifactBundle,
  SearchResult,
  ResolvedArtifact,
  FileOperation,
  InstallReport,
  ConflictRecord,
  ConflictStrategy,
  MergeReport,
  ArtifactSummary,
} from './shared-types.js';
