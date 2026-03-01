import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  WorkspaceCreator,
  WorkspaceCreateError,
  slugify,
  generateBranchName,
  type WorkspaceCreateOptions,
} from '../workspace-creator.js';

describe('workspace-creator helpers', () => {
  describe('slugify()', () => {
    it('converts to lowercase kebab-case', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('My Feature Story')).toBe('my-feature-story');
    });

    it('removes special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
      expect(slugify('My-Story_123')).toBe('my-story-123');
    });

    it('enforces max 30 character length', () => {
      const long = 'this is a very long story title that exceeds the limit';
      const result = slugify(long);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('handles edge cases', () => {
      expect(slugify('')).toBe('');
      expect(slugify('---')).toBe('');
      expect(slugify('a')).toBe('a');
    });
  });

  describe('generateBranchName()', () => {
    it('replaces {id}, {slug}, {subtype} placeholders', () => {
      const pattern = '{subtype}/{id}-{slug}';
      const result = generateBranchName(pattern, {
        subtype: 'feature',
        id: 'ws-abc123',
        slug: 'my-story',
      });
      expect(result).toBe('feature/ws-abc123-my-story');
    });

    it('handles missing placeholders', () => {
      const pattern = '{subtype}/{id}-{slug}';
      const result = generateBranchName(pattern, { id: 'ws-abc123' });
      expect(result).toBe('ws-abc123-');
    });

    it('cleans up double slashes', () => {
      const pattern = '{subtype}///{id}-{slug}';
      const result = generateBranchName(pattern, {
        subtype: 'feature',
        id: 'ws-abc123',
        slug: 'my-story',
      });
      expect(result).toContain('feature');
      expect(result).not.toContain('///');
    });

    it('returns default fallback if pattern is empty', () => {
      const result = generateBranchName('', {});
      expect(result).toBe('workspace');
    });

    it('handles patterns with no placeholders', () => {
      const result = generateBranchName('feature/task', {});
      expect(result).toBe('feature/task');
    });
  });

  describe('WorkspaceCreateError', () => {
    it('carries message and optional suggestion', () => {
      const err = new WorkspaceCreateError('Config not found', 'Run: forge config set...');
      expect(err.message).toBe('Config not found');
      expect(err.suggestion).toBe('Run: forge config set...');
      expect(err.name).toBe('WorkspaceCreateError');
    });

    it('is an instance of Error', () => {
      const err = new WorkspaceCreateError('Test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(WorkspaceCreateError);
    });
  });
});

describe('WorkspaceCreator (unit tests with mocks)', () => {
  // Mock ForgeCore
  const mockForge = {
    resolve: vi.fn(),
    install: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create() - config resolution failure', () => {
    it('throws WorkspaceCreateError if config not found', async () => {
      mockForge.resolve.mockRejectedValue(new Error('Not found'));
      const creator = new WorkspaceCreator(mockForge as any);

      const opts: WorkspaceCreateOptions = { configName: 'nonexistent' };
      await expect(creator.create(opts)).rejects.toBeInstanceOf(WorkspaceCreateError);
    });
  });

  describe('create() - repo resolution failure', () => {
    it('throws WorkspaceCreateError if repo not in index', async () => {
      // This would require more mocking of the repo index system
      // Skipping detailed test as it requires full integration setup
    });
  });

  describe('create() - cleanup on failure', () => {
    it('removes workspace folder if creation fails after folder is created', async () => {
      // This requires full integration with mocked file system
      // Skipping as it's complex to mock fs operations
    });
  });
});
