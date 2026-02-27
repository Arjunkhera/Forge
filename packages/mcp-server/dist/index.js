"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMcpServer = startMcpServer;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const core_1 = require("@forge/core");
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
 */
async function startMcpServer(workspaceRoot = process.cwd()) {
    const forge = new core_1.ForgeCore(workspaceRoot);
    const server = new index_js_1.Server({ name: 'forge-mcp-server', version: '0.1.0' }, { capabilities: { tools: {} } });
    // List available tools
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: 'forge_search',
                description: 'Search the Forge registry for skills, agents, or plugins. Use this to discover what artifacts are available before installing them.',
                inputSchema: {
                    type: 'object',
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
                description: 'Add one or more artifact refs to forge.yaml. Use after searching to add an artifact to the workspace configuration.',
                inputSchema: {
                    type: 'object',
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
                description: 'Run the full install pipeline: resolve all artifacts from forge.yaml and emit them to the workspace. Call this after forge_add.',
                inputSchema: {
                    type: 'object',
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
                description: 'Resolve a single artifact reference and return its metadata and dependencies. Useful for inspecting an artifact before installing.',
                inputSchema: {
                    type: 'object',
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
                description: 'List artifacts. Use scope="installed" to see what\'s currently installed, or scope="available" to see what\'s in the registry.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        scope: {
                            type: 'string',
                            enum: ['installed', 'available'],
                            description: 'Which artifacts to list',
                        },
                    },
                },
            },
        ],
    }));
    // Handle tool calls
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'forge_search': {
                    const { query, type } = args;
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
                    const { refs } = args;
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
                    const { target, dryRun } = (args ?? {});
                    const report = await forge.install({ target: target, dryRun });
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
                    const { ref } = args;
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
                    const { scope } = (args ?? {});
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
                default:
                    return {
                        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                        isError: true,
                    };
            }
        }
        catch (err) {
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
    const transport = new stdio_js_1.StdioServerTransport();
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
//# sourceMappingURL=index.js.map