import { z } from 'zod';
/**
 * Workspace settings section.
 */
export declare const WorkspaceSettingsSchema: z.ZodObject<{
    mount_path: z.ZodDefault<z.ZodString>;
    default_config: z.ZodDefault<z.ZodString>;
    retention_days: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    retention_days: number;
    mount_path: string;
    default_config: string;
}, {
    retention_days?: number | undefined;
    mount_path?: string | undefined;
    default_config?: string | undefined;
}>;
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
/**
 * MCP endpoint entry.
 */
export declare const McpEndpointSchema: z.ZodObject<{
    url: z.ZodString;
    transport: z.ZodDefault<z.ZodEnum<["http", "stdio"]>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    transport: "http" | "stdio";
}, {
    url: string;
    transport?: "http" | "stdio" | undefined;
}>;
export type McpEndpoint = z.infer<typeof McpEndpointSchema>;
/**
 * MCP endpoints section (maps endpoint names to their configurations).
 */
export declare const McpEndpointsSchema: z.ZodObject<{
    anvil: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        transport: z.ZodDefault<z.ZodEnum<["http", "stdio"]>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        transport: "http" | "stdio";
    }, {
        url: string;
        transport?: "http" | "stdio" | undefined;
    }>>;
    vault: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        transport: z.ZodDefault<z.ZodEnum<["http", "stdio"]>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        transport: "http" | "stdio";
    }, {
        url: string;
        transport?: "http" | "stdio" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    anvil?: {
        url: string;
        transport: "http" | "stdio";
    } | undefined;
    vault?: {
        url: string;
        transport: "http" | "stdio";
    } | undefined;
}, {
    anvil?: {
        url: string;
        transport?: "http" | "stdio" | undefined;
    } | undefined;
    vault?: {
        url: string;
        transport?: "http" | "stdio" | undefined;
    } | undefined;
}>;
export type McpEndpoints = z.infer<typeof McpEndpointsSchema>;
/**
 * Repository configuration section.
 */
export declare const ReposConfigSchema: z.ZodObject<{
    scan_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    index_path: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    scan_paths: string[];
    index_path: string;
}, {
    scan_paths?: string[] | undefined;
    index_path?: string | undefined;
}>;
export type ReposConfig = z.infer<typeof ReposConfigSchema>;
/**
 * Schema for the global Forge configuration (~/.forge/config.yaml).
 *
 * Global registries act as fallbacks — workspace-local registries
 * take priority, and global registries are appended as lower-priority
 * sources.
 *
 * @example
 * # ~/.forge/config.yaml
 * registries:
 *   - type: git
 *     name: team-registry
 *     url: https://github.com/myorg/forge-registry.git
 *     branch: main
 *     path: registry
 *
 * workspace:
 *   mount_path: ~/workspaces
 *   default_config: sdlc-default
 *   retention_days: 30
 *
 * mcp_endpoints:
 *   anvil:
 *     url: http://localhost:3002
 *     transport: http
 *   vault:
 *     url: http://localhost:8000
 *     transport: http
 *
 * repos:
 *   scan_paths:
 *     - ~/Repositories
 *     - ~/Projects
 *   index_path: ~/.forge/repos.json
 */
export declare const GlobalConfigSchema: z.ZodObject<{
    registries: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"filesystem">;
        name: z.ZodString;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "filesystem";
        path: string;
    }, {
        name: string;
        type: "filesystem";
        path: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"git">;
        name: z.ZodString;
        url: z.ZodString;
        branch: z.ZodDefault<z.ZodString>;
        path: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "git";
        path: string;
        url: string;
        branch: string;
    }, {
        name: string;
        type: "git";
        url: string;
        path?: string | undefined;
        branch?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        name: z.ZodString;
        url: z.ZodString;
        token: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "http";
        url: string;
        token?: string | undefined;
    }, {
        name: string;
        type: "http";
        url: string;
        token?: string | undefined;
    }>]>, "many">>;
    workspace: z.ZodDefault<z.ZodObject<{
        mount_path: z.ZodDefault<z.ZodString>;
        default_config: z.ZodDefault<z.ZodString>;
        retention_days: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        retention_days: number;
        mount_path: string;
        default_config: string;
    }, {
        retention_days?: number | undefined;
        mount_path?: string | undefined;
        default_config?: string | undefined;
    }>>;
    mcp_endpoints: z.ZodDefault<z.ZodObject<{
        anvil: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            transport: z.ZodDefault<z.ZodEnum<["http", "stdio"]>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            transport: "http" | "stdio";
        }, {
            url: string;
            transport?: "http" | "stdio" | undefined;
        }>>;
        vault: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            transport: z.ZodDefault<z.ZodEnum<["http", "stdio"]>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            transport: "http" | "stdio";
        }, {
            url: string;
            transport?: "http" | "stdio" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        anvil?: {
            url: string;
            transport: "http" | "stdio";
        } | undefined;
        vault?: {
            url: string;
            transport: "http" | "stdio";
        } | undefined;
    }, {
        anvil?: {
            url: string;
            transport?: "http" | "stdio" | undefined;
        } | undefined;
        vault?: {
            url: string;
            transport?: "http" | "stdio" | undefined;
        } | undefined;
    }>>;
    repos: z.ZodDefault<z.ZodObject<{
        scan_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        index_path: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        scan_paths: string[];
        index_path: string;
    }, {
        scan_paths?: string[] | undefined;
        index_path?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    registries: ({
        name: string;
        type: "filesystem";
        path: string;
    } | {
        name: string;
        type: "git";
        path: string;
        url: string;
        branch: string;
    } | {
        name: string;
        type: "http";
        url: string;
        token?: string | undefined;
    })[];
    workspace: {
        retention_days: number;
        mount_path: string;
        default_config: string;
    };
    mcp_endpoints: {
        anvil?: {
            url: string;
            transport: "http" | "stdio";
        } | undefined;
        vault?: {
            url: string;
            transport: "http" | "stdio";
        } | undefined;
    };
    repos: {
        scan_paths: string[];
        index_path: string;
    };
}, {
    registries?: ({
        name: string;
        type: "filesystem";
        path: string;
    } | {
        name: string;
        type: "git";
        url: string;
        path?: string | undefined;
        branch?: string | undefined;
    } | {
        name: string;
        type: "http";
        url: string;
        token?: string | undefined;
    })[] | undefined;
    workspace?: {
        retention_days?: number | undefined;
        mount_path?: string | undefined;
        default_config?: string | undefined;
    } | undefined;
    mcp_endpoints?: {
        anvil?: {
            url: string;
            transport?: "http" | "stdio" | undefined;
        } | undefined;
        vault?: {
            url: string;
            transport?: "http" | "stdio" | undefined;
        } | undefined;
    } | undefined;
    repos?: {
        scan_paths?: string[] | undefined;
        index_path?: string | undefined;
    } | undefined;
}>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
//# sourceMappingURL=global-config.d.ts.map