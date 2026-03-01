"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceCreator = exports.WorkspaceCreateError = void 0;
exports.slugify = slugify;
exports.generateBranchName = generateBranchName;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const workspace_metadata_store_js_1 = require("./workspace-metadata-store.js");
const workspace_manager_js_1 = require("./workspace-manager.js");
const global_config_loader_js_1 = require("../config/global-config-loader.js");
const path_utils_js_1 = require("../config/path-utils.js");
const repo_index_store_js_1 = require("../repo/repo-index-store.js");
const repo_index_query_js_1 = require("../repo/repo-index-query.js");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Custom error type for workspace creation failures.
 */
class WorkspaceCreateError extends Error {
    suggestion;
    constructor(message, suggestion) {
        super(message);
        this.suggestion = suggestion;
        this.name = 'WorkspaceCreateError';
        Object.setPrototypeOf(this, WorkspaceCreateError.prototype);
    }
}
exports.WorkspaceCreateError = WorkspaceCreateError;
/**
 * Helper: Convert text to lowercase kebab-case, max 30 chars.
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
}
/**
 * Helper: Generate branch name from pattern, replacing {subtype}, {id}, {slug}.
 */
function generateBranchName(pattern, vars) {
    let result = pattern;
    if (vars.subtype !== undefined) {
        result = result.replace(/{subtype}/g, vars.subtype);
    }
    if (vars.id !== undefined) {
        result = result.replace(/{id}/g, vars.id);
    }
    if (vars.slug !== undefined) {
        result = result.replace(/{slug}/g, vars.slug);
    }
    // Remove any remaining unfilled placeholders
    result = result.replace(/{[^}]+}/g, '');
    // Clean up double slashes
    result = result.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    return result || 'workspace';
}
/**
 * Helper: Create a git worktree for a repository.
 */
async function createGitWorktree(opts) {
    const runGit = async (args, cwd) => {
        const { stdout } = await execFileAsync('git', args, { cwd, timeout: 30000 });
        return stdout.trim();
    };
    try {
        // Stash if requested
        if (opts.stashFirst) {
            try {
                const status = await runGit(['status', '--porcelain'], opts.repoPath);
                if (status) {
                    await runGit(['stash'], opts.repoPath);
                }
            }
            catch (err) {
                // Stash failure is non-fatal
                console.warn(`[Forge] Warning: Could not stash changes in ${opts.repoPath}`);
            }
        }
        // Try to create worktree with new branch
        try {
            await runGit(['worktree', 'add', opts.worktreePath, '-b', opts.branchName], opts.repoPath);
        }
        catch (err) {
            const errMsg = err.message || '';
            // If branch already exists, try without -b
            if (errMsg.includes('already exists')) {
                await runGit(['worktree', 'add', opts.worktreePath, opts.branchName], opts.repoPath);
            }
            else {
                throw err;
            }
        }
    }
    catch (err) {
        throw new WorkspaceCreateError(`Failed to create git worktree at ${opts.worktreePath}: ${err.message}`, 'Check that the repo path is valid and accessible');
    }
}
/**
 * Main workspace creator class.
 */
class WorkspaceCreator {
    forge;
    constructor(forge) {
        this.forge = forge;
    }
    async create(options) {
        // Step 1: Resolve workspace config from registry
        let configArtifact;
        try {
            const refString = `workspace-config:${options.configName}@${options.configVersion ?? '*'}`;
            configArtifact = await this.forge.resolve(refString);
        }
        catch (err) {
            throw new WorkspaceCreateError(`Workspace config '${options.configName}' not found in registry`, `Available configs: forge list --available -t workspace-config`);
        }
        const workspaceConfigMeta = configArtifact.bundle.meta;
        // Step 2: Determine mount path
        const globalConfig = await (0, global_config_loader_js_1.loadGlobalConfig)();
        const mountPath = (0, path_utils_js_1.expandPath)(options.mountPath ?? globalConfig.workspace.mount_path);
        // Step 3: Generate workspace name and ID
        const id = (0, workspace_metadata_store_js_1.generateWorkspaceId)();
        const slugPart = options.storyId ?? id;
        const name = `${options.configName}-${slugPart}`;
        const workspacePath = path_1.default.join(mountPath, name);
        // Step 4: Resolve repos (if specified)
        let resolvedRepos = [];
        if (options.repos && options.repos.length > 0) {
            const repoIndex = await (0, repo_index_store_js_1.loadRepoIndex)(globalConfig.repos.index_path);
            if (!repoIndex) {
                throw new WorkspaceCreateError('Repository index not found', 'Run: forge repo scan');
            }
            const query = new repo_index_query_js_1.RepoIndexQuery(repoIndex.repos);
            for (const repoName of options.repos) {
                const repo = query.findByName(repoName);
                if (!repo) {
                    throw new WorkspaceCreateError(`Repository "${repoName}" not found in local index`, 'Run: forge repo scan');
                }
                resolvedRepos.push(repo);
            }
        }
        // Step 5: Create workspace folder
        try {
            await fs_1.promises.mkdir(workspacePath, { recursive: true });
        }
        catch (err) {
            throw new WorkspaceCreateError(`Failed to create workspace folder at ${workspacePath}: ${err.message}`);
        }
        try {
            // Step 6: Create git worktrees for each repo
            const reposWithWorktrees = [];
            for (const repo of resolvedRepos) {
                const branchName = generateBranchName(workspaceConfigMeta.git_workflow.branch_pattern, {
                    subtype: 'feature',
                    id: options.storyId ?? id,
                    slug: slugify(options.storyTitle ?? options.configName),
                });
                const worktreePath = path_1.default.join(workspacePath, repo.name);
                try {
                    await createGitWorktree({
                        repoPath: repo.localPath,
                        worktreePath,
                        branchName,
                        baseBranch: workspaceConfigMeta.git_workflow.base_branch,
                        stashFirst: workspaceConfigMeta.git_workflow.stash_before_checkout,
                    });
                    reposWithWorktrees.push({
                        name: repo.name,
                        localPath: repo.localPath,
                        branch: branchName,
                        worktreePath,
                    });
                }
                catch (err) {
                    // Graceful fallback: log warning but continue without worktree
                    console.warn(`[Forge] Warning: Could not create worktree for ${repo.name}: ${err.message}`);
                    reposWithWorktrees.push({
                        name: repo.name,
                        localPath: repo.localPath,
                        branch: branchName,
                        worktreePath: null,
                    });
                }
            }
            // Step 7: Create workspace forge.yaml and install plugins/skills
            const workspaceForgeConfig = {
                name,
                version: '0.1.0',
                target: 'claude-code',
                outputDir: '.',
                registries: globalConfig.registries,
                artifacts: {
                    skills: {},
                    agents: {},
                    plugins: Object.fromEntries(workspaceConfigMeta.plugins.map(p => [p, '*'])),
                    'workspace-configs': {},
                },
            };
            const workspaceManager = new workspace_manager_js_1.WorkspaceManager(workspacePath);
            await workspaceManager.writeConfig(workspaceForgeConfig);
            // Install using a new ForgeCore instance for this workspace
            try {
                const workspaceForge = new (await import('../core.js')).ForgeCore(workspacePath);
                await workspaceForge.install({
                    target: 'claude-code',
                    conflictStrategy: 'overwrite',
                });
            }
            catch (err) {
                console.warn(`[Forge] Warning: Failed to install plugins: ${err.message}`);
            }
            // Step 8: Emit MCP configs
            const mcpDir = path_1.default.join(workspacePath, '.claude', 'mcp-servers');
            await fs_1.promises.mkdir(mcpDir, { recursive: true });
            for (const [serverName, serverConfig] of Object.entries(workspaceConfigMeta.mcp_servers)) {
                const endpoint = globalConfig.mcp_endpoints[serverName];
                if (!endpoint && serverConfig.required) {
                    console.warn(`[Forge] Warning: MCP endpoint '${serverName}' not configured in ~/.forge/config.yaml`);
                    continue;
                }
                if (endpoint) {
                    const mcpConfig = {
                        name: serverName,
                        url: endpoint.url,
                        transport: endpoint.transport,
                    };
                    await fs_1.promises.writeFile(path_1.default.join(mcpDir, `${serverName}.json`), JSON.stringify(mcpConfig, null, 2), 'utf-8');
                }
            }
            // Step 9: Emit environment variables file
            const envVars = {
                SDLC_BRANCH_PATTERN: workspaceConfigMeta.git_workflow.branch_pattern,
                SDLC_BASE_BRANCH: workspaceConfigMeta.git_workflow.base_branch,
                SDLC_COMMIT_FORMAT: workspaceConfigMeta.git_workflow.commit_format,
                SDLC_STASH_BEFORE_CHECKOUT: String(workspaceConfigMeta.git_workflow.stash_before_checkout),
                SDLC_PR_TEMPLATE: String(workspaceConfigMeta.git_workflow.pr_template),
                SDLC_SIGNED_COMMITS: String(workspaceConfigMeta.git_workflow.signed_commits),
                FORGE_WORKSPACE_ID: id,
                FORGE_WORKSPACE_NAME: name,
            };
            const envContent = Object.entries(envVars)
                .map(([k, v]) => `${k}=${v}`)
                .join('\n') + '\n';
            await fs_1.promises.writeFile(path_1.default.join(workspacePath, 'workspace.env'), envContent, 'utf-8');
            // Step 10: Emit CLAUDE.md
            const claudeMd = `# Workspace: ${name}

> Created: ${new Date().toISOString().slice(0, 10)} | Config: ${options.configName}

## Context
${options.storyTitle ? `Story: ${options.storyTitle} (${options.storyId})` : 'No story linked'}

## Repositories
${reposWithWorktrees.map(r => `- **${r.name}**: ${r.localPath}`).join('\n') || '(none)'}

## MCP Servers
${Object.keys(workspaceConfigMeta.mcp_servers).map(s => `- ${s}`).join('\n') || '(none configured)'}

## Environment
Source \`workspace.env\` for SDLC environment variables.
`;
            await fs_1.promises.writeFile(path_1.default.join(workspacePath, 'CLAUDE.md'), claudeMd, 'utf-8');
            // Step 11: Register workspace in metadata store
            const metaStore = new workspace_metadata_store_js_1.WorkspaceMetadataStore();
            const record = {
                id,
                name,
                configRef: `${options.configName}@${configArtifact.ref.version}`,
                storyId: options.storyId ?? null,
                storyTitle: options.storyTitle ?? null,
                path: workspacePath,
                status: 'active',
                repos: reposWithWorktrees,
                createdAt: new Date().toISOString(),
                lastAccessedAt: new Date().toISOString(),
                completedAt: null,
            };
            await metaStore.create(record);
            return record;
        }
        catch (err) {
            // Clean up workspace folder on failure
            try {
                await fs_1.promises.rm(workspacePath, { recursive: true, force: true });
            }
            catch {
                // Ignore cleanup errors
            }
            // Re-throw or wrap error
            if (err instanceof WorkspaceCreateError) {
                throw err;
            }
            throw new WorkspaceCreateError(`Failed to create workspace: ${err.message}`, 'Check logs above for details');
        }
    }
}
exports.WorkspaceCreator = WorkspaceCreator;
//# sourceMappingURL=workspace-creator.js.map