import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { ForgeCore, type RepoIndexEntry } from '@forge/core';

/**
 * Start the Forge MCP server.
 * Exposes ForgeCore operations as MCP tools for LLM consumption.
 *
 * Tools:
 *   forge_search        - Search registry for artifacts
 *   forge_add           - Add artifact to forge.yaml
 *   forge_install       - Run full install pipeline
 *   forge_resolve       - Resolve a single artifact ref
 *   forge_list          - List installed or available artifacts
 *   forge_repo_list     - List repositories from index
 *   forge_repo_resolve  - Resolve a repository by name or URL
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
        name: 'forge_repo_list',
        description:
          'List repositories from the local index. Filter by query (name, path, or URL) and/or language. Automatically scans if no index exists.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Search query to filter repositories (optional)',
            },
            language: {
              type: 'string',
              description: 'Filter by programming language (optional)',
            },
          },
        },
      },
      {
        name: 'forge_repo_resolve',
        description:
          'Find a specific repository by name or remote URL. Automatically scans if no index exists.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string',
              description: 'Repository name to search for (optional)',
            },
            remoteUrl: {
              type: 'string',
              description: 'Remote URL (https or git@) to match against (optional)',
            },
          },
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

        case 'forge_repo_list': {
          const { query, language } = (args ?? {}) as { query?: string; language?: string };
          let repos = await forge.repoList(query);
          if (language) {
            repos = repos.filter((r: RepoIndexEntry) => r.language?.toLowerCase() === language.toLowerCase());
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(repos.map(r => ({
                name: r.name,
                localPath: r.localPath,
                remoteUrl: r.remoteUrl,
                defaultBranch: r.defaultBranch,
                language: r.language,
                framework: r.framework,
                lastCommitDate: r.lastCommitDate,
                lastScannedAt: r.lastScannedAt,
              })), null, 2),
            }],
          };
        }

        case 'forge_repo_resolve': {
          const { name, remoteUrl } = (args ?? {}) as { name?: string; remoteUrl?: string };
          if (!name && !remoteUrl) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  message: 'Either name or remoteUrl must be provided',
                }),
              }],
              isError: true,
            };
          }
          const entry = await forge.repoResolve({ name, remoteUrl });
          if (!entry) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  code: 'REPO_NOT_FOUND',
                  message: 'Repository not found',
                  suggestion: 'Run: forge repo scan',
                }),
              }],
              isError: true,
            };
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                name: entry.name,
                localPath: entry.localPath,
                remoteUrl: entry.remoteUrl,
                defaultBranch: entry.defaultBranch,
                language: entry.language,
                framework: entry.framework,
                lastCommitDate: entry.lastCommitDate,
                lastScannedAt: entry.lastScannedAt,
              }, null, 2),
            }],
          };
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
