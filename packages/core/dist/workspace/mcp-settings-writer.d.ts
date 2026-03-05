/**
 * Describes an MCP server to register in .claude/settings.local.json.
 */
export interface McpServerEntry {
    name: string;
    url: string;
}
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
export declare function updateClaudeMcpServers(servers: McpServerEntry[], workspacePath: string, _hostWorkspacePath?: string): Promise<void>;
/**
 * @deprecated No longer needed — native HTTP transport eliminates mcp-remote.
 * Retained to avoid breaking any code that imports this function.
 */
export declare function emitMcpRemoteWrapper(workspacePath: string): Promise<string>;
/**
 * @deprecated Use updateClaudeMcpServers with explicit workspacePath and hostWorkspacePath.
 * Retained as a no-op shim to avoid breaking any code that imports WRAPPER_PATH.
 */
export declare const WRAPPER_PATH = "";
//# sourceMappingURL=mcp-settings-writer.d.ts.map