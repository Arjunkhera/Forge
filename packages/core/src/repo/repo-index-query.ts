import type { RepoIndexEntry } from '../models/repo-index.js';
import { normalizeGitUrl } from './url-utils.js';

export class RepoIndexQuery {
  constructor(private readonly repos: RepoIndexEntry[]) {}

  findByName(name: string): RepoIndexEntry | null {
    return this.repos.find(r => r.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  findByRemoteUrl(url: string): RepoIndexEntry | null {
    const normalized = normalizeGitUrl(url);
    return this.repos.find(r => r.remoteUrl && normalizeGitUrl(r.remoteUrl) === normalized) ?? null;
  }

  search(query: string): RepoIndexEntry[] {
    const q = query.toLowerCase();
    return this.repos
      .filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.localPath.toLowerCase().includes(q) ||
        (r.remoteUrl?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listAll(): RepoIndexEntry[] {
    return [...this.repos].sort((a, b) => a.name.localeCompare(b.name));
  }

  getByPath(localPath: string): RepoIndexEntry | null {
    return this.repos.find(r => r.localPath === localPath) ?? null;
  }
}
