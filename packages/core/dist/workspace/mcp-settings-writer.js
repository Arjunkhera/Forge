"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRAPPER_PATH = void 0;
exports.updateClaudeMcpServers = updateClaudeMcpServers;
exports.emitMcpRemoteWrapper = emitMcpRemoteWrapper;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Merge the given MCP server entries into {workspacePath}/.claude/settings.local.json
 * using Claude Code's native HTTP transport. Preserves all existing settings.
 *
 * Writes to settings.local.json (machine-specific, gitignored) because it contains
 * localhost URLs that differ per machine.
 *
 * Each entry produces a mcpServers record like:
 *   "anvil": { "type": "http", "url": "http://localhost:8100/mcp" }
 *
 * This replaces the previous mcp-remote wrapper approach.  Claude Code natively
 * supports Streamable HTTP via `type: "http"`, which eliminates the mcp-remote
 * middleman process entirely — fixing both the process-leak bug (orphaned
 * mcp-remote processes after session end) and the TCP-hang bug (fetch() with no
 * per-request timeout after macOS sleep/wake).
 */
async function updateClaudeMcpServers(servers, workspacePath, _hostWorkspacePath) {
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
    await fs_1.promises.mkdir(path_1.default.dirname(settingsPath), { recursive: true });
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