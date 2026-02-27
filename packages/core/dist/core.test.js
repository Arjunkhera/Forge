"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const yaml_1 = require("yaml");
const core_js_1 = require("./core.js");
(0, vitest_1.describe)('ForgeCore — integration', () => {
    let tmpDir;
    let forge;
    (0, vitest_1.beforeEach)(async () => {
        tmpDir = await fs_1.promises.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'forge-core-test-'));
        forge = new core_js_1.ForgeCore(tmpDir);
    });
    (0, vitest_1.afterEach)(async () => {
        await fs_1.promises.rm(tmpDir, { recursive: true, force: true });
    });
    async function createRegistrySkill(skillId) {
        const dir = path_1.default.join(tmpDir, 'registry', 'skills', skillId);
        await fs_1.promises.mkdir(dir, { recursive: true });
        await fs_1.promises.writeFile(path_1.default.join(dir, 'metadata.yaml'), (0, yaml_1.stringify)({
            id: skillId, name: `Skill ${skillId}`, version: '1.0.0',
            description: `The ${skillId} skill`, type: 'skill', tags: [], dependencies: {}, files: []
        }));
        await fs_1.promises.writeFile(path_1.default.join(dir, 'SKILL.md'), `# ${skillId}\nThis is the ${skillId} skill.`);
    }
    (0, vitest_1.describe)('init → add → install pipeline', () => {
        (0, vitest_1.it)('initializes workspace successfully', async () => {
            await forge.init('test-workspace');
            const config = await forge.getConfig();
            (0, vitest_1.expect)(config.name).toBe('test-workspace');
        });
        (0, vitest_1.it)('install → verify files on disk after full pipeline', async () => {
            await forge.init('test-workspace');
            await createRegistrySkill('developer');
            // Manually add skill to config
            const config = await forge.getConfig();
            config.artifacts.skills['developer'] = '1.0.0';
            const wm = forge.workspaceManager;
            await wm.writeConfig(config);
            const report = await forge.install();
            (0, vitest_1.expect)(report.installed).toHaveLength(1);
            (0, vitest_1.expect)(report.installed[0].id).toBe('developer');
            // Verify file written to disk
            const skillFile = path_1.default.join(tmpDir, '.claude', 'skills', 'developer', 'SKILL.md');
            const exists = await fs_1.promises.access(skillFile).then(() => true).catch(() => false);
            (0, vitest_1.expect)(exists).toBe(true);
            const content = await fs_1.promises.readFile(skillFile, 'utf-8');
            (0, vitest_1.expect)(content).toContain('developer');
        });
        (0, vitest_1.it)('dry run does not write files', async () => {
            await forge.init('test-workspace');
            await createRegistrySkill('developer');
            const config = await forge.getConfig();
            config.artifacts.skills['developer'] = '1.0.0';
            const wm = forge.workspaceManager;
            await wm.writeConfig(config);
            const report = await forge.install({ dryRun: true });
            (0, vitest_1.expect)(report.filesWritten).toHaveLength(1);
            // File should NOT actually exist
            const skillFile = path_1.default.join(tmpDir, '.claude', 'skills', 'developer', 'SKILL.md');
            const exists = await fs_1.promises.access(skillFile).then(() => true).catch(() => false);
            (0, vitest_1.expect)(exists).toBe(false);
        });
    });
    (0, vitest_1.describe)('list()', () => {
        (0, vitest_1.it)('returns empty list when nothing installed', async () => {
            await forge.init('test-workspace');
            const installed = await forge.list('installed');
            (0, vitest_1.expect)(installed).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('remove()', () => {
        (0, vitest_1.it)('removes artifact from config', async () => {
            await forge.init('test-workspace');
            const config = await forge.getConfig();
            config.artifacts.skills['developer'] = '1.0.0';
            const wm = forge.workspaceManager;
            await wm.writeConfig(config);
            await forge.remove('skill:developer');
            const updated = await forge.getConfig();
            (0, vitest_1.expect)(updated.artifacts.skills['developer']).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('parseRef()', () => {
        (0, vitest_1.it)('parses type:id@version', () => {
            const parse = forge.parseRef.bind(forge);
            (0, vitest_1.expect)(parse('skill:developer@1.0.0')).toEqual({ type: 'skill', id: 'developer', version: '1.0.0' });
        });
        (0, vitest_1.it)('parses agent:id', () => {
            const parse = forge.parseRef.bind(forge);
            (0, vitest_1.expect)(parse('agent:my-agent')).toEqual({ type: 'agent', id: 'my-agent', version: '*' });
        });
        (0, vitest_1.it)('parses bare id as skill', () => {
            const parse = forge.parseRef.bind(forge);
            (0, vitest_1.expect)(parse('developer')).toEqual({ type: 'skill', id: 'developer', version: '*' });
        });
    });
});
//# sourceMappingURL=core.test.js.map