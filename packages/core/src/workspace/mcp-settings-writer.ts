import { promises as fs } from 'fs';
import path from 'path';

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
export async function updateClaudeMcpServers(
  servers: McpServerEntry[],
  workspacePath: string,
  _hostWorkspacePath?: string,
): Promise<void> {
  if (servers.length === 0) return;

  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json');

  // Read existing settings, defaulting to empty object on missing/invalid file.
  let settings: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    settings = JSON.parse(raw);
  } catch {
    // File absent or unparseable — start fresh.
  }

  // Merge: add/overwrite only the servers Forge knows about; leave others intact.
  const mcpServers = (settings.mcpServers as Record<string, unknown>) ?? {};
  for (const { name, url } of servers) {
    // Append /mcp to the base URL for the Streamable HTTP endpoint.
    const mcpUrl = url.replace(/\/+$/, '') + '/mcp';
    mcpServers[name] = {
      type: 'http',
      url: mcpUrl,
    };
  }
  settings.mcpServers = mcpServers;

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    JSON.stringify(settings, null, 2) + '\n',
    'utf-8',
  );
}

/**
 * @deprecated No longer needed — native HTTP transport eliminates mcp-remote.
 * Retained to avoid breaking any code that imports this function.
 */
export async function emitMcpRemoteWrapper(workspacePath: string): Promise<string> {
  return path.join(workspacePath, '.claude', 'bin', 'mcp-remote-wrapper');
}

/**
 * @deprecated Use updateClaudeMcpServers with explicit workspacePath and hostWorkspacePath.
 * Retained as a no-op shim to avoid breaking any code that imports WRAPPER_PATH.
 */
export const WRAPPER_PATH = '';
