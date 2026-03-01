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
 *   forge_workspace_create - Create a new workspace from config
 *   forge_workspace_list - List tracked workspaces
 *   forge_workspace_delete - Delete a workspace by ID
 *   forge_workspace_status - Get full details for a workspace
 */
export declare function startMcpServer(workspaceRoot?: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map