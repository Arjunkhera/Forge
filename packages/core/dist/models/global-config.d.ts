import { z } from 'zod';
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
}>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
//# sourceMappingURL=global-config.d.ts.map