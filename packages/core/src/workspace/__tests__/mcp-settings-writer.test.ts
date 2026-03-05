import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { updateClaudeMcpServers } from '../mcp-settings-writer.js';

describe('updateClaudeMcpServers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-mcp-settings-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates settings.local.json with mcpServers and default mcp__* permission', async () => {
    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
    );

    const raw = await fs.readFile(
      path.join(tmpDir, '.claude', 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(settings.mcpServers.anvil).toEqual({
      type: 'http',
      url: 'http://localhost:8100/mcp',
    });
    expect(settings.permissions.allow).toContain('mcp__*');
  });

  it('preserves existing mcpServers entries', async () => {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.writeFile(
      path.join(settingsDir, 'settings.local.json'),
      JSON.stringify({
        mcpServers: { existing: { type: 'http', url: 'http://localhost:9999/mcp' } },
      }),
    );

    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
    );

    const raw = await fs.readFile(
      path.join(settingsDir, 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(settings.mcpServers.existing.url).toBe('http://localhost:9999/mcp');
    expect(settings.mcpServers.anvil.url).toBe('http://localhost:8100/mcp');
  });

  it('preserves existing permissions and adds defaults if missing', async () => {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.writeFile(
      path.join(settingsDir, 'settings.local.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(*)'], deny: ['Bash(rm *)'] },
      }),
    );

    await updateClaudeMcpServers(
      [{ name: 'vault', url: 'http://localhost:8300' }],
      tmpDir,
    );

    const raw = await fs.readFile(
      path.join(settingsDir, 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(settings.permissions.allow).toContain('Bash(*)');
    expect(settings.permissions.allow).toContain('mcp__*');
    expect(settings.permissions.deny).toEqual(['Bash(rm *)']);
  });

  it('does not duplicate entries if already present', async () => {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.writeFile(
      path.join(settingsDir, 'settings.local.json'),
      JSON.stringify({
        permissions: { allow: ['mcp__*'] },
      }),
    );

    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
    );

    const raw = await fs.readFile(
      path.join(settingsDir, 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    const count = settings.permissions.allow.filter((x: string) => x === 'mcp__*').length;
    expect(count).toBe(1);
  });

  it('skips writing when server list is empty', async () => {
    await updateClaudeMcpServers([], tmpDir);

    const exists = await fs.access(path.join(tmpDir, '.claude', 'settings.local.json'))
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(false);
  });

  it('writes multiple servers in a single call', async () => {
    await updateClaudeMcpServers(
      [
        { name: 'anvil', url: 'http://localhost:8100' },
        { name: 'vault', url: 'http://localhost:8300' },
        { name: 'forge', url: 'http://localhost:8200' },
      ],
      tmpDir,
    );

    const raw = await fs.readFile(
      path.join(tmpDir, '.claude', 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(Object.keys(settings.mcpServers)).toEqual(['anvil', 'vault', 'forge']);
    expect(settings.permissions.allow).toContain('mcp__*');
  });

  it('applies full claude_permissions from config (allow + deny)', async () => {
    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
      undefined,
      {
        allow: ['Bash(*)', 'Edit(*)', 'Write(*)', 'Read(*)', 'mcp__*'],
        deny: ['Bash(rm *)', 'Bash(rmdir *)'],
      },
    );

    const raw = await fs.readFile(
      path.join(tmpDir, '.claude', 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(settings.permissions.allow).toEqual(
      expect.arrayContaining(['Bash(*)', 'Edit(*)', 'Write(*)', 'Read(*)', 'mcp__*']),
    );
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(['Bash(rm *)', 'Bash(rmdir *)']),
    );
  });

  it('merges config permissions with existing without duplicates', async () => {
    const settingsDir = path.join(tmpDir, '.claude');
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.writeFile(
      path.join(settingsDir, 'settings.local.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(*)', 'mcp__*'], deny: ['Bash(rm *)'] },
      }),
    );

    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
      undefined,
      {
        allow: ['Bash(*)', 'Edit(*)', 'mcp__*'],
        deny: ['Bash(rm *)', 'Bash(rmdir *)'],
      },
    );

    const raw = await fs.readFile(
      path.join(settingsDir, 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    // No duplicates
    const bashCount = settings.permissions.allow.filter((x: string) => x === 'Bash(*)').length;
    expect(bashCount).toBe(1);
    const mcpCount = settings.permissions.allow.filter((x: string) => x === 'mcp__*').length;
    expect(mcpCount).toBe(1);
    const rmCount = settings.permissions.deny.filter((x: string) => x === 'Bash(rm *)').length;
    expect(rmCount).toBe(1);

    // New entries added
    expect(settings.permissions.allow).toContain('Edit(*)');
    expect(settings.permissions.deny).toContain('Bash(rmdir *)');
  });

  it('uses default mcp__* when no claudePermissions provided', async () => {
    await updateClaudeMcpServers(
      [{ name: 'anvil', url: 'http://localhost:8100' }],
      tmpDir,
      undefined,
      undefined,
    );

    const raw = await fs.readFile(
      path.join(tmpDir, '.claude', 'settings.local.json'),
      'utf-8',
    );
    const settings = JSON.parse(raw);

    expect(settings.permissions.allow).toEqual(['mcp__*']);
    expect(settings.permissions.deny).toBeUndefined();
  });
});
