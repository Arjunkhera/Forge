import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { stringify as toYaml } from 'yaml';
import { ForgeCore } from './core.js';

describe('ForgeCore — integration', () => {
  let tmpDir: string;
  let forge: ForgeCore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-core-test-'));
    forge = new ForgeCore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function createRegistrySkill(skillId: string) {
    const dir = path.join(tmpDir, 'registry', 'skills', skillId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'metadata.yaml'), toYaml({
      id: skillId, name: `Skill ${skillId}`, version: '1.0.0',
      description: `The ${skillId} skill`, type: 'skill', tags: [], dependencies: {}, files: []
    }));
    await fs.writeFile(path.join(dir, 'SKILL.md'), `# ${skillId}\nThis is the ${skillId} skill.`);
  }

  describe('init → add → install pipeline', () => {
    it('initializes workspace successfully', async () => {
      await forge.init('test-workspace');
      const config = await forge.getConfig();
      expect(config.name).toBe('test-workspace');
    });

    it('install → verify files on disk after full pipeline', async () => {
      await forge.init('test-workspace');
      await createRegistrySkill('developer');

      // Manually add skill to config
      const config = await forge.getConfig();
      config.artifacts.skills['developer'] = '1.0.0';
      const wm = (forge as any).workspaceManager;
      await wm.writeConfig(config);

      const report = await forge.install();
      expect(report.installed).toHaveLength(1);
      expect(report.installed[0]!.id).toBe('developer');

      // Verify file written to disk
      const skillFile = path.join(tmpDir, '.claude', 'skills', 'developer', 'SKILL.md');
      const exists = await fs.access(skillFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      const content = await fs.readFile(skillFile, 'utf-8');
      expect(content).toContain('developer');
    });

    it('dry run does not write files', async () => {
      await forge.init('test-workspace');
      await createRegistrySkill('developer');

      const config = await forge.getConfig();
      config.artifacts.skills['developer'] = '1.0.0';
      const wm = (forge as any).workspaceManager;
      await wm.writeConfig(config);

      const report = await forge.install({ dryRun: true });
      expect(report.filesWritten).toHaveLength(1);
      // File should NOT actually exist
      const skillFile = path.join(tmpDir, '.claude', 'skills', 'developer', 'SKILL.md');
      const exists = await fs.access(skillFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('list()', () => {
    it('returns empty list when nothing installed', async () => {
      await forge.init('test-workspace');
      const installed = await forge.list('installed');
      expect(installed).toHaveLength(0);
    });
  });

  describe('remove()', () => {
    it('removes artifact from config', async () => {
      await forge.init('test-workspace');
      const config = await forge.getConfig();
      config.artifacts.skills['developer'] = '1.0.0';
      const wm = (forge as any).workspaceManager;
      await wm.writeConfig(config);

      await forge.remove('skill:developer');
      const updated = await forge.getConfig();
      expect(updated.artifacts.skills['developer']).toBeUndefined();
    });
  });

  describe('parseRef()', () => {
    it('parses type:id@version', () => {
      const parse = (forge as any).parseRef.bind(forge);
      expect(parse('skill:developer@1.0.0')).toEqual({ type: 'skill', id: 'developer', version: '1.0.0' });
    });

    it('parses agent:id', () => {
      const parse = (forge as any).parseRef.bind(forge);
      expect(parse('agent:my-agent')).toEqual({ type: 'agent', id: 'my-agent', version: '*' });
    });

    it('parses bare id as skill', () => {
      const parse = (forge as any).parseRef.bind(forge);
      expect(parse('developer')).toEqual({ type: 'skill', id: 'developer', version: '*' });
    });
  });
});
