import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { ForgeCore } from '@forge/core';
import { WorkspaceMetadataStore } from '@forge/core';

/**
 * Start the Forge MCP server.
 * Exposes ForgeCore operations as MCP tools for LLM consumption.
 *
 * Tools:
 *   forge_search  - Search registry for artifacts
 *   forge_add     - Add artifact to forge.yaml
 *   forge_install - Run full install pipeline
 *   forge_resolve - Resolve a single artifact ref
 *   forge_list    - List installed or available artifacts
 *   forge_workspace_create - Create a new workspace from config
 *   forge_workspace_list - List tracked workspaces
 *   forge_workspace_delete - Delete a workspace by ID
 *   forge_workspace_status - Get full details for a workspace
 */
export async function startMcpServer(workspaceRoot: string = process.cwd()): Promise<void> {
  const forge = new ForgeCore(workspaceRoot);

  const server = new Server(
    { name: 'forge-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'forge_search',
        description:
          'Search the Forge registry for skills, agents, or plugins. Use this to discover what artifacts are available before installing them.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query (e.g., "developer", "testing")' },
            type: {
              type: 'string',
              enum: ['skill', 'agent', 'plugin'],
              description: 'Filter by artifact type (optional)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'forge_add',
        description:
          'Add one or more artifact refs to forge.yaml. Use after searching to add an artifact to the workspace configuration.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            refs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Artifact refs to add, e.g., ["skill:developer@1.0.0", "agent:sdlc-agent"]',
            },
          },
          required: ['refs'],
        },
      },
      {
        name: 'forge_install',
        description:
          'Run the full install pipeline: resolve all artifacts from forge.yaml and emit them to the workspace. Call this after forge_add.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            target: {
              type: 'string',
              enum: ['claude-code', 'cursor', 'plugin'],
              description: 'Compile target (default: claude-code)',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview changes without writing files',
            },
          },
        },
      },
      {
        name: 'forge_resolve',
        description:
          'Resolve a single artifact reference and return its metadata and dependencies. Useful for inspecting an artifact before installing.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            ref: {
              type: 'string',
              description: 'Artifact ref, e.g., "skill:developer@1.0.0"',
            },
          },
          required: ['ref'],
        },
      },
      {
        name: 'forge_list',
        description:
          'List artifacts. Use scope="installed" to see what\'s currently installed, or scope="available" to see what\'s in the registry.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            scope: {
              type: 'string',
              enum: ['installed', 'available'],
              description: 'Which artifacts to list',
            },
          },
        },
      },
      {
        name: 'forge_workspace_create',
        description: 'Create a new workspace from a workspace config. Installs plugins, creates git worktrees, and emits MCP configs and environment variables.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            config: { type: 'string', description: 'Workspace config artifact name (e.g., "sdlc-default")' },
            configVersion: { type: 'string', description: 'Version constraint (default: latest)' },
            storyId: { type: 'string', description: 'Anvil work item ID to link to this workspace' },
            storyTitle: { type: 'string', description: 'Cached story title for display' },
            repos: { type: 'array', items: { type: 'string' }, description: 'Specific repo names to include' },
          },
          required: ['config'],
        },
      },
      {
        name: 'forge_workspace_list',
        description: 'List tracked workspaces with optional status or story filter.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            status: { type: 'string', enum: ['active', 'paused', 'completed', 'archived'], description: 'Filter by workspace status' },
            storyId: { type: 'string', description: 'Filter by linked story ID' },
          },
        },
      },
      {
        name: 'forge_workspace_delete',
        description: 'Delete a workspace by ID. Removes git worktrees and workspace folder from disk.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Workspace ID (e.g., "ws-abc12345")' },
            force: { type: 'boolean', description: 'Force delete even if uncommitted changes exist' },
          },
          required: ['id'],
        },
      },
      {
        name: 'forge_workspace_status',
        description: 'Get full details for a single workspace by ID.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Workspace ID' },
          },
          required: ['id'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'forge_search': {
          const { query, type } = args as { query: string; type?: 'skill' | 'agent' | 'plugin' };
          const results = await forge.search(query, type);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(results.map(r => ({
                type: r.ref.type,
                id: r.ref.id,
                version: r.ref.version,
                name: r.meta.name,
                description: r.meta.description,
                tags: r.meta.tags,
                score: r.score,
                matchedOn: r.matchedOn,
              })), null, 2),
            }],
          };
        }

        case 'forge_add': {
          const { refs } = args as { refs: string[] };
          const config = await forge.add(refs);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                added: refs,
                config: {
                  skills: Object.keys(config.artifacts.skills),
                  agents: Object.keys(config.artifacts.agents),
                  plugins: Object.keys(config.artifacts.plugins),
                },
              }, null, 2),
            }],
          };
        }

        case 'forge_install': {
          const { target, dryRun } = (args ?? {}) as { target?: string; dryRun?: boolean };
          const report = await forge.install({ target: target as any, dryRun });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                installed: report.installed.map(r => `${r.type}:${r.id}@${r.version}`),
                filesWritten: report.filesWritten,
                conflicts: report.conflicts.length,
                duration: `${report.duration}ms`,
                dryRun: dryRun ?? false,
              }, null, 2),
            }],
          };
        }

        case 'forge_resolve': {
          const { ref } = args as { ref: string };
          const resolved = await forge.resolve(ref);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                type: resolved.ref.type,
                id: resolved.ref.id,
                version: resolved.bundle.meta.version,
                name: resolved.bundle.meta.name,
                description: resolved.bundle.meta.description,
                dependencies: resolved.dependencies.map(d => `${d.ref.type}:${d.ref.id}`),
              }, null, 2),
            }],
          };
        }

        case 'forge_list': {
          const { scope } = (args ?? {}) as { scope?: 'installed' | 'available' };
          const summaries = await forge.list(scope ?? 'available');
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(summaries.map(s => ({
                type: s.ref.type,
                id: s.ref.id,
                version: s.ref.version,
                name: s.name,
                description: s.description,
                tags: s.tags,
              })), null, 2),
            }],
          };
        }

        case 'forge_workspace_create': {
          const { config, configVersion, storyId, storyTitle, repos } = args as {
            config: string;
            configVersion?: string;
            storyId?: string;
            storyTitle?: string;
            repos?: string[];
          };
          // Placeholder: would call forge.workspaceCreate if available
          // For now, return a stub response
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'forge_workspace_create not yet implemented',
                args: { config, configVersion, storyId, storyTitle, repos },
              }, null, 2),
            }],
          };
        }

        case 'forge_workspace_list': {
          const { status, storyId } = args as { status?: string; storyId?: string };
          const store = new WorkspaceMetadataStore();
          
          if (storyId) {
            const record = await store.findByStoryId(storyId);
            const results = record ? [record] : [];
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
          }
          
          const records = await store.list(status ? { status: status as any } : undefined);
          return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }

        case 'forge_workspace_delete': {
          const { id, force } = args as { id: string; force?: boolean };
          const store = new WorkspaceMetadataStore();
          const record = await store.get(id);
          
          if (!record) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  code: 'WORKSPACE_NOT_FOUND',
                  message: `Workspace '${id}' not found`,
                }, null, 2),
              }],
            };
          }
          
          await store.delete(id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Workspace '${id}' deleted`,
              }, null, 2),
            }],
          };
        }

        case 'forge_workspace_status': {
          const { id } = args as { id: string };
          const store = new WorkspaceMetadataStore();
          const record = await store.get(id);
          
          if (!record) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  code: 'WORKSPACE_NOT_FOUND',
                  message: `Workspace '${id}' not found`,
                }, null, 2),
              }],
            };
          }
          
          return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: err.code ?? 'UNKNOWN_ERROR',
            message: err.message,
            suggestion: err.suggestion,
          }),
        }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Forge MCP] Server started on stdio');
}

// Auto-start if run directly (using dynamic check to avoid import.meta issues with CommonJS)
const isDirectRun = process.argv[1]?.endsWith('/index.js') || process.argv[1]?.endsWith('\\index.js');
if (isDirectRun && typeof require !== 'undefined') {
  startMcpServer(process.cwd()).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
