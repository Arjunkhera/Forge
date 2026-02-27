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
export declare function startMcpServer(workspaceRoot?: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map