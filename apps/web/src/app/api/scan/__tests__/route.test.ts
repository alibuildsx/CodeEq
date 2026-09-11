import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GitHubRateLimitedError,
  RepositoryNotAccessibleError,
  RepositoryTooLargeError,
  ScanError,
} from '@/lib/errors';
import * as scanService from '@/lib/scanner/scanService';
import type { RepositoryScanResponse } from '@/lib/scanner/types';
import { POST } from '../route';

describe('POST /api/scan route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('returns 400 if Content-Type is not application/json', async () => {
    const req = new NextRequest('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'invalid',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_GITHUB_URL');
  });

  it('returns 400 if JSON body is malformed', async () => {
    const req = createRequest('{ malformed json }');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_GITHUB_URL');
  });

  it('returns 400 if repoUrl is missing or not a string', async () => {
    const req1 = createRequest({});
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    const req2 = createRequest({ repoUrl: 12345 });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it('returns 400 for invalid GitHub URLs (SSRF protection)', async () => {
    const req = createRequest({ repoUrl: 'https://evil.com/owner/repo' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_GITHUB_URL');
  });

  it('returns 200 with sanitized response on successful scan', async () => {
    const mockResponse: RepositoryScanResponse = {
      repository: {
        owner: 'vercel',
        name: 'next.js',
        url: 'https://github.com/vercel/next.js',
        defaultBranch: 'main',
      },
      scan: {
        schemaVersion: '1.0',
        projectInfo: {
          name: 'next.js',
          packageManager: 'pnpm',
          framework: 'nextjs',
          language: 'typescript',
          scripts: {},
          dependencies: {},
          router: 'app',
          hasSrcFolder: true,
          appRouterPath: 'src/app',
          pagesRouterPath: null,
          hasAppRouter: true,
          hasPagesRouter: false,
          hasEnv: false,
          hasEnvLocal: false,
          hasEnvExample: false,
          hasGitignore: true,
          hasVercelJson: false,
          usesSupabase: false,
          database: 'none',
          authProvider: 'none',
          deploymentProvider: 'vercel',
          testingFrameworks: [],
          sourceFileCount: 15,
          apiRouteCount: 0,
        },
        health: {
          overall: 92,
          categories: {
            security: 95,
            configuration: 90,
            codeHealth: 90,
            dependencies: 95,
            deployment: 90,
          },
        },
        healthScore: 92,
        deploymentReadiness: 'Ready',
        findings: [],
        apiRoutes: [],
        scannedAt: '2026-09-11T08:00:00.000Z',
      },
    };

    vi.spyOn(scanService, 'scanGithubRepository').mockResolvedValueOnce(mockResponse);

    const req = createRequest({ repoUrl: 'https://github.com/vercel/next.js' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockResponse);
  });

  it('returns 404 for non-accessible repository', async () => {
    vi.spyOn(scanService, 'scanGithubRepository').mockRejectedValueOnce(
      new RepositoryNotAccessibleError()
    );

    const req = createRequest({ repoUrl: 'https://github.com/private/repo' });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('REPOSITORY_NOT_ACCESSIBLE');
  });

  it('returns 413 for oversized repository', async () => {
    vi.spyOn(scanService, 'scanGithubRepository').mockRejectedValueOnce(
      new RepositoryTooLargeError('Archive exceeds 15 MB limit')
    );

    const req = createRequest({ repoUrl: 'https://github.com/huge/monolith' });
    const res = await POST(req);

    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error.code).toBe('REPOSITORY_TOO_LARGE');
  });

  it('returns 429 when GitHub API is rate limited', async () => {
    vi.spyOn(scanService, 'scanGithubRepository').mockRejectedValueOnce(
      new GitHubRateLimitedError()
    );

    const req = createRequest({ repoUrl: 'https://github.com/popular/repo' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error.code).toBe('GITHUB_RATE_LIMITED');
  });

  it('returns 500 when unexpected scanner error occurs without leaking stack or path', async () => {
    vi.spyOn(scanService, 'scanGithubRepository').mockRejectedValueOnce(
      new Error('Internal uncaught failure with sensitive C:\\secret\\path')
    );

    const req = createRequest({ repoUrl: 'https://github.com/error/repo' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe('SCAN_FAILED');
    expect(data.error.message).not.toContain('C:\\secret');
    expect(data.stack).toBeUndefined();
  });
});
