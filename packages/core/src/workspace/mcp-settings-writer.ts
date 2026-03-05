import { promises as fs } from 'fs';
import path from 'path';
import type { ClaudePermissions } from '../models/global-config.js';

/**
 * Describes an MCP server to register in .claude/settings.local.json.
 */
export interface McpServerEntry {
  name: string;
  url: string;
}

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
export async function updateClaudeMcpServers(
  servers: McpServerEntry[],
  workspacePath: string,
  _hostWorkspacePath?: string,
  claudePermissions?: ClaudePermissions,
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

  // Merge permissions from claude_permissions config into the local file.
  // Without this, the mere existence of settings.local.json causes Claude Code to
  // treat the local permissions as authoritative, shadowing the global wildcard.
  const configAllow = claudePermissions?.allow ?? ['mcp__*'];
  const configDeny = claudePermissions?.deny ?? [];

  const permissions = (settings.permissions as Record<string, unknown>) ?? {};
  const allow = Array.isArray(permissions.allow) ? permissions.allow as string[] : [];
  for (const entry of configAllow) {
    if (!allow.includes(entry)) {
      allow.push(entry);
    }
  }
  permissions.allow = allow;

  if (configDeny.length > 0) {
    const deny = Array.isArray(permissions.deny) ? permissions.deny as string[] : [];
    for (const entry of configDeny) {
      if (!deny.includes(entry)) {
        deny.push(entry);
      }
    }
    permissions.deny = deny;
  }
  settings.permissions = permissions;

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
