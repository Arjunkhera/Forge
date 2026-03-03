/**
 * Describes an MCP server to register in .claude/settings.local.json.
 */
export interface McpServerEntry {
    name: string;
    url: string;
}
/**
 * Emit the mcp-remote wrapper script to {workspacePath}/.claude/bin/mcp-remote-wrapper.
 * Idempotent — safe to call on every workspace creation.
 * Returns the path to the wrapper (Docker-internal path).
 */
export declare function emitMcpRemoteWrapper(workspacePath: string): Promise<string>;
/**
 * Merge the given MCP server entries into {workspacePath}/.claude/settings.local.json
 * using the managed wrapper script. Preserves all existing settings.
 *
 * Writes to settings.local.json (machine-specific, gitignored) because it contains
 * absolute host paths and localhost URLs that differ per machine.
 *
 * The workspacePath is the Docker-internal path (e.g., /data/workspaces/...).
 * The hostWorkspacePath is the host-side equivalent (e.g., /Users/me/.../workspaces/...).
 * These differ when Forge runs in Docker; pass the same value for native installs.
 *
 * Each entry produces a mcpServers record like:
 *   "anvil": { "command": "/host/path/.claude/bin/mcp-remote-wrapper", "args": ["http://localhost:8100", "--transport", "http"] }
 */
export declare function updateClaudeMcpServers(servers: McpServerEntry[], workspacePath: string, hostWorkspacePath: string): Promise<void>;
/**
 * @deprecated Use updateClaudeMcpServers with explicit workspacePath and hostWorkspacePath.
 * Retained as a no-op shim to avoid breaking any code that imports WRAPPER_PATH.
 */
export declare const WRAPPER_PATH = "";
//# sourceMappingURL=mcp-settings-writer.d.ts.map