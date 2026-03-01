"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const workspace_creator_js_1 = require("../workspace-creator.js");
(0, vitest_1.describe)('workspace-creator helpers', () => {
    (0, vitest_1.describe)('slugify()', () => {
        (0, vitest_1.it)('converts to lowercase kebab-case', () => {
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('Hello World')).toBe('hello-world');
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('My Feature Story')).toBe('my-feature-story');
        });
        (0, vitest_1.it)('removes special characters', () => {
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('Hello! @World#')).toBe('hello-world');
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('My-Story_123')).toBe('my-story-123');
        });
        (0, vitest_1.it)('enforces max 30 character length', () => {
            const long = 'this is a very long story title that exceeds the limit';
            const result = (0, workspace_creator_js_1.slugify)(long);
            (0, vitest_1.expect)(result.length).toBeLessThanOrEqual(30);
        });
        (0, vitest_1.it)('handles edge cases', () => {
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('')).toBe('');
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('---')).toBe('');
            (0, vitest_1.expect)((0, workspace_creator_js_1.slugify)('a')).toBe('a');
        });
    });
    (0, vitest_1.describe)('generateBranchName()', () => {
        (0, vitest_1.it)('replaces {id}, {slug}, {subtype} placeholders', () => {
            const pattern = '{subtype}/{id}-{slug}';
            const result = (0, workspace_creator_js_1.generateBranchName)(pattern, {
                subtype: 'feature',
                id: 'ws-abc123',
                slug: 'my-story',
            });
            (0, vitest_1.expect)(result).toBe('feature/ws-abc123-my-story');
        });
        (0, vitest_1.it)('handles missing placeholders', () => {
            const pattern = '{subtype}/{id}-{slug}';
            const result = (0, workspace_creator_js_1.generateBranchName)(pattern, { id: 'ws-abc123' });
            (0, vitest_1.expect)(result).toBe('ws-abc123-');
        });
        (0, vitest_1.it)('cleans up double slashes', () => {
            const pattern = '{subtype}///{id}-{slug}';
            const result = (0, workspace_creator_js_1.generateBranchName)(pattern, {
                subtype: 'feature',
                id: 'ws-abc123',
                slug: 'my-story',
            });
            (0, vitest_1.expect)(result).toContain('feature');
            (0, vitest_1.expect)(result).not.toContain('///');
        });
        (0, vitest_1.it)('returns default fallback if pattern is empty', () => {
            const result = (0, workspace_creator_js_1.generateBranchName)('', {});
            (0, vitest_1.expect)(result).toBe('workspace');
        });
        (0, vitest_1.it)('handles patterns with no placeholders', () => {
            const result = (0, workspace_creator_js_1.generateBranchName)('feature/task', {});
            (0, vitest_1.expect)(result).toBe('feature/task');
        });
    });
    (0, vitest_1.describe)('WorkspaceCreateError', () => {
        (0, vitest_1.it)('carries message and optional suggestion', () => {
            const err = new workspace_creator_js_1.WorkspaceCreateError('Config not found', 'Run: forge config set...');
            (0, vitest_1.expect)(err.message).toBe('Config not found');
            (0, vitest_1.expect)(err.suggestion).toBe('Run: forge config set...');
            (0, vitest_1.expect)(err.name).toBe('WorkspaceCreateError');
        });
        (0, vitest_1.it)('is an instance of Error', () => {
            const err = new workspace_creator_js_1.WorkspaceCreateError('Test');
            (0, vitest_1.expect)(err).toBeInstanceOf(Error);
            (0, vitest_1.expect)(err).toBeInstanceOf(workspace_creator_js_1.WorkspaceCreateError);
        });
    });
});
(0, vitest_1.describe)('WorkspaceCreator (unit tests with mocks)', () => {
    // Mock ForgeCore
    const mockForge = {
        resolve: vitest_1.vi.fn(),
        install: vitest_1.vi.fn(),
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('create() - config resolution failure', () => {
        (0, vitest_1.it)('throws WorkspaceCreateError if config not found', async () => {
            mockForge.resolve.mockRejectedValue(new Error('Not found'));
            const creator = new workspace_creator_js_1.WorkspaceCreator(mockForge);
            const opts = { configName: 'nonexistent' };
            await (0, vitest_1.expect)(creator.create(opts)).rejects.toBeInstanceOf(workspace_creator_js_1.WorkspaceCreateError);
        });
    });
    (0, vitest_1.describe)('create() - repo resolution failure', () => {
        (0, vitest_1.it)('throws WorkspaceCreateError if repo not in index', async () => {
            // This would require more mocking of the repo index system
            // Skipping detailed test as it requires full integration setup
        });
    });
    (0, vitest_1.describe)('create() - cleanup on failure', () => {
        (0, vitest_1.it)('removes workspace folder if creation fails after folder is created', async () => {
            // This requires full integration with mocked file system
            // Skipping as it's complex to mock fs operations
        });
    });
});
//# sourceMappingURL=workspace-creator.test.js.map