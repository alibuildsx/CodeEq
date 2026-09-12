import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArchiveDownloadFailedError,
  GitHubRateLimitedError,
  RepositoryNotAccessibleError,
  RepositoryTooLargeError,
  ScanTimeoutError,
} from '../../errors';
import { GitHubClient } from '../githubClient';

describe('GitHubClient', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeeq-client-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('fetchRepoMetadata', () => {
    it('returns metadata for a valid public repository', async () => {
      const mockResponse = {
        owner: { login: 'vercel' },
        name: 'next.js',
        default_branch: 'main',
        size: 1024,
        private: false,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new GitHubClient();
      const meta = await client.fetchRepoMetadata({ owner: 'vercel', repo: 'next.js' });

      expect(meta).toEqual({
        owner: 'vercel',
        name: 'next.js',
        defaultBranch: 'main',
        sizeKb: 1024,
        isPrivate: false,
      });
    });

    it('throws RepositoryNotAccessibleError for 404 not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );

      const client = new GitHubClient();
      await expect(
        client.fetchRepoMetadata({ owner: 'unknown-owner', repo: 'unknown-repo' })
      ).rejects.toThrow(RepositoryNotAccessibleError);
    });

    it('throws RepositoryNotAccessibleError for private repository', async () => {
      const mockResponse = {
        owner: { login: 'secret-org' },
        name: 'secret-repo',
        default_branch: 'main',
        size: 50,
        private: true,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new GitHubClient();
      await expect(
        client.fetchRepoMetadata({ owner: 'secret-org', repo: 'secret-repo' })
      ).rejects.toThrow(RepositoryNotAccessibleError);
    });

    it('throws GitHubRateLimitedError when rate limit is exceeded', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('API rate limit exceeded', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        })
      );

      const client = new GitHubClient();
      await expect(
        client.fetchRepoMetadata({ owner: 'any', repo: 'any' })
      ).rejects.toThrow(GitHubRateLimitedError);
    });

    it('throws ScanTimeoutError on fetch timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const client = new GitHubClient();
      await expect(
        client.fetchRepoMetadata({ owner: 'any', repo: 'any' }, { timeoutMs: 20 })
      ).rejects.toThrow(ScanTimeoutError);
    });

    it('sends Authorization header when token is supplied', async () => {
      let capturedAuth: string | null = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        const headers = init?.headers as Record<string, string>;
        capturedAuth = headers?.Authorization || null;
        return new Response(
          JSON.stringify({
            owner: { login: 'auth' },
            name: 'repo',
            default_branch: 'main',
            private: false,
          }),
          { status: 200 }
        );
      });

      const client = new GitHubClient('test-secret-token');
      await client.fetchRepoMetadata({ owner: 'auth', repo: 'repo' });
      expect(capturedAuth).toBe('Bearer test-secret-token');
    });

    it('rejects metadata redirects outside api.github.com', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/latest/meta-data' },
        }),
      );

      const client = new GitHubClient('test-secret-token');
      await expect(client.fetchRepoMetadata({ owner: 'safe', repo: 'repo' })).rejects.toThrow(
        RepositoryNotAccessibleError,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[1]?.redirect).toBe('manual');
    });
  });

  describe('downloadRepoArchive', () => {
    it('downloads archive stream into destination file', async () => {
      const content = Buffer.from('fake tarball payload data');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(content);
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'application/x-gzip' },
        })
      );

      const destTar = path.join(tempDir, 'repo.tar.gz');
      const client = new GitHubClient();
      const result = await client.downloadRepoArchive(
        { owner: 'vercel', repo: 'next.js' },
        'main',
        destTar
      );

      expect(result.bytesDownloaded).toBe(content.length);
      expect(fs.existsSync(destTar)).toBe(true);
      expect(fs.readFileSync(destTar)).toEqual(content);
    });

    it('rejects if Content-Length exceeds maxBytes', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('large', {
          status: 200,
          headers: { 'content-length': '20000000' }, // 20MB
        })
      );

      const destTar = path.join(tempDir, 'large.tar.gz');
      const client = new GitHubClient();
      await expect(
        client.downloadRepoArchive(
          { owner: 'vercel', repo: 'large' },
          'main',
          destTar,
          { maxBytes: 10_000 }
        )
      ).rejects.toThrow(RepositoryTooLargeError);

      expect(fs.existsSync(destTar)).toBe(false);
    });

    it('aborts and cleans up if stream chunks exceed maxBytes', async () => {
      const chunk1 = Buffer.alloc(8000, 1);
      const chunk2 = Buffer.alloc(8000, 2);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(stream, { status: 200 })
      );

      const destTar = path.join(tempDir, 'stream-large.tar.gz');
      const client = new GitHubClient();
      await expect(
        client.downloadRepoArchive(
          { owner: 'vercel', repo: 'large' },
          'main',
          destTar,
          { maxBytes: 10_000 }
        )
      ).rejects.toThrow(RepositoryTooLargeError);

      expect(fs.existsSync(destTar)).toBe(false);
    });

    it('throws RepositoryNotAccessibleError for 404 archive download', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );

      const destTar = path.join(tempDir, 'notfound.tar.gz');
      const client = new GitHubClient();
      await expect(
        client.downloadRepoArchive({ owner: 'none', repo: 'none' }, 'main', destTar)
      ).rejects.toThrow(RepositoryNotAccessibleError);
    });

    it('throws ArchiveDownloadFailedError on non-200 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server error', { status: 502 })
      );

      const destTar = path.join(tempDir, 'err.tar.gz');
      const client = new GitHubClient();
      await expect(
        client.downloadRepoArchive({ owner: 'err', repo: 'err' }, 'main', destTar)
      ).rejects.toThrow(ArchiveDownloadFailedError);
    });

    it('follows only GitHub-controlled archive redirects and strips authorization', async () => {
      const payload = Buffer.from('archive');
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: 'https://codeload.github.com/safe/repo/legacy.tar.gz/main' },
          }),
        )
        .mockResolvedValueOnce(new Response(payload, { status: 200 }));

      const destTar = path.join(tempDir, 'redirected.tar.gz');
      const client = new GitHubClient('test-secret-token');
      await client.downloadRepoArchive({ owner: 'safe', repo: 'repo' }, 'main', destTar);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const firstHeaders = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
      const secondHeaders = fetchSpy.mock.calls[1]?.[1]?.headers as Record<string, string>;
      expect(firstHeaders.Authorization).toBe('Bearer test-secret-token');
      expect(secondHeaders.Authorization).toBeUndefined();
    });

    it('rejects archive redirects to non-GitHub destinations', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/archive.tar.gz' },
        }),
      );

      const destTar = path.join(tempDir, 'unsafe-redirect.tar.gz');
      const client = new GitHubClient('test-secret-token');
      await expect(
        client.downloadRepoArchive({ owner: 'safe', repo: 'repo' }, 'main', destTar),
      ).rejects.toThrow(ArchiveDownloadFailedError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[1]?.redirect).toBe('manual');
      expect(fs.existsSync(destTar)).toBe(false);
    });
  });
});
