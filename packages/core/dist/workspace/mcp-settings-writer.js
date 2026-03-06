"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRAPPER_PATH = void 0;
exports.updateClaudeMcpServers = updateClaudeMcpServers;
exports.emitPreToolUseHook = emitPreToolUseHook;
exports.emitMcpRemoteWrapper = emitMcpRemoteWrapper;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Merge the given MCP server entries and permissions into
 * {workspacePath}/.claude/settings.local.json using Claude Code's native
 * HTTP transport. Preserves all existing settings.
 *
 * Writes to settings.local.json (machine-specific, gitignored) because it
 * contains localhost URLs that differ per machine.
 *
 * Each entry produces a mcpServers record like:
 *   "anvil": { "type": "http", "url": "http://localhost:8100/mcp" }
 *
 * Permissions from `claude_permissions` in ~/.forge/config.yaml are merged
 * into the file so that the local settings don't shadow the user's global
 * ~/.claude/settings.json permissions (Claude Code treats a local
 * settings.local.json as authoritative when it exists).
 */
async function updateClaudeMcpServers(servers, workspacePath, _hostWorkspacePath, claudePermissions) {
    if (servers.length === 0)
        return;
    const settingsPath = path_1.default.join(workspacePath, '.claude', 'settings.local.json');
    // Read existing settings, defaulting to empty object on missing/invalid file.
    let settings = {};
    try {
        const raw = await fs_1.promises.readFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
    }
    catch {
        // File absent or unparseable — start fresh.
    }
    // Merge: add/overwrite only the servers Forge knows about; leave others intact.
    const mcpServers = settings.mcpServers ?? {};
    for (const { name, url } of servers) {
        // Append /mcp to the base URL for the Streamable HTTP endpoint.
        const mcpUrl = url.replace(/\/+$/, '') + '/mcp';
        mcpServers[name] = {
            type: 'http',
            url: mcpUrl,
        };
    }
    settings.mcpServers = mcpServers;
    // Merge permissions from claude_permissions config into the local file.
    // Without this, the mere existence of settings.local.json causes Claude Code to
    // treat the local permissions as authoritative, shadowing the global wildcard.
    const configAllow = claudePermissions?.allow ?? ['mcp__*'];
    const configDeny = claudePermissions?.deny ?? [];
    const permissions = settings.permissions ?? {};
    const allow = Array.isArray(permissions.allow) ? permissions.allow : [];
    for (const entry of configAllow) {
        if (!allow.includes(entry)) {
            allow.push(entry);
        }
    }
    permissions.allow = allow;
    if (configDeny.length > 0) {
        const deny = Array.isArray(permissions.deny) ? permissions.deny : [];
        for (const entry of configDeny) {
            if (!deny.includes(entry)) {
                deny.push(entry);
            }
        }
        permissions.deny = deny;
    }
    settings.permissions = permissions;
    await fs_1.promises.mkdir(path_1.default.dirname(settingsPath), { recursive: true });
    await fs_1.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
/**
 * Emit the guard-source-repos.sh script and register a PreToolUse hook in
 * .claude/settings.local.json that blocks Edit/Write operations targeting
 * source repo paths. Forces Claude to use forge_repo_clone for isolation.
 *
 * @param workspacePath   Container-side workspace root (where files are written)
 * @param hostWorkspacePath  Host-side workspace root (used in hook command path)
 * @param sourceReposPath Host-side path to source repositories (e.g., ~/Desktop/Repositories)
 */
async function emitPreToolUseHook(workspacePath, hostWorkspacePath, sourceReposPath) {
    // 1. Write the guard script with the source repos path baked in
    const scriptsDir = path_1.default.join(workspacePath, '.claude', 'scripts');
    await fs_1.promises.mkdir(scriptsDir, { recursive: true });
    const guardScript = `#!/bin/bash
# Guard script: blocks Edit/Write on source repos, forcing forge_repo_clone usage.
# Emitted by Forge during workspace creation. Do not edit manually.

input=$(cat)

# Check jq is available
if ! command -v jq &>/dev/null; then
  # Can't parse input without jq — allow to avoid breaking non-jq environments
  exit 0
fi

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# If no file_path in the tool input, allow (not a file operation we care about)
if [ -z "$file_path" ]; then
  exit 0
fi

# Resolve to absolute path if relative
if [[ "$file_path" != /* ]]; then
  file_path="$(pwd)/$file_path"
fi

# Source repos directory — baked in at workspace creation time
SOURCE_REPOS_PATH=${JSON.stringify(sourceReposPath)}

# Normalize: strip trailing slash
SOURCE_REPOS_PATH="\${SOURCE_REPOS_PATH%/}"

# Check if the file is inside the source repos directory
if [[ "$file_path" == "$SOURCE_REPOS_PATH"/* ]]; then
  # Extract repo name from path
  repo_name=$(echo "$file_path" | sed "s|^$SOURCE_REPOS_PATH/||" | cut -d'/' -f1)

  cat >&2 <<MSG
BLOCKED: Cannot edit files in source repository '\${repo_name}' directly.

To get an isolated working copy, call:
  forge_repo_clone with repoName="\${repo_name}"

Then edit files in the returned clonePath instead.
MSG
  exit 2
fi

# Allow edits to workspace paths, clone paths, and non-repo files
exit 0
`;
    const scriptPath = path_1.default.join(scriptsDir, 'guard-source-repos.sh');
    await fs_1.promises.writeFile(scriptPath, guardScript, { mode: 0o755 });
    // 2. Merge the PreToolUse hook into .claude/settings.local.json
    const settingsPath = path_1.default.join(workspacePath, '.claude', 'settings.local.json');
    let settings = {};
    try {
        const raw = await fs_1.promises.readFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
    }
    catch {
        // File absent or unparseable — start fresh.
    }
    const hookCommand = `bash ${hostWorkspacePath}/.claude/scripts/guard-source-repos.sh`;
    const hooks = settings.hooks ?? {};
    const preToolUse = hooks.PreToolUse ?? [];
    // Avoid duplicate: check if we already have this matcher
    const existing = preToolUse.find((entry) => entry.matcher === 'Edit|Write' && Array.isArray(entry.hooks) &&
        entry.hooks.some((h) => h.type === 'command' && typeof h.command === 'string' &&
            h.command.includes('guard-source-repos.sh')));
    if (!existing) {
        preToolUse.push({
            matcher: 'Edit|Write',
            hooks: [
                {
                    type: 'command',
                    command: hookCommand,
                },
            ],
        });
    }
    hooks.PreToolUse = preToolUse;
    settings.hooks = hooks;
    await fs_1.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
/**
 * @deprecated No longer needed — native HTTP transport eliminates mcp-remote.
 * Retained to avoid breaking any code that imports this function.
 */
async function emitMcpRemoteWrapper(workspacePath) {
    return path_1.default.join(workspacePath, '.claude', 'bin', 'mcp-remote-wrapper');
}
/**
 * @deprecated Use updateClaudeMcpServers with explicit workspacePath and hostWorkspacePath.
 * Retained as a no-op shim to avoid breaking any code that imports WRAPPER_PATH.
 */
exports.WRAPPER_PATH = '';
//# sourceMappingURL=mcp-settings-writer.js.map