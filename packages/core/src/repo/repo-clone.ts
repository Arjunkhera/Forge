import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface RepoCloneOptions {
  localPath: string;       // source repo — used as --reference for speed
  remoteUrl: string | null; // remote URL to fetch from; null → local-only clone
  destPath: string;        // destination path for the new clone
  branchName?: string;     // feature branch to create (optional)
  defaultBranch: string;   // base branch (e.g. 'main', 'master')
}

export interface RepoCloneResult {
  repoName: string;
  clonePath: string;
  hostClonePath: string;
  branch: string;
  origin: string;
}

export class RepoCloneError extends Error {
  constructor(message: string, public readonly suggestion?: string) {
    super(message);
    this.name = 'RepoCloneError';
    Object.setPrototypeOf(this, RepoCloneError.prototype);
  }
}

/**
 * Create an isolated reference clone of a repository.
 *
 * Uses `git clone --reference <localPath>` to reuse local objects for speed
 * while fetching from remoteUrl for freshness. Falls back to a plain local
 * clone when remoteUrl is null or unreachable (e.g. Docker without SSH).
 *
 * When branchName is provided, creates and checks out that branch.
 * When omitted, the clone stays on the default branch.
 */
export async function createReferenceClone(opts: RepoCloneOptions): Promise<void> {
  const runGit = async (args: string[], cwd: string): Promise<string> => {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 60000 });
    return stdout.trim();
  };

  const checkoutBranch = async (base: string): Promise<void> => {
    if (!opts.branchName) return;
    try {
      await runGit(['checkout', '-b', opts.branchName, base], opts.destPath);
    } catch (err: any) {
      if ((err.message || '').includes('already exists')) {
        await runGit(['checkout', opts.branchName], opts.destPath);
      } else {
        throw err;
      }
    }
  };

  const cloneLocalOnly = async (): Promise<void> => {
    await runGit(['clone', opts.localPath, opts.destPath], path.dirname(opts.destPath));
    await checkoutBranch(opts.defaultBranch);
  };

  if (!opts.remoteUrl) {
    try {
      await cloneLocalOnly();
    } catch (err: any) {
      throw new RepoCloneError(
        `Failed to clone ${opts.localPath} to ${opts.destPath}: ${err.message}`,
        'Check that the local repo path is valid',
      );
    }
    return;
  }

  // Try reference clone from remote first
  try {
    await runGit(
      ['clone', '--reference', opts.localPath, opts.remoteUrl, opts.destPath],
      path.dirname(opts.destPath),
    );
    await checkoutBranch(`origin/${opts.defaultBranch}`);
    return;
  } catch {
    // Remote clone failed — fall back to local-only
  }

  // Local-only fallback (e.g. Docker without SSH/network access)
  try {
    await fs.rm(opts.destPath, { recursive: true, force: true }).catch(() => {});
    await cloneLocalOnly();
  } catch (err: any) {
    throw new RepoCloneError(
      `Failed to clone ${opts.localPath} to ${opts.destPath}: ${err.message}`,
      'Check that the local repo path is valid',
    );
  }

  // Fix origin: local-only fallback sets origin to localPath (Docker-internal).
  // Repoint to remoteUrl so git push works from the host.
  await runGit(['remote', 'set-url', 'origin', opts.remoteUrl], opts.destPath);
}
