import fs from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ARCHIVE_LIMITS } from '../archive/limits';
import {
  ArchiveDownloadFailedError,
  GitHubRateLimitedError,
  RepositoryNotAccessibleError,
  RepositoryTooLargeError,
  ScanTimeoutError,
} from '../errors';
import type { GitHubRepoIdentity, GitHubRepoMetadata } from './types';

interface DownloadOptions {
  token?: string;
  maxBytes?: number;
  timeoutMs?: number;
}

export class GitHubClient {
  private readonly defaultToken?: string;

  constructor(defaultToken?: string) {
    this.defaultToken = defaultToken || process.env.GITHUB_TOKEN;
  }

  private buildHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeEq-Repository-Scanner/1.0',
    };
    const activeToken = token || this.defaultToken;
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }
    return headers;
  }

  private checkRateLimit(res: Response): boolean {
    if (res.status === 429) return true;
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') return true;
    return false;
  }

  async fetchRepoMetadata(
    identity: GitHubRepoIdentity,
    options?: { token?: string; timeoutMs?: number }
  ): Promise<GitHubRepoMetadata> {
    const url = `https://api.github.com/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repo)}`;
    const timeoutMs = options?.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.buildHeaders(options?.token),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new ScanTimeoutError(`GitHub metadata request timed out after ${timeoutMs}ms`);
      }
      throw new RepositoryNotAccessibleError(
        `Failed to reach GitHub API: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (this.checkRateLimit(res)) {
      throw new GitHubRateLimitedError();
    }

    if (res.status === 404 || res.status === 403 || res.status === 401) {
      // Return generic non-accessible error without leaking if it is private or exists
      throw new RepositoryNotAccessibleError();
    }

    if (!res.ok) {
      throw new RepositoryNotAccessibleError(`GitHub API returned status ${res.status}`);
    }

    const data = (await res.json()) as {
      owner?: { login?: string };
      name?: string;
      default_branch?: string;
      size?: number;
      private?: boolean;
    };

    if (data.private) {
      throw new RepositoryNotAccessibleError();
    }

    if (!data.default_branch || !data.name) {
      throw new RepositoryNotAccessibleError('Incomplete repository metadata returned by GitHub');
    }

    return {
      owner: data.owner?.login || identity.owner,
      name: data.name,
      defaultBranch: data.default_branch,
      sizeKb: data.size || 0,
      isPrivate: false,
    };
  }

  async downloadRepoArchive(
    identity: GitHubRepoIdentity,
    ref: string,
    destTarPath: string,
    options?: DownloadOptions
  ): Promise<{ bytesDownloaded: number }> {
    const url = `https://api.github.com/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repo)}/tarball/${encodeURIComponent(ref)}`;
    const maxBytes = options?.maxBytes ?? ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES;
    const timeoutMs = options?.timeoutMs ?? ARCHIVE_LIMITS.DOWNLOAD_TIMEOUT_MS;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.buildHeaders(options?.token),
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        throw new ScanTimeoutError(`Archive download timed out after ${timeoutMs}ms`);
      }
      throw new ArchiveDownloadFailedError(
        `Network error during archive download: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (this.checkRateLimit(res)) {
      clearTimeout(timeoutId);
      throw new GitHubRateLimitedError();
    }

    if (res.status === 404 || res.status === 403 || res.status === 401) {
      clearTimeout(timeoutId);
      throw new RepositoryNotAccessibleError();
    }

    if (!res.ok) {
      clearTimeout(timeoutId);
      throw new ArchiveDownloadFailedError(`GitHub archive download returned status ${res.status}`);
    }

    // Check Content-Length header if provided
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      const parsedLength = parseInt(contentLength, 10);
      if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
        clearTimeout(timeoutId);
        throw new RepositoryTooLargeError(
          `Repository archive size (${parsedLength} bytes) exceeds limit of ${maxBytes} bytes`
        );
      }
    }

    if (!res.body) {
      clearTimeout(timeoutId);
      throw new ArchiveDownloadFailedError('Empty response body returned for repository archive');
    }

    let bytesDownloaded = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesDownloaded += chunk.length;
        if (bytesDownloaded > maxBytes) {
          callback(
            new RepositoryTooLargeError(
              `Repository archive size exceeded limit of ${maxBytes} bytes during download`
            )
          );
          return;
        }
        callback(null, chunk);
      },
    });

    const fileStream = fs.createWriteStream(destTarPath);
    // Convert Web ReadableStream to Node.js Readable stream
    const nodeReadable = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);

    try {
      await pipeline(nodeReadable, counter, fileStream);
      return { bytesDownloaded };
    } catch (err: unknown) {
      // Clean up partial file on failure
      try {
        if (fs.existsSync(destTarPath)) {
          fs.unlinkSync(destTarPath);
        }
      } catch {
        // Ignore cleanup error
      }

      if (controller.signal.aborted) {
        throw new ScanTimeoutError(`Archive download timed out after ${timeoutMs}ms`);
      }
      if (err instanceof RepositoryTooLargeError) {
        throw err;
      }
      throw new ArchiveDownloadFailedError(
        `Failed to stream repository archive: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
