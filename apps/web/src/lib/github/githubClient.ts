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
  signal?: AbortSignal;
}

interface AbortScope {
  controller: AbortController;
  dispose: () => void;
  timedOut: () => boolean;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

export class GitHubClient {
  private readonly defaultToken?: string;

  constructor(defaultToken?: string) {
    this.defaultToken = defaultToken || process.env.GITHUB_TOKEN;
  }

  private buildHeaders(destination: URL, token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeEq-Repository-Scanner/1.0',
    };
    const activeToken = token || this.defaultToken;
    if (activeToken && destination.hostname === 'api.github.com') {
      headers.Authorization = `Bearer ${activeToken}`;
    }
    return headers;
  }

  private createAbortScope(externalSignal: AbortSignal | undefined, timeoutMs: number): AbortScope {
    const controller = new AbortController();
    let didTimeout = false;
    const forwardAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) {
      forwardAbort();
    } else {
      externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    }
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    return {
      controller,
      timedOut: () => didTimeout,
      dispose: () => {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', forwardAbort);
      },
    };
  }

  private abortError(scope: AbortScope, timeoutMessage: string): Error {
    if (scope.timedOut()) return new ScanTimeoutError(timeoutMessage);
    const reason = scope.controller.signal.reason;
    return reason instanceof Error ? reason : new ScanTimeoutError(timeoutMessage);
  }

  private async fetchWithRedirectPolicy(
    initialUrl: string,
    options: {
      allowedHosts: ReadonlySet<string>;
      signal: AbortSignal;
      token?: string;
      redirectError: () => Error;
    },
  ): Promise<Response> {
    let currentUrl = new URL(initialUrl);

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      if (currentUrl.protocol !== 'https:' || !options.allowedHosts.has(currentUrl.hostname)) {
        throw options.redirectError();
      }

      const response = await fetch(currentUrl, {
        headers: this.buildHeaders(currentUrl, options.token),
        signal: options.signal,
        redirect: 'manual',
      });

      if (!REDIRECT_STATUSES.has(response.status)) return response;
      if (redirects === MAX_REDIRECTS) throw options.redirectError();

      const location = response.headers.get('location');
      if (!location) throw options.redirectError();
      currentUrl = new URL(location, currentUrl);
    }

    throw options.redirectError();
  }

  private checkRateLimit(res: Response): boolean {
    if (res.status === 429) return true;
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') return true;
    return false;
  }

  async fetchRepoMetadata(
    identity: GitHubRepoIdentity,
    options?: { token?: string; timeoutMs?: number; signal?: AbortSignal }
  ): Promise<GitHubRepoMetadata> {
    const url = `https://api.github.com/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repo)}`;
    const timeoutMs = options?.timeoutMs ?? 10_000;
    const abortScope = this.createAbortScope(options?.signal, timeoutMs);

    let res: Response;
    try {
      res = await this.fetchWithRedirectPolicy(url, {
        allowedHosts: new Set(['api.github.com']),
        signal: abortScope.controller.signal,
        token: options?.token,
        redirectError: () => new RepositoryNotAccessibleError(),
      });
    } catch (err: unknown) {
      if (abortScope.controller.signal.aborted) {
        throw this.abortError(abortScope, `GitHub metadata request timed out after ${timeoutMs}ms`);
      }
      if (err instanceof RepositoryNotAccessibleError) throw err;
      throw new RepositoryNotAccessibleError(
        `Failed to reach GitHub API: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      abortScope.dispose();
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

    const abortScope = this.createAbortScope(options?.signal, timeoutMs);

    let res: Response;
    try {
      res = await this.fetchWithRedirectPolicy(url, {
        allowedHosts: new Set(['api.github.com', 'codeload.github.com']),
        signal: abortScope.controller.signal,
        token: options?.token,
        redirectError: () => new ArchiveDownloadFailedError('Unsafe GitHub archive redirect'),
      });
    } catch (err: unknown) {
      if (abortScope.controller.signal.aborted) {
        abortScope.dispose();
        throw this.abortError(abortScope, `Archive download timed out after ${timeoutMs}ms`);
      }
      abortScope.dispose();
      if (err instanceof ArchiveDownloadFailedError) throw err;
      throw new ArchiveDownloadFailedError(
        `Network error during archive download: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (this.checkRateLimit(res)) {
      abortScope.dispose();
      throw new GitHubRateLimitedError();
    }

    if (res.status === 404 || res.status === 403 || res.status === 401) {
      abortScope.dispose();
      throw new RepositoryNotAccessibleError();
    }

    if (!res.ok) {
      abortScope.dispose();
      throw new ArchiveDownloadFailedError(`GitHub archive download returned status ${res.status}`);
    }

    // Check Content-Length header if provided
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      const parsedLength = parseInt(contentLength, 10);
      if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
        abortScope.dispose();
        throw new RepositoryTooLargeError(
          `Repository archive size (${parsedLength} bytes) exceeds limit of ${maxBytes} bytes`
        );
      }
    }

    if (!res.body) {
      abortScope.dispose();
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
      await pipeline(nodeReadable, counter, fileStream, { signal: abortScope.controller.signal });
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

      if (abortScope.controller.signal.aborted) {
        throw this.abortError(abortScope, `Archive download timed out after ${timeoutMs}ms`);
      }
      if (err instanceof RepositoryTooLargeError) {
        throw err;
      }
      throw new ArchiveDownloadFailedError(
        `Failed to stream repository archive: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      abortScope.dispose();
    }
  }
}
